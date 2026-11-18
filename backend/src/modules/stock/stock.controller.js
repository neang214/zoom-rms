import prisma from "../../utils/db.js";
import { sendTelegramMessage, stockUsedMessage, lowStockMessage } from "../../utils/telegram.js";
import { handleEntityImageUpload, deleteCloudinaryImage } from "../../utils/cloudinary.js";

export const DIRECT_SUPPLIER_NAME = "Direct / No Supplier";

export function encodeInvoiceWithTimestamp(invoiceText, date = new Date()) {
    const clean = String(invoiceText || "").trim().replace(/\|/g, "-").slice(0, 65) || "DIRECT-ADD";
    return `${clean}|${date.toISOString()}`;
}

export function serializeStockOrder(po) {
    if (!po) return po;
    const rawInvoice = String(po.invoice || "");
    const pipeIdx = rawInvoice.lastIndexOf("|");
    if (pipeIdx !== -1) {
        const cleanInvoice = rawInvoice.slice(0, pipeIdx) || null;
        const isoDate = rawInvoice.slice(pipeIdx + 1);
        const parsed = new Date(isoDate);
        if (!Number.isNaN(parsed.getTime())) {
            return {
                ...po,
                invoice: cleanInvoice === "NONE" ? null : cleanInvoice,
                created_at: parsed.toISOString(),
            };
        }
    }
    return {
        ...po,
        created_at: po.created_at || po.stock?.last_updated || null,
    };
}

export async function getOrCreateDirectSupplierId(tx = prisma) {
    const existing = await tx.supplier.findFirst({
        where: { supplier_name: DIRECT_SUPPLIER_NAME },
        select: { supplier_id: true },
    });
    if (existing) return existing.supplier_id;

    const created = await tx.supplier.create({
        data: {
            supplier_name: DIRECT_SUPPLIER_NAME,
            phone: "—",
            email: null,
            deleted_at: new Date(0),
        },
        select: { supplier_id: true },
    });
    return created.supplier_id;
}

