import prisma from "../../utils/db.js";
import { verifyGuestLocation } from "../../utils/geo.js";
import { getIO } from "../../sockets/index.js";
import { attachQueueNumbers } from "../../utils/queueNumber.js";

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
    orderBy: {
      order: { order_date: "asc" },
    },
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

  const parsedOrderId = parseInt(order_id);
  const parsedMenuItemId = parseInt(menu_item_id);
  const parsedQuantity = parseInt(quantity);

  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 50) {
    return res.status(400).json({ message: "quantity must be between 1 and 50" });
  }

  if (isGuest) {
    const check = verifyGuestLocation(latitude, longitude);
    if (!check.ok) return res.status(check.status).json({ message: check.message });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { order_id: parsedOrderId },
      select: { order_id: true, status: true, confirmed: true, table_id: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // req.guestSession is attached by requireGuestSessionIfGuestChannel
    // and already proves this device holds a valid session for a specific
    // table — just compare it to the order being modified.
    if (isGuest && order.table_id !== req.guestSession.table_id) {
      return res.status(403).json({ message: "This order does not belong to this table" });
    }

    if (order.status === "Paid") {
      return res
        .status(400)
        .json({ message: "This order has already been paid and is closed" });
    }

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

    const orderItem = await prisma.orderItem.create({
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

    const io = getIO();

    io.to("role:cashier").to("role:admin").emit("order_item:new", orderItem);
    io.to(`table:${order.table_id}`).emit("order_item:new", orderItem);

    // Auto-confirm: guest & staff orders immediately dispatch to kitchen/barista
    if (menuItem.category?.type === "food") {
      io.to("role:kitchen").emit("order_item:new", orderItem);
    } else if (menuItem.category?.type === "drink") {
      io.to("role:barista").emit("order_item:new", orderItem);
    }

    res.status(201).json(orderItem);
  } catch (error) {
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

  try {
    const orderItem = await prisma.orderItem.update({
      where: { order_item_id: parseInt(req.params.id) },
      data: { status },
      include: {
        menu_item: { select: { item_name: true, item_name_km: true, category: { select: { type: true } } } },
      },
    });

    const io = getIO();
    const room = orderItem.menu_item?.category?.type === "drink" ? "role:barista" : "role:kitchen";
    io.to(room).to("role:cashier").emit("order_item:status_changed", orderItem);

    if (status === "Ready") {
      const allItems = await prisma.orderItem.findMany({
        where: { order_id: orderItem.order_id },
        select: { status: true },
      });

      const allReady = allItems.every((item) => item.status === "Ready");

      if (allReady) {
        const currentOrder = await prisma.order.findUnique({
          where: { order_id: orderItem.order_id },
          select: { status: true, table_id: true },
        });

        if (currentOrder && currentOrder.status !== "Paid") {
          const updatedOrder = await prisma.order.update({
            where: { order_id: orderItem.order_id },
            data: { status: "Served" },
          });
          io.to("role:cashier").to("role:admin").emit("order:status_changed", updatedOrder);
          io.to(`table:${updatedOrder.table_id}`).emit("order:status_changed", updatedOrder);
        }
      }
    }

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
  try {
    const orderItem = await prisma.orderItem.findUnique({
      where: { order_item_id: parseInt(req.params.id) },
      include: {
        menu_item: { select: { category: { select: { type: true } } } },
        order: { select: { table_id: true } },
      },
    });

    if (!orderItem) {
      return res.status(404).json({ message: "Order item not found" });
    }

    if (orderItem.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "Cannot remove item that is already being prepared" });
    }

    const deleted = await prisma.orderItem.delete({
      where: { order_item_id: parseInt(req.params.id) },
    });

    const io = getIO();
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

    const remainingItems = await prisma.orderItem.findMany({
      where: { order_id: deleted.order_id },
      select: { status: true },
    });

    if (remainingItems.length > 0 && remainingItems.every((item) => item.status === "Ready")) {
      const currentOrder = await prisma.order.findUnique({
        where: { order_id: deleted.order_id },
        select: { status: true, table_id: true },
      });

      if (currentOrder && currentOrder.status !== "Paid") {
        const updatedOrder = await prisma.order.update({
          where: { order_id: deleted.order_id },
          data: { status: "Served" },
        });
        io.to("role:cashier").to("role:admin").emit("order:status_changed", updatedOrder);
        if (updatedOrder.table_id) {
          io.to(`table:${updatedOrder.table_id}`).emit("order:status_changed", updatedOrder);
        }
      }
    }

    res.status(200).json({ message: "Item successfully removed from order" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
