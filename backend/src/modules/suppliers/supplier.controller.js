import prisma from "../../utils/db.js";
import { DIRECT_SUPPLIER_NAME } from "../stock/stock.controller.js";

function parsePositiveId(raw) {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { deleted_at: null, supplier_name: { not: DIRECT_SUPPLIER_NAME } },
      orderBy: { supplier_name: "asc" },
    });
    res.status(200).json(suppliers);
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getArchivedSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { deleted_at: { not: null }, supplier_name: { not: DIRECT_SUPPLIER_NAME } },
      orderBy: { deleted_at: "desc" },
    });
    res.status(200).json(suppliers);
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSupplier = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid ID format" });

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { supplier_id: id, deleted_at: null },
      include: {
        _count: { select: { stock_orders: true } },
      },
    });

    if (!supplier)
      return res.status(404).json({ message: "Supplier not found" });

    res.status(200).json(supplier);
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createSupplier = async (req, res) => {
  const cleanName = String(req.body.supplier_name || "").trim();
  const cleanPhone = String(req.body.phone || "").trim();
  const cleanEmail = req.body.email && String(req.body.email).trim() ? String(req.body.email).trim() : null;

  if (!cleanName || !cleanPhone) {
    return res.status(400).json({ message: "Supplier name and phone are required" });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        supplier_name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
      },
    });

    res.status(201).json(supplier);
  } catch (error) {
    if (error.code === "P2002")
      return res
        .status(400)
        .json({ message: "Supplier with this email already exists" });

    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSupplier = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid ID format" });

  const cleanName = String(req.body.supplier_name || "").trim();
  const cleanPhone = String(req.body.phone || "").trim();
  const cleanEmail = req.body.email && String(req.body.email).trim() ? String(req.body.email).trim() : null;

  if (!cleanName || !cleanPhone) {
    return res.status(400).json({ message: "Supplier name and phone are required" });
  }
  try {
    const existing = await prisma.supplier.findFirst({
      where: { supplier_id: id, deleted_at: null },
      select: { supplier_id: true },
    });
    if (!existing) return res.status(404).json({ message: "Supplier not found" });

    const supplier = await prisma.supplier.update({
      where: { supplier_id: id },
      data: {
        supplier_name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
      },
    });

    res.status(200).json(supplier);
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Supplier not found" });
    if (error.code === "P2002")
      return res.status(400).json({ message: "Supplier with this email already exists" });
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteSupplier = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid ID format" });

  try {
    const existing = await prisma.supplier.findFirst({
      where: { supplier_id: id, deleted_at: null },
      select: {
        supplier_id: true,
        _count: { select: { stock_orders: true } },
      },
    });

    if (!existing)
      return res.status(404).json({ message: "Supplier not found" });

    if (existing._count.stock_orders === 0) {
      try {
        await prisma.supplier.delete({ where: { supplier_id: id } });
        return res.status(200).json({ message: "Supplier deleted successfully", archived: false });
      } catch (err) {
        if (err.code !== "P2003") throw err;
      }
    }

    await prisma.supplier.update({
      where: { supplier_id: id },
      data: { deleted_at: new Date() },
    });

    return res.status(200).json({
      message: "Supplier archived (purchase order history preserved)",
      archived: true,
    });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Supplier not found" });

    res.status(500).json({ message: "Internal server error" });
  }
};

export const restoreSupplier = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid ID format" });

  try {
    const existing = await prisma.supplier.findUnique({ where: { supplier_id: id } });
    if (!existing) return res.status(404).json({ message: "Supplier not found" });
    if (!existing.deleted_at) return res.status(400).json({ message: "Supplier is not archived" });

    const restored = await prisma.supplier.update({
      where: { supplier_id: id },
      data: { deleted_at: null },
    });

    res.status(200).json({ message: "Supplier restored", supplier: restored });
  } catch (error) {
    if (error.code === "P2025")
      return res.status(404).json({ message: "Supplier not found" });
    res.status(500).json({ message: "Internal server error" });
  }
};