export const getAllStockItems = async (req, res) => {
    try {
        const role = req.user?.role;
        let where = undefined;
        if (role === "kitchen") where = { stock_type: { in: ["kitchen", "both"] } };
        else if (role === "barista") where = { stock_type: { in: ["barista", "both"] } };

        const stockItems = await prisma.stock.findMany({
            where,
            include: { unit: true },
        });
        res.status(200).json(stockItems);
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getStockById = async (req, res) => {
    try {
        const stockItem = await prisma.stock.findUnique({
            where: { stock_id: parseInt(req.params.id) },
        });
        if (!stockItem)
            return res.status(404).json({ message: "Stock item not found" });
        res.json(stockItem);
    } catch {
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getLowStock = async (req, res) => {
    try {
        const lowStock = await prisma.$queryRaw`
      SELECT s.*, u.unit_name 
      FROM stock s
      JOIN units u ON s.unit_id = u.unit_id
      WHERE s.quantity <= 0
      OR (s.min_level IS NOT NULL AND s.quantity <= s.min_level)
    `;
        res.json(lowStock);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" + error });
    }
};

export const createStock = async (req, res) => {
    const { item_name, quantity, unit_id, min_level, stock_type } = req.body;
    const cleanName = String(item_name || "").trim();
    const hasMin = min_level !== undefined && min_level !== null && min_level !== "";

    if (!cleanName || !unit_id || !hasMin)
        return res.status(400).json({ message: "All fields are required" });

    const parsedUnitId = parseInt(unit_id, 10);
    const parsedMin = parseFloat(min_level);
    const hasQty = quantity !== undefined && quantity !== null && quantity !== "";
    const parsedQty = hasQty ? parseFloat(quantity) : 0;

    if (!Number.isInteger(parsedUnitId) || parsedUnitId <= 0 || isNaN(parsedMin) || parsedMin < 0 || isNaN(parsedQty) || parsedQty < 0)
        return res.status(400).json({ message: "Invalid quantity, min level, or unit" });

    const userId = req.user?.userId || null;

    try {
        const stock = await prisma.$transaction(async (tx) => {
            // If an item with the same name (case-insensitive) and unit already exists,
            // add the new quantity to it and create a separate restock record in stock_orders.
            const existing = await tx.stock.findFirst({
                where: {
                    item_name: { equals: cleanName, mode: "insensitive" },
                    unit_id: parsedUnitId,
                },
            });

            if (existing) {
                const updated = await tx.stock.update({
                    where: { stock_id: existing.stock_id },
                    data: {
                        quantity: { increment: parsedQty },
                        min_level: parsedMin,
                        stock_type: stock_type || existing.stock_type || "both",
                    },
                    include: { unit: true },
                });

                if (parsedQty > 0 && userId) {
                    const directSupplierId = await getOrCreateDirectSupplierId(tx);
                    await tx.stockOrder.create({
                        data: {
                            invoice: encodeInvoiceWithTimestamp("DIRECT-ADD"),
                            quantity: parsedQty,
                            status: "Received",
                            user_id: userId,
                            stock_id: existing.stock_id,
                            supplier_id: directSupplierId,
                        },
                    });
                }

                return updated;
            }

            const created = await tx.stock.create({
                data: {
                    item_name: cleanName,
                    quantity: parsedQty,
                    unit_id: parsedUnitId,
                    min_level: parsedMin,
                    stock_type: stock_type || "both",
                },
                include: { unit: true },
            });

            if (parsedQty > 0 && userId) {
                const directSupplierId = await getOrCreateDirectSupplierId(tx);
                await tx.stockOrder.create({
                    data: {
                        invoice: encodeInvoiceWithTimestamp("INITIAL-STOCK"),
                        quantity: parsedQty,
                        status: "Received",
                        user_id: userId,
                        stock_id: created.stock_id,
                        supplier_id: directSupplierId,
                    },
                });
            }

            return created;
        });
        res.status(201).json(stock);
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updateStock = async (req, res) => {
    const { item_name, quantity, unit_id, min_level, stock_type } = req.body;
    const stockId = parseInt(req.params.id, 10);
    const userId = req.user?.userId || null;

    try {
        const stock = await prisma.$transaction(async (tx) => {
            const existing = await tx.stock.findUnique({
                where: { stock_id: stockId },
            });
            if (!existing) {
                const err = new Error("NOT_FOUND");
                throw err;
            }

            const newQty = quantity != null && quantity !== "" ? parseFloat(quantity) : undefined;
            const delta = newQty !== undefined ? newQty - Number(existing.quantity || 0) : 0;

            const updated = await tx.stock.update({
                where: { stock_id: stockId },
                data: {
                    item_name: item_name != null ? String(item_name).trim() : undefined,
                    quantity: newQty,
                    unit_id: unit_id != null ? parseInt(unit_id, 10) : undefined,
                    min_level: min_level != null ? parseFloat(min_level) : undefined,
                    stock_type: stock_type || undefined,
                },
                include: { unit: true },
            });

            if (delta > 0 && userId) {
                const directSupplierId = await getOrCreateDirectSupplierId(tx);
                await tx.stockOrder.create({
                    data: {
                        invoice: encodeInvoiceWithTimestamp("DIRECT-EDIT"),
                        quantity: delta,
                        status: "Received",
                        user_id: userId,
                        stock_id: stockId,
                        supplier_id: directSupplierId,
                    },
                });
            }

            return updated;
        });
        res.status(200).json(stock);
    } catch (error) {
        if (error.message === "NOT_FOUND" || error.code === "P2025")
            return res.status(404).json({ message: "Stock not found" });
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const addStockQuantity = async (req, res) => {
    const quantity = parseFloat(req.body.quantity);
    if (isNaN(quantity) || quantity <= 0)
        return res.status(400).json({ message: "Quantity must be a positive number" });

    const stockId = parseInt(req.params.id, 10);
    const userId = req.user?.userId || null;

    try {
        const updatedStock = await prisma.$transaction(async (tx) => {
            const updated = await tx.stock.update({
                where: { stock_id: stockId },
                data: { quantity: { increment: quantity } },
                include: { unit: true },
            });

            if (userId) {
                const directSupplierId = await getOrCreateDirectSupplierId(tx);
                await tx.stockOrder.create({
                    data: {
                        invoice: encodeInvoiceWithTimestamp("DIRECT-ADD"),
                        quantity,
                        status: "Received",
                        user_id: userId,
                        stock_id: stockId,
                        supplier_id: directSupplierId,
                    },
                });
            }

            return updated;
        });

        res.status(200).json(updatedStock);
    } catch (error) {
        if (error.code === "P2025")
            return res.status(404).json({ message: "Stock not found" });
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const decreaseStockQuantity = async (req, res) => {
    const quantity = parseFloat(req.body.quantity);

    if (isNaN(quantity) || quantity <= 0)
        return res.status(400).json({ message: "Invalid quantity" });

    const stockId = parseInt(req.params.id, 10);
    if (!Number.isInteger(stockId) || stockId <= 0)
        return res.status(400).json({ message: "Invalid stock ID" });

    const role = req.user?.role || "staff";

    try {
        const updatedStock = await prisma.$transaction(async (tx) => {
            const stock = await tx.stock.findUnique({
                where: { stock_id: stockId },
                include: { unit: true },
            });

            if (!stock) {
                const err = new Error("NOT_FOUND");
                throw err;
            }

            if (role === "kitchen" && stock.stock_type === "barista") {
                const err = new Error("FORBIDDEN_STATION");
                throw err;
            }
            if (role === "barista" && stock.stock_type === "kitchen") {
                const err = new Error("FORBIDDEN_STATION");
                throw err;
            }

            if (Number(stock.quantity) < quantity) {
                const err = new Error("INSUFFICIENT_STOCK");
                throw err;
            }

            return tx.stock.update({
                where: { stock_id: stockId },
                data: { quantity: { decrement: quantity } },
                include: { unit: true },
            });
        });

        // 1. Always send a usage log so admin knows what was taken and by whom.
        sendTelegramMessage(stockUsedMessage(updatedStock, quantity, role))
            .catch(err => console.error("Telegram usage log error:", err));

        // 2. Also send a low stock alert if quantity hit or dropped below min_level.
        if (
            updatedStock.min_level !== null &&
            Number(updatedStock.quantity) <= Number(updatedStock.min_level)
        ) {
            sendTelegramMessage(lowStockMessage(updatedStock))
                .catch(err => console.error("Telegram low stock error:", err));
        }

        res.json(updatedStock);
    } catch (error) {
        if (error.message === "NOT_FOUND")
            return res.status(404).json({ message: "Stock not found" });
        if (error.message === "FORBIDDEN_STATION")
            return res.status(403).json({ message: "You cannot deduct stock assigned to another station" });
        if (error.message === "INSUFFICIENT_STOCK")
            return res.status(400).json({ message: "Not enough stock available" });
        console.error("decreaseStockQuantity error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const deleteStock = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: "Invalid ID format" });

    try {
        const deleted = await prisma.$transaction(async (tx) => {
            // 1. delete related stock orders first
            await tx.stockOrder.deleteMany({
                where: { stock_id: id },
            });

            // 2. then delete the stock item
            return tx.stock.delete({
                where: { stock_id: id },
                select: { image_url: true },
            });
        });

        await deleteCloudinaryImage(deleted.image_url);
        res.status(200).json({ message: "Stock deleted successfully" });
    } catch (error) {
        if (error.code === "P2025")
            return res.status(404).json({ message: "Stock not found" });
        res.status(500).json({ message: "Internal server error" });
    }
};

// POST /api/stock/:id/image  (admin, multipart field "image")
// Uploads the image buffer to Cloudinary and persists the returned HTTPS secure_url.
export const uploadStockImage = async (req, res) => {
  return handleEntityImageUpload({
    req,
    res,
    findExisting: (id) =>
      prisma.stock.findUnique({
        where: { stock_id: id },
        select: { stock_id: true, image_url: true },
      }),
    updateImageUrl: (id, imageUrl) =>
      prisma.stock.update({
        where: { stock_id: id },
        data: { image_url: imageUrl },
      }),
    folder: "zoom-rms/stock",
    publicIdPrefix: "stock",
    entityKey: "stock",
    notFoundMessage: "Stock item not found",
  });
};
