import prisma from "../../utils/db.js";
import { getIO } from "../../sockets/index.js";
import { verifyGuestLocation } from "../../utils/geo.js";
import { getQueueNumber, attachQueueNumbers } from "../../utils/queueNumber.js";

export const getAllOrders = async (req, res) => {
  const { status } = req.query;
  try {
    const orders = await prisma.order.findMany({
      where: status ? { status } : {},
      include: {
        table: { select: { table_number: true } },
        user:  { select: { username: true, role: true } },
        order_items: {
          orderBy: { order_item_id: "asc" },
          include: {
            menu_item: { select: { item_name: true, item_name_km: true, price: true } },
          },
        },
        
        
        
        payments: {
          where: { status: "Completed" },
          select: { payment_id: true, method: { select: { method_name: true } } },
        },
      },
      orderBy: { order_date: "desc" },
    });

    
    
    
    
    
    const queueNumbers = await attachQueueNumbers(orders);
    const shaped = orders.map(({ payments, ...o }) => ({
      ...o,
      payments, // includes method.method_name for reports
      is_paid: o.status === "Paid" || (payments?.length || 0) > 0,
      queue_number: queueNumbers.get(o.order_id),
    }));
    res.json(shaped);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { order_id: parseInt(req.params.id) },
      include: {
        table: { select: { table_number: true } },
        user:  { select: { username: true, role: true } },
        order_items: {
          orderBy: { order_item_id: "asc" },
          include: {
            menu_item: { select: { item_name: true, item_name_km: true, price: true } },
          },
        },
        payments: true,
      },
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

async function findActiveOrderForTable(table_id) {
  const order = await prisma.order.findFirst({
    where: {
      table_id,
      status: { not: "Paid" },
      payments: { none: { status: "Completed" } },
    },
    include: {
      order_items: {
        orderBy: { order_item_id: "asc" },
        include: {
          menu_item: { select: { item_name: true, item_name_km: true, price: true, image_url: true } },
        },
      },
    },
  });
  if (!order) return null;

  const queue_number = await getQueueNumber(order);
  return { ...order, queue_number };
}

export const getActiveOrderByTable = async (req, res) => {
  try {
    const result = await findActiveOrderForTable(parseInt(req.params.tableId));
    res.json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Guest-only equivalent of getActiveOrderByTable — table_id comes from the
// verified session (req.guestSession), never from a client-supplied param,
// so a guest can only ever look up their own table's order.
export const getActiveOrderBySession = async (req, res) => {
  try {
    const result = await findActiveOrderForTable(req.guestSession.table_id);
    res.json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUnconfirmedOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        confirmed: false,
        status: { not: "Paid" },
      },
      include: {
        table: { select: { table_number: true } },
        order_items: {
          orderBy: { order_item_id: "asc" },
          include: {
            menu_item: { select: { item_name: true, item_name_km: true, price: true } },
          },
        },
      },
      orderBy: { order_date: "asc" },
    });
    res.json(orders);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Guest-only route (see order.route.js) — req.guestSession is always
// present here. table_id comes from the session, never the client, and
// must match the order being edited; edits are blocked once the cashier
// has confirmed the order, so a guest can't rewrite party_size/note on
// an order staff already reviewed and sent to production.
export const updateOrderDetails = async (req, res) => {
  const { party_size, note } = req.body;
  try {
    const order = await prisma.order.findUnique({
      where: { order_id: parseInt(req.params.id) },
      select: { table_id: true, status: true },
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.table_id !== req.guestSession.table_id) {
      return res.status(403).json({ message: "This order does not belong to this table" });
    }
    if (order.status === "Paid") {
      return res.status(400).json({ message: "This order has already been paid" });
    }

    const updated = await prisma.order.update({
      where: { order_id: parseInt(req.params.id) },
      data: {
        ...(party_size !== undefined ? { party_size: party_size ? parseInt(party_size) : null } : {}),
        ...(note !== undefined ? { note: note ? String(note).slice(0, 1000) : null } : {}),
      },
    });
    res.json(updated);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Order not found" });
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createOrder = async (req, res) => {
  const { table_id, note, party_size, channel, latitude, longitude, accuracy } = req.body;

  const isGuest = channel === "guest";

  if (!isGuest && !table_id) {
    return res.status(400).json({ message: "table_id is required" });
  }

  if (isGuest) {
    const check = verifyGuestLocation(latitude, longitude, accuracy);
    if (!check.ok) return res.status(check.status).json({ message: check.message });
  }

  try {
    // req.guestSession is attached by requireGuestSessionIfGuestChannel
    // and already proves this device holds a valid, unexpired session for
    // this specific table — no separate qr_token lookup needed here.
    const table = isGuest
      ? await prisma.table.findUnique({
          where: { table_id: req.guestSession.table_id },
          select: { table_id: true, table_number: true, deleted_at: true },
        })
      : await prisma.table.findUnique({
          where: { table_id: parseInt(table_id) },
          select: { table_id: true, table_number: true, deleted_at: true },
        });

    if (!table || table.deleted_at)
      return res.status(404).json({ message: "Table not found" });

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        // Serialize concurrent order-creation attempts for this exact
        // table so two simultaneous requests can't both pass the
        // "no active order" check below and each create their own order.
        // pg_advisory_xact_lock is scoped to this transaction and
        // releases automatically on commit or rollback — no schema
        // change needed, so it works with our `prisma db push` workflow.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${table.table_id})`;

        const existingOrder = await tx.order.findFirst({
          where: {
            table_id: table.table_id,
            status: { not: "Paid" },
            payments: { none: { status: "Completed" } },
          },
        });

        if (existingOrder) {
          // Another device already opened this table's order.
          if (
            isGuest &&
            existingOrder.session_id &&
            existingOrder.session_id !== req.guestSession.session_id
          ) {
            throw new Error("TABLE_LOCKED_BY_OTHER_DEVICE");
          }
          const err = new Error("TABLE_HAS_ACTIVE_ORDER");
          err.order_id = existingOrder.order_id;
          throw err;
        }

        const newOrder = await tx.order.create({
          data: {
            table_id:  table.table_id,
            user_id:   req.user?.userId ?? null,
            session_id: isGuest ? req.guestSession.session_id : null,
            note:      note ? String(note).slice(0, 1000) : null,
            party_size: party_size ? parseInt(party_size) : null,
            confirmed: true,
          },
          include: {
            table: { select: { table_number: true } },
          },
        });

        await tx.table.update({
          where: { table_id: table.table_id },
          data:  { is_available: false },
        });

        return newOrder;
      });
    } catch (err) {
      if (err.message === "TABLE_LOCKED_BY_OTHER_DEVICE") {
        return res.status(403).json({
          message: "This table is currently in use by another guest's device.",
        });
      }
      if (err.message === "TABLE_HAS_ACTIVE_ORDER") {
        return res.status(400).json({
          message: "Table already has an active order",
          order_id: err.order_id,
        });
      }
      // In case the optional DB-level constraint (see
      // backend/sql/one_active_order_per_table.sql) is applied and
      // somehow still gets hit despite the advisory lock above.
      if (err.code === "P2002") {
        return res.status(400).json({ message: "Table already has an active order" });
      }
      throw err;
    }

    const io = getIO();
    io.to("role:cashier").to("role:admin").emit("order:new", order);
    io.to(`table:${order.table_id}`).emit("order:new", order);

    io.to("role:admin").to("role:cashier").emit("table:updated", {
      table_id: order.table_id,
      is_available: false,
    });

    const queue_number = await getQueueNumber(order);

    res.status(201).json({ ...order, queue_number });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const confirmOrder = async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { order_id: parseInt(req.params.id) },
      data:  { confirmed: true },
      include: {
        table: { select: { table_number: true } },
        order_items: {
          include: { menu_item: { select: { item_name: true, item_name_km: true, category: { select: { type: true } } } } },
        },
      },
    });

    const io = getIO();
    io.to("role:cashier").to("role:admin").emit("order:confirmed", order);

    const hasFood  = order.order_items.some(oi => oi.menu_item?.category?.type === "food");
    const hasDrink = order.order_items.some(oi => oi.menu_item?.category?.type === "drink");
    if (hasFood)  io.to("role:kitchen").emit("order:new", order);
    if (hasDrink) io.to("role:barista").emit("order:new", order);

    res.json(order);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Order not found" });
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["Pending", "Preparing", "Served", "Paid"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: `Status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  try {
    const order = await prisma.order.update({
      where: { order_id: parseInt(req.params.id) },
      data:  { status },
    });

    const io = getIO();
    io.to("role:cashier").to("role:kitchen").to("role:barista").to("role:admin")
      .emit("order:status_changed", order);
    io.to(`table:${order.table_id}`).emit("order:status_changed", order);

    res.json(order);
  } catch (error) {
    console.log(error);
    if (error.code === "P2025")
      return res.status(404).json({ message: "Order not found" });
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteOrder = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(400).json({ message: "Invalid order ID" });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        payments: { select: { status: true } },
      },
    });

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    const isPaid =
      order.status === "Paid" ||
      order.payments.some((p) => p.status === "Completed");

    if (isPaid) {
      return res.status(400).json({
        message: "Cannot delete an order that has already been paid",
      });
    }

    const tableFreed = await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({
        where: { order_id: orderId, status: { not: "Completed" } },
      });

      await tx.orderItem.deleteMany({
        where: { order_id: orderId },
      });

      await tx.order.delete({
        where: { order_id: orderId },
      });

      const otherActive = await tx.order.count({
        where: {
          table_id: order.table_id,
          status: { not: "Paid" },
        },
      });

      if (otherActive === 0) {
        await tx.table.update({
          where: { table_id: order.table_id },
          data: { is_available: true },
        });
        return true;
      }
      return false;
    });

    const io = getIO();
    io.to("role:cashier").to("role:kitchen").to("role:barista").to("role:admin")
      .emit("order:deleted", { order_id: order.order_id, table_id: order.table_id });
    io.to(`table:${order.table_id}`).emit("order:deleted", { order_id: order.order_id });

    if (tableFreed) {
      io.to("role:admin").to("role:cashier").emit("table:updated", {
        table_id: order.table_id,
        is_available: true,
      });
    }

    res.json({ message: "Order deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getOrderHistory = async (req, res) => {
  try {
    const todayLocal = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Phnom_Penh" }).format(new Date());

    const mode = req.query.mode || (
      req.query.toNow === "true" || req.query.to_now === "true"
        ? "toNow"
        : (req.query.startDate || req.query.start_date || req.query.endDate || req.query.end_date)
          ? "range"
          : "single"
    );

    let start;
    let end;
    let startDateStr = req.query.startDate || req.query.start_date;
    let endDateStr = req.query.endDate || req.query.end_date;
    const dateStr = req.query.date || todayLocal;

    if (mode === "toNow") {
      startDateStr = startDateStr || dateStr;
      endDateStr = todayLocal;
      start = new Date(`${startDateStr}T00:00:00+07:00`);
      // Up to right now
      end = new Date();
    } else if (mode === "range") {
      startDateStr = startDateStr || dateStr;
      endDateStr = endDateStr || startDateStr;
      // Ensure start <= end
      if (startDateStr > endDateStr) {
        const tmp = startDateStr;
        startDateStr = endDateStr;
        endDateStr = tmp;
      }
      start = new Date(`${startDateStr}T00:00:00+07:00`);
      end = new Date(`${endDateStr}T23:59:59.999+07:00`);
    } else {
      // Single day mode
      startDateStr = dateStr;
      endDateStr = dateStr;
      start = new Date(`${dateStr}T00:00:00+07:00`);
      end = new Date(`${dateStr}T23:59:59.999+07:00`);
    }

    const tableId = req.query.table_id ? parseInt(req.query.table_id) : null;

    const orders = await prisma.order.findMany({
      where: {
        order_date: { gte: start, lte: end },
        ...(tableId ? { table_id: tableId } : {}),
      },
      include: {
        table: { select: { table_number: true } },
        user:  { select: { username: true, role: true } },
        order_items: {
          include: {
            menu_item: {
              select: {
                item_name: true,
                item_name_km: true,
                price: true,
                category: { select: { category_name: true, type: true } },
              },
            },
          },
        },
        payments: {
          include: {
            method: { select: { method_name: true } },
          },
        },
      },
      orderBy: { order_date: "desc" },
    });

    const totalRevenue = orders
      .filter(o => o.status === "Paid")
      .reduce((sum, o) => {
        return sum + o.order_items.reduce((s, oi) => s + Number(oi.unit_price) * oi.quantity, 0);
      }, 0);

    const paidOrders = orders.filter(o => o.status === "Paid");
    const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    res.json({
      mode,
      date: startDateStr,
      start_date: startDateStr,
      end_date: endDateStr,
      table_id: tableId,
      orders,
      summary: {
        total_orders: orders.length,
        paid_orders: paidOrders.length,
        total_revenue: totalRevenue.toFixed(2),
        avg_order_value: avgOrderValue.toFixed(2),
      },
    });
  } catch (error) {
    console.error("getOrderHistory error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
