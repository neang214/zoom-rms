import crypto from "crypto";
import prisma from "../../utils/db.js";
import { getIO } from "../../sockets/index.js";

const generateQrToken = () => crypto.randomBytes(24).toString("hex");

function sortTablesNaturally(list) {
  const norm = (s) => String(s || "").replace(/[-_\s]+/g, "");
  return [...list].sort((a, b) =>
    norm(a.table_number).localeCompare(norm(b.table_number), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

const findActiveTable = (id, select) =>
  prisma.table.findFirst({
    where: { table_id: id, deleted_at: null },
    ...(select ? { select } : {}),
  });

const findActiveOrderForTable = (tableId) =>
  prisma.order.findFirst({
    where: {
      table_id: tableId,
      status: { not: "Paid" },
      payments: { none: { status: "Completed" } },
    },
    select: { order_id: true },
  });

export const getAllTables = async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { deleted_at: null },
      select: {
        table_id: true,
        table_number: true,
        capacity: true,
        is_available: true,
      },
    });

    res.status(200).json(sortTablesNaturally(tables));
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllTablesAdmin = async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { deleted_at: null },
    });
    res.status(200).json(sortTablesNaturally(tables));
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getArchivedTables = async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { deleted_at: { not: null } },
      orderBy: { deleted_at: "desc" },
    });
    res.status(200).json(tables);
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getTable = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ message: "Invalid ID format" });

  try {
    const table = await findActiveTable(id, {
      table_id: true,
      table_number: true,
      capacity: true,
      is_available: true,
    });

    if (!table) return res.status(404).json({ message: "Table not found" });
    res.status(200).json(table);
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getTableByToken = async (req, res) => {
  try {
    const table = await prisma.table.findFirst({
      where: { qr_token: req.params.token, deleted_at: null },
    });

    if (!table) return res.status(404).json({ message: "Table not found" });
    res.status(200).json(table);
  } catch (error) {
    console.error("getTableByToken error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createTable = async (req, res) => {
  const cleanNumber = String(req.body.table_number || "").trim();
  const parsedCapacity = parseInt(req.body.capacity, 10);

  if (!cleanNumber || !Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
    return res.status(400).json({ message: "Table number and a valid positive capacity are required" });
  }

  try {
    const table = await prisma.table.create({
      data: {
        table_number: cleanNumber,
        capacity: parsedCapacity,
        is_available: req.body.is_available ?? true,
        qr_token: generateQrToken(),
      },
    });

    const io = getIO();
    const { qr_token, ...safeTable } = table;
    io.to("role:admin").to("role:cashier").emit("table:created", safeTable);

    res.status(201).json(table);
  } catch (error) {
    if (error.code === "P2002") {
      const existing = await prisma.table.findUnique({
        where: { table_number: cleanNumber },
        select: { deleted_at: true },
      });
      if (existing?.deleted_at) {
        return res.status(409).json({
          code: "TABLE_ARCHIVED_EXISTS",
          message: "An archived table with this number already exists. Restore it from Archived tables instead.",
        });
      }
      return res.status(400).json({ message: "Table number already exists" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const regenerateQrToken = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ message: "Invalid ID format" });

  try {
    const existing = await findActiveTable(id, { table_id: true });
    if (!existing) return res.status(404).json({ message: "Table not found" });

    const table = await prisma.table.update({
      where: { table_id: id },
      data: { qr_token: generateQrToken() },
    });
    res.status(200).json(table);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Table not found" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateTable = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ message: "Invalid ID format" });

  const cleanNumber = req.body.table_number !== undefined ? String(req.body.table_number).trim() : undefined;
  const parsedCapacity = req.body.capacity !== undefined ? parseInt(req.body.capacity, 10) : undefined;
  const { is_available } = req.body;

  if (cleanNumber !== undefined && !cleanNumber)
    return res.status(400).json({ message: "Table number cannot be empty" });
  if (parsedCapacity !== undefined && (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0))
    return res.status(400).json({ message: "Capacity must be a positive integer" });

  try {
    const existing = await findActiveTable(id, { table_id: true });
    if (!existing) return res.status(404).json({ message: "Table not found" });

    if (is_available === true) {
      const activeOrder = await findActiveOrderForTable(id);
      if (activeOrder) {
        return res.status(409).json({
          code: "TABLE_HAS_ACTIVE_ORDER",
          message: `Cannot mark table Available while Order #${activeOrder.order_id} is still unpaid.`,
        });
      }
    }

    const table = await prisma.table.update({
      where: { table_id: id },
      data: {
        ...(cleanNumber !== undefined ? { table_number: cleanNumber } : {}),
        ...(parsedCapacity !== undefined ? { capacity: parsedCapacity } : {}),
        ...(is_available !== undefined ? { is_available } : {}),
      },
    });

    const io = getIO();
    const { qr_token, ...safeTable } = table;
    io.to("role:admin").to("role:cashier").emit("table:updated", safeTable);

    res.status(200).json(table);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Table not found" });
    if (error.code === "P2002")
      return res.status(400).json({ message: "Table number already exists" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateTableStatus = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ message: "Invalid ID format" });

  const { is_available } = req.body;
  try {
    const existing = await findActiveTable(id, { table_id: true });
    if (!existing) return res.status(404).json({ message: "Table not found" });

    if (is_available === true) {
      const activeOrder = await findActiveOrderForTable(id);
      if (activeOrder) {
        return res.status(409).json({
          code: "TABLE_HAS_ACTIVE_ORDER",
          message: `Cannot mark table Available while Order #${activeOrder.order_id} is still unpaid.`,
        });
      }
    }

    const table = await prisma.table.update({
      where: { table_id: id },
      data: { is_available },
    });

    const io = getIO();
    const { qr_token, ...safeTable } = table;
    io.to("role:admin").to("role:cashier").emit("table:updated", safeTable);

    res.json({ message: "Table updated" });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Table not found" });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteTable = async (req, res) => {
  const tableId = parseInt(req.params.id, 10);
  if (!Number.isInteger(tableId) || tableId <= 0)
    return res.status(400).json({ message: "Invalid ID format" });

  try {
    const existing = await findActiveTable(tableId, {
      table_id: true,
      _count: { select: { orders: true } },
    });
    if (!existing) {
      return res.status(404).json({ message: "Table not found" });
    }

    const activeOrder = await findActiveOrderForTable(tableId);
    if (activeOrder) {
      return res.status(409).json({
        code: "TABLE_HAS_ACTIVE_ORDER",
        message: `Can't remove this table while Order #${activeOrder.order_id} is active and unpaid.`,
      });
    }

    const io = getIO();

    if (existing._count.orders === 0) {
      try {
        await prisma.table.delete({ where: { table_id: tableId } });
        io.to("role:admin").to("role:cashier").emit("table:deleted", { table_id: tableId });
        return res.status(200).json({ message: "Table deleted successfully", archived: false });
      } catch (err) {
        if (err.code !== "P2003") throw err;
      }
    }

    await prisma.table.update({
      where: { table_id: tableId },
      data: { deleted_at: new Date(), is_available: false },
    });

    io.to("role:admin").to("role:cashier").emit("table:deleted", { table_id: tableId });
    return res.status(200).json({
      message: "Table archived (order history preserved)",
      archived: true,
    });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Table not found" });
    console.error("deleteTable error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const restoreTable = async (req, res) => {
  const tableId = parseInt(req.params.id, 10);
  if (!Number.isInteger(tableId) || tableId <= 0)
    return res.status(400).json({ message: "Invalid ID format" });

  try {
    const existing = await prisma.table.findUnique({ where: { table_id: tableId } });
    if (!existing) return res.status(404).json({ message: "Table not found" });
    if (!existing.deleted_at) return res.status(400).json({ message: "Table is not archived" });

    const activeOrder = await findActiveOrderForTable(tableId);
    const restored = await prisma.table.update({
      where: { table_id: tableId },
      data: { deleted_at: null, is_available: !activeOrder },
    });

    const io = getIO();
    const { qr_token, ...safeTable } = restored;
    io.to("role:admin").to("role:cashier").emit("table:created", safeTable);

    res.status(200).json({ message: "Table restored", table: restored });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Table not found" });
    console.error("restoreTable error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
