import prisma from "../../utils/db.js";
import { verifyGuestLocation } from "../../utils/geo.js";
import { getIO } from "../../sockets/index.js";
import { attachQueueNumbers } from "../../utils/queueNumber.js";

/**
 * Derive an Order's active status from its items (when not already Paid).
 */
export function computeOrderStatus(items) {
  if (!items || items.length === 0) return "Pending";
  if (items.every((item) => item.status === "Ready")) return "Served";
  if (items.some((item) => item.status === "Preparing")) return "Preparing";
  return "Pending";
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function syncOrderStatusInTx(tx, orderId) {
  const currentOrder = await tx.order.findUnique({
    where: { order_id: orderId },
    select: { order_id: true, status: true, table_id: true },
  });

  if (!currentOrder || currentOrder.status === "Paid") return null;

  const allItems = await tx.orderItem.findMany({
    where: { order_id: orderId },
    select: { status: true },
  });

  const nextStatus = computeOrderStatus(allItems);
  if (currentOrder.status === nextStatus) return null;

  return tx.order.update({
    where: { order_id: orderId },
    data: { status: nextStatus },
  });
}

function emitOrderStatusChanged(io, updatedOrder) {
  if (!updatedOrder) return;
  io.to("role:cashier")
    .to("role:kitchen")
    .to("role:barista")
    .to("role:admin")
    .emit("order:status_changed", updatedOrder);
  if (updatedOrder.table_id) {
    io.to(`table:${updatedOrder.table_id}`).emit("order:status_changed", updatedOrder);
  }
}

const getQueue = async (type) => {
  const items = await prisma.orderItem.findMany({
    where: {
      status: { in: ["Pending", "Preparing"] },
      menu_item: {
        category: { type },
      },
      order: { confirmed: true },
    },
    include: {
      menu_item: {
        select: {
          item_name: true,
          item_name_km: true,
          category: { select: { category_name: true } },
        },
      },
      order: {
        select: {
          order_id: true,
          order_date: true,
          note: true,
          party_size: true,
          table: { select: { table_number: true } },
        },
      },
    },
    orderBy: [
      { order: { order_date: "asc" } },
      { order_item_id: "asc" },
    ],
  });

  
  
  
  const queueNumbers = await attachQueueNumbers(items.map(i => i.order));
  return items.map(i => ({
    ...i,
    order: { ...i.order, queue_number: queueNumbers.get(i.order.order_id) },
  }));
};

export const getItemsByOrder = async (req, res) => {
  try {
    const items = await prisma.orderItem.findMany({
      where: { order_id: parseInt(req.params.orderId) },
      include: {
        menu_item: {
          select: { item_name: true, item_name_km: true, price: true },
        },
      },
    });

    res.json(items);
  } catch {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getKitchenQueue = async (req, res) => {
  try {
    const items = await getQueue("food");
    res.json(items);
  } catch {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getBaristaQueue = async (req, res) => {
  try {
    const items = await getQueue("drink");
    res.json(items);
  } catch {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const addItem = async (req, res) => {
  const { order_id, menu_item_id, quantity, note, channel, latitude, longitude } = req.body;

  const isGuest = channel === "guest";

  if (!order_id || !menu_item_id || quantity === undefined) {
    return res.status(400).json({
      message: "Required fields missing: order_id, menu_item_id, quantity",
    });
  }

  const parsedOrderId = parseInt(order_id, 10);
  const parsedMenuItemId = parseInt(menu_item_id, 10);
  const parsedQuantity = parseInt(quantity, 10);

  if (!Number.isInteger(parsedOrderId) || parsedOrderId < 1 || !Number.isInteger(parsedMenuItemId) || parsedMenuItemId < 1) {
    return res.status(400).json({ message: "Invalid order_id or menu_item_id" });
  }

  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 50) {
    return res.status(400).json({ message: "quantity must be between 1 and 50" });
  }

  if (isGuest) {
    const check = verifyGuestLocation(latitude, longitude);
    if (!check.ok) return res.status(check.status).json({ message: check.message });
  }

  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { menu_item_id: parsedMenuItemId },
      select: { price: true, available: true, deleted_at: true, item_name: true, category: { select: { type: true } } },
    });

    if (!menuItem || menuItem.deleted_at) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    if (!menuItem.available) {
      return res.status(400).json({ message: "Menu item is not available" });
    }

    const { order, orderItem, updatedOrder } = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${parsedOrderId})`;

      const existingOrder = await tx.order.findUnique({
        where: { order_id: parsedOrderId },
        select: { order_id: true, status: true, confirmed: true, table_id: true },
      });

      if (!existingOrder) {
        throw httpError(404, "Order not found");
      }

      // req.guestSession is attached by requireGuestSessionIfGuestChannel
      // and already proves this device holds a valid session for a specific
      // table — just compare it to the order being modified.
      if (isGuest && existingOrder.table_id !== req.guestSession.table_id) {
        throw httpError(403, "This order does not belong to this table");
      }

      if (existingOrder.status === "Paid") {
        throw httpError(400, "This order has already been paid and is closed");
      }

      const createdItem = await tx.orderItem.create({
        data: {
          order_id: parsedOrderId,
          menu_item_id: parsedMenuItemId,
          quantity: parsedQuantity,
          unit_price: menuItem.price,
          note: note ? String(note).slice(0, 255) : null,
        },
        include: {
          menu_item: { select: { item_name: true, item_name_km: true, price: true } },
          order: { select: { order_id: true, table: { select: { table_number: true } } } },
        },
      });

      // Adding new Pending items to a Served order reopens order status so
      // guest tracking and cashier queues do not leave new items under Served/Ready.
      const syncedOrder = await syncOrderStatusInTx(tx, parsedOrderId);

      return { order: existingOrder, orderItem: createdItem, updatedOrder: syncedOrder };
    });

    const io = getIO();

    io.to("role:cashier").to("role:admin").emit("order_item:new", orderItem);
    io.to(`table:${order.table_id}`).emit("order_item:new", orderItem);

    // Auto-confirm: guest & staff orders immediately dispatch to kitchen/barista
    if (menuItem.category?.type === "food") {
      io.to("role:kitchen").emit("order_item:new", orderItem);
    } else if (menuItem.category?.type === "drink") {
      io.to("role:barista").emit("order_item:new", orderItem);
    }

    emitOrderStatusChanged(io, updatedOrder);

    res.status(201).json(orderItem);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateItemStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["Pending", "Preparing", "Ready"];

  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ message: `Status must be one of: ${validStatuses.join(", ")}` });
  }

  const itemId = parseInt(req.params.id, 10);
  if (!Number.isInteger(itemId) || itemId < 1) {
    return res.status(404).json({ message: "Order item not found" });
  }

  try {
    const existing = await prisma.orderItem.findUnique({
      where: { order_item_id: itemId },
      select: { order_id: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Order item not found" });
    }

    const { orderItem, updatedOrder } = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${existing.order_id})`;

      const updatedItem = await tx.orderItem.update({
        where: { order_item_id: itemId },
        data: { status },
        include: {
          menu_item: { select: { item_name: true, item_name_km: true, category: { select: { type: true } } } },
          order: { select: { table_id: true } },
        },
      });

      const syncedOrder = await syncOrderStatusInTx(tx, existing.order_id);
      return { orderItem: updatedItem, updatedOrder: syncedOrder };
    });

    const io = getIO();
    const room = orderItem.menu_item?.category?.type === "drink" ? "role:barista" : "role:kitchen";
    io.to(room).to("role:cashier").to("role:admin").emit("order_item:status_changed", orderItem);
    if (orderItem.order?.table_id) {
      io.to(`table:${orderItem.order.table_id}`).emit("order_item:status_changed", orderItem);
    }

    emitOrderStatusChanged(io, updatedOrder);

    res.json(orderItem);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Order item not found" });
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateItemNote = async (req, res) => {
  const { note } = req.body;
  try {
    const existing = await prisma.orderItem.findUnique({
      where: { order_item_id: parseInt(req.params.id) },
    });

    if (!existing) {
      return res.status(404).json({ message: "Order item not found" });
    }

    if (existing.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "Cannot edit the note on an item that's already being prepared" });
    }

    const orderItem = await prisma.orderItem.update({
      where: { order_item_id: parseInt(req.params.id) },
      data: { note: note ? String(note).slice(0, 255) : null },
      include: {
        menu_item: { select: { item_name: true, item_name_km: true, category: { select: { type: true } } } },
      },
    });

    const io = getIO();
    const room = orderItem.menu_item?.category?.type === "drink" ? "role:barista" : "role:kitchen";
    io.to(room).to("role:cashier").emit("order_item:note_changed", orderItem);

    res.json(orderItem);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Order item not found" });
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteItem = async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  if (!Number.isInteger(itemId) || itemId < 1) {
    return res.status(404).json({ message: "Order item not found" });
  }

  try {
    const existing = await prisma.orderItem.findUnique({
      where: { order_item_id: itemId },
      select: { order_id: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Order item not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${existing.order_id})`;

      const currentItem = await tx.orderItem.findUnique({
        where: { order_item_id: itemId },
        include: {
          menu_item: { select: { category: { select: { type: true } } } },
          order: {
            select: {
              order_id: true,
              table_id: true,
              status: true,
              payments: { select: { status: true } },
            },
          },
        },
      });

      if (!currentItem) {
        throw httpError(404, "Order item not found");
      }

      const isPaid =
        currentItem.order?.status === "Paid" ||
        currentItem.order?.payments?.some((p) => p.status === "Completed");

      if (isPaid) {
        throw httpError(400, "Cannot remove item from an order that has already been paid");
      }

      const removed = await tx.orderItem.delete({
        where: { order_item_id: itemId },
      });

      const remainingCount = await tx.orderItem.count({
        where: { order_id: removed.order_id },
      });

      if (remainingCount === 0) {
        await tx.payment.deleteMany({
          where: { order_id: removed.order_id, status: { not: "Completed" } },
        });
        await tx.order.delete({
          where: { order_id: removed.order_id },
        });

        let tableFreed = false;
        if (currentItem.order?.table_id) {
          const otherActive = await tx.order.count({
            where: {
              table_id: currentItem.order.table_id,
              status: { not: "Paid" },
            },
          });
          if (otherActive === 0) {
            await tx.table.update({
              where: { table_id: currentItem.order.table_id },
              data: { is_available: true },
            });
            tableFreed = true;
          }
        }

        return {
          orderItem: currentItem,
          deleted: removed,
          orderDeleted: true,
          tableFreed,
          updatedOrder: null,
        };
      }

      const syncedOrder = await syncOrderStatusInTx(tx, removed.order_id);
      return {
        orderItem: currentItem,
        deleted: removed,
        orderDeleted: false,
        tableFreed: false,
        updatedOrder: syncedOrder,
      };
    });

    const { orderItem, deleted, orderDeleted, tableFreed, updatedOrder } = result;
    const io = getIO();

    if (orderDeleted) {
      io.to("role:cashier").to("role:kitchen").to("role:barista").to("role:admin")
        .emit("order:deleted", {
          order_id: deleted.order_id,
          table_id: orderItem.order?.table_id,
        });
      if (orderItem.order?.table_id) {
        io.to(`table:${orderItem.order.table_id}`).emit("order:deleted", {
          order_id: deleted.order_id,
        });
        if (tableFreed) {
          io.to("role:admin").to("role:cashier").emit("table:updated", {
            table_id: orderItem.order.table_id,
            is_available: true,
          });
        }
      }
      return res.status(200).json({
        message: "Last item removed; order deleted",
        orderDeleted: true,
        order_id: deleted.order_id,
      });
    }

    const room = orderItem.menu_item?.category?.type === "drink" ? "role:barista" : "role:kitchen";
    io.to(room).to("role:cashier").to("role:admin").emit("order_item:deleted", {
      order_item_id: deleted.order_item_id,
      order_id: deleted.order_id,
    });
    if (orderItem.order?.table_id) {
      io.to(`table:${orderItem.order.table_id}`).emit("order_item:deleted", {
        order_item_id: deleted.order_item_id,
        order_id: deleted.order_id,
      });
    }

    emitOrderStatusChanged(io, updatedOrder);

    res.status(200).json({ message: "Item successfully removed from order", orderDeleted: false });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
