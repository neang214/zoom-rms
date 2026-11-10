import prisma from "../../utils/db.js";
import { sendTelegramMessage, stockUsedMessage, lowStockMessage } from "../../utils/telegram.js";
import { handleEntityImageUpload, deleteCloudinaryImage } from "../../utils/cloudinary.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STOCK_TYPES = new Set(["kitchen", "barista", "both"]);

function parsePositiveId(raw) {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getPhnomPenhToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function buildPhnomPenhRange(fromStr, toStr) {
  const startDate = new Date(`${fromStr}T00:00:00+07:00`);
  const toStart = new Date(`${toStr}T00:00:00+07:00`);
  const endExclusive = new Date(toStart.getTime() + 24 * 60 * 60 * 1000);
  return { startDate, endExclusive };
}

function roundQty(val) {
  return parseFloat(Number(val || 0).toFixed(2));
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
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID format" });

    try {
        const stockItem = await prisma.stock.findUnique({
            where: { stock_id: id },
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
      WHERE s.min_level IS NOT NULL 
      AND s.quantity < s.min_level
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
    const hasQty = quantity !== undefined && quantity !== null && quantity !== "";
    const hasMin = min_level !== undefined && min_level !== null && min_level !== "";

    if (!cleanName || !hasQty || !unit_id || !hasMin)
        return res.status(400).json({ message: "All fields are required" });

    const parsedQty = parseFloat(quantity);
    const parsedMin = parseFloat(min_level);
    const parsedUnitId = parsePositiveId(unit_id);

    if (isNaN(parsedQty) || parsedQty < 0 || isNaN(parsedMin) || parsedMin < 0 || !parsedUnitId)
        return res.status(400).json({ message: "Invalid quantity, min level, or unit" });

    const finalType = VALID_STOCK_TYPES.has(stock_type) ? stock_type : "both";

    try {
        const stock = await prisma.$transaction(async (tx) => {
            const created = await tx.stock.create({
                data: {
                    item_name: cleanName,
                    quantity: parsedQty,
                    unit_id: parsedUnitId,
                    min_level: parsedMin,
                    stock_type: finalType,
                },
                include: { unit: true },
            });

            if (parsedQty > 0) {
                await tx.stockMovement.create({
                    data: {
                        stock_id: created.stock_id,
                        user_id: req.user?.userId || null,
                        type: "INITIAL",
                        quantity_change: parsedQty,
                        balance_after: created.quantity,
                        note: "Initial stock",
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
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID format" });

    const { item_name, quantity, unit_id, min_level, stock_type } = req.body;
    try {
        const stock = await prisma.$transaction(async (tx) => {
            const existing = await tx.stock.findUnique({ where: { stock_id: id } });
            if (!existing) throw Object.assign(new Error("NOT_FOUND"), { code: "P2025" });

            const updated = await tx.stock.update({
                where: { stock_id: id },
                data: {
                    item_name,
                    quantity: quantity != null ? parseFloat(quantity) : undefined,
                    unit_id: unit_id != null ? parseInt(unit_id, 10) : undefined,
                    min_level: min_level != null ? parseFloat(min_level) : undefined,
                    stock_type: VALID_STOCK_TYPES.has(stock_type) ? stock_type : undefined,
                },
                include: { unit: true },
            });

            if (quantity != null) {
                const delta = roundQty(Number(updated.quantity) - Number(existing.quantity));
                if (Math.abs(delta) > 0) {
                    await tx.stockMovement.create({
                        data: {
                            stock_id: id,
                            user_id: req.user?.userId || null,
                            type: "ADJUSTMENT",
                            quantity_change: delta,
                            balance_after: updated.quantity,
                            note: "Manual edit",
                        },
                    });
                }
            }
            return updated;
        });

        res.status(200).json(stock);
    } catch (error) {
        if (error.code === "P2025")
            return res.status(404).json({ message: "Stock not found" });
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const addStockQuantity = async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID format" });

    const quantity = parseFloat(req.body.quantity);
    if (isNaN(quantity) || quantity <= 0)
        return res.status(400).json({ message: "Quantity must be a positive number" });

    const note = req.body.note ? String(req.body.note).trim().slice(0, 255) : "Manual restock";

    try {
        const updatedStock = await prisma.$transaction(async (tx) => {
            const updated = await tx.stock.update({
                where: { stock_id: id },
                data: { quantity: { increment: quantity } },
                include: { unit: true },
            });

            await tx.stockMovement.create({
                data: {
                    stock_id: id,
                    user_id: req.user?.userId || null,
                    type: "RESTOCK",
                    quantity_change: quantity,
                    balance_after: updated.quantity,
                    note,
                },
            });

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
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID format" });

    const quantity = parseFloat(req.body.quantity);
    if (isNaN(quantity) || quantity <= 0)
        return res.status(400).json({ message: "Invalid quantity" });

    const note = req.body.note ? String(req.body.note).trim().slice(0, 255) : null;

    try {
        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.stock.findUnique({
                where: { stock_id: id },
                select: { stock_id: true },
            });
            if (!existing) return { errorStatus: 404, message: "Stock not found" };

            const debited = await tx.stock.updateMany({
                where: { stock_id: id, quantity: { gte: quantity } },
                data: { quantity: { decrement: quantity } },
            });
            if (debited.count === 0) {
                return { errorStatus: 400, message: "Not enough stock available" };
            }

            const updated = await tx.stock.findUnique({
                where: { stock_id: id },
                include: { unit: true },
            });

            await tx.stockMovement.create({
                data: {
                    stock_id: id,
                    user_id: req.user?.userId || null,
                    type: "USAGE",
                    quantity_change: -quantity,
                    balance_after: updated.quantity,
                    note,
                },
            });

            return { updated };
        });

        if (result.errorStatus) {
            return res.status(result.errorStatus).json({ message: result.message });
        }

        const updatedStock = result.updated;
        const role = req.user?.role || "staff";
        sendTelegramMessage(stockUsedMessage(updatedStock, quantity, role))
            .catch(err => console.error("Telegram usage log error:", err));

        if (
            updatedStock.min_level !== null &&
            Number(updatedStock.quantity) <= Number(updatedStock.min_level)
        ) {
            sendTelegramMessage(lowStockMessage(updatedStock))
                .catch(err => console.error("Telegram low stock error:", err));
        }

        res.json(updatedStock);
    } catch (error) {
        console.error("decreaseStockQuantity error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getStockMovements = async (req, res) => {
    const rawLimit = parseInt(req.query.limit || "100", 10);
    const take = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 100;
    const stockId = req.query.stock_id ? parsePositiveId(req.query.stock_id) : null;
    if (req.query.stock_id && !stockId) {
        return res.status(400).json({ message: "Invalid stock_id" });
    }

    try {
        const movements = await prisma.stockMovement.findMany({
            where: {
                ...(stockId ? { stock_id: stockId } : {}),
                ...(req.query.type ? { type: req.query.type } : {}),
            },
            include: {
                stock: { select: { stock_id: true, item_name: true, stock_type: true, unit: { select: { unit_name: true } } } },
                user: { select: { username: true, role: true } },
                stock_order: {
                    select: {
                        stock_order_id: true,
                        invoice: true,
                        supplier: { select: { supplier_name: true } },
                    },
                },
            },
            orderBy: { created_at: "desc" },
            take,
        });

        res.status(200).json(movements);
    } catch (error) {
        console.error("getStockMovements error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getStockReports = async (req, res) => {
    const today = getPhnomPenhToday();
    const fromStr = String(req.query.from || today).trim();
    const toStr = String(req.query.to || today).trim();
    const stockType = req.query.stock_type ? String(req.query.stock_type).trim() : "all";

    if (!DATE_RE.test(fromStr) || !DATE_RE.test(toStr)) {
        return res.status(400).json({ message: "from and to must be formatted as YYYY-MM-DD" });
    }
    if (fromStr > toStr) {
        return res.status(400).json({ message: "Start date cannot be after end date" });
    }

    const { startDate, endExclusive } = buildPhnomPenhRange(fromStr, toStr);
    const rangeDays = Math.round((endExclusive.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    if (rangeDays > 366) {
        return res.status(400).json({ message: "Date range cannot exceed 366 days" });
    }

    const typeFilter = VALID_STOCK_TYPES.has(stockType) ? stockType : null;

    try {
        const [stockItems, movements, purchaseOrders] = await Promise.all([
            prisma.stock.findMany({
                where: typeFilter ? { stock_type: typeFilter } : undefined,
                include: { unit: true },
                orderBy: { item_name: "asc" },
            }),
            prisma.stockMovement.findMany({
                where: {
                    created_at: { gte: startDate, lt: endExclusive },
                    ...(typeFilter ? { stock: { stock_type: typeFilter } } : {}),
                },
                include: {
                    stock: {
                        select: {
                            stock_id: true,
                            item_name: true,
                            stock_type: true,
                            quantity: true,
                            min_level: true,
                            unit: { select: { unit_name: true } },
                        },
                    },
                    user: { select: { username: true, role: true } },
                    stock_order: {
                        select: {
                            stock_order_id: true,
                            invoice: true,
                            supplier: { select: { supplier_name: true } },
                        },
                    },
                },
                orderBy: { created_at: "desc" },
            }),
            prisma.stockOrder.findMany({
                where: {
                    OR: [
                        { created_at: { gte: startDate, lt: endExclusive } },
                        { received_at: { gte: startDate, lt: endExclusive } },
                    ],
                    ...(typeFilter ? { stock: { stock_type: typeFilter } } : {}),
                },
                include: {
                    stock: {
                        select: {
                            stock_id: true,
                            item_name: true,
                            stock_type: true,
                            unit: { select: { unit_name: true } },
                        },
                    },
                    supplier: { select: { supplier_id: true, supplier_name: true } },
                    user: { select: { username: true } },
                },
                orderBy: { stock_order_id: "desc" },
            }),
        ]);

        const lowStockItems = stockItems
            .filter((s) => s.min_level != null && Number(s.quantity) < Number(s.min_level))
            .map((s) => ({
                stock_id: s.stock_id,
                item_name: s.item_name,
                stock_type: s.stock_type,
                quantity: Number(s.quantity),
                min_level: Number(s.min_level),
                unit_name: s.unit?.unit_name || "",
                shortage: roundQty(Number(s.min_level) - Number(s.quantity)),
            }))
            .sort((a, b) => b.shortage - a.shortage);

        const itemMap = new Map();
        const stationMap = new Map([
            ["kitchen", { station: "kitchen", used_qty: 0, restocked_qty: 0, usage_count: 0, restock_count: 0 }],
            ["barista", { station: "barista", used_qty: 0, restocked_qty: 0, usage_count: 0, restock_count: 0 }],
            ["both", { station: "both", used_qty: 0, restocked_qty: 0, usage_count: 0, restock_count: 0 }],
        ]);

        let totalUsed = 0;
        let totalRestocked = 0;
        let usageEvents = 0;
        let restockEvents = 0;

        for (const mv of movements) {
            const delta = Number(mv.quantity_change || 0);
            const item = mv.stock;
            if (!item) continue;

            if (!itemMap.has(item.stock_id)) {
                itemMap.set(item.stock_id, {
                    stock_id: item.stock_id,
                    item_name: item.item_name,
                    stock_type: item.stock_type,
                    unit_name: item.unit?.unit_name || "",
                    current_qty: Number(item.quantity),
                    min_level: item.min_level != null ? Number(item.min_level) : null,
                    used_qty: 0,
                    restocked_qty: 0,
                    net_change: 0,
                    movement_count: 0,
                });
            }

            const entry = itemMap.get(item.stock_id);
            entry.movement_count += 1;
            entry.net_change = roundQty(entry.net_change + delta);

            const stEntry = stationMap.get(item.stock_type || "both");

            if (mv.type === "USAGE") {
                const absOut = Math.abs(delta);
                totalUsed += absOut;
                usageEvents += 1;
                entry.used_qty = roundQty(entry.used_qty + absOut);
                if (stEntry) {
                    stEntry.used_qty = roundQty(stEntry.used_qty + absOut);
                    stEntry.usage_count += 1;
                }
            } else if (mv.type === "RESTOCK" || mv.type === "PO_RECEIVED" || mv.type === "INITIAL") {
                totalRestocked += delta;
                restockEvents += 1;
                entry.restocked_qty = roundQty(entry.restocked_qty + delta);
                if (stEntry) {
                    stEntry.restocked_qty = roundQty(stEntry.restocked_qty + delta);
                    stEntry.restock_count += 1;
                }
            }
        }

        const byItem = Array.from(itemMap.values()).sort(
            (a, b) => b.used_qty - a.used_qty || b.restocked_qty - a.restocked_qty || a.item_name.localeCompare(b.item_name)
        );

        const supplierMap = new Map();
        let poReceivedCount = 0;
        let poPendingCount = 0;
        let poSpend = 0;
        let poReceivedSpend = 0;

        for (const po of purchaseOrders) {
            const cost = Number(po.total_cost || 0);
            const qty = Number(po.quantity || 0);
            poSpend += cost;
            if (po.status === "Received") {
                poReceivedCount += 1;
                poReceivedSpend += cost;
            } else {
                poPendingCount += 1;
            }

            const supKey = po.supplier_id;
            if (!supplierMap.has(supKey)) {
                supplierMap.set(supKey, {
                    supplier_id: po.supplier_id,
                    supplier_name: po.supplier?.supplier_name || `Supplier #${po.supplier_id}`,
                    orders_count: 0,
                    received_count: 0,
                    total_qty: 0,
                    total_cost: 0,
                });
            }
            const supEntry = supplierMap.get(supKey);
            supEntry.orders_count += 1;
            if (po.status === "Received") supEntry.received_count += 1;
            supEntry.total_qty = roundQty(supEntry.total_qty + qty);
            supEntry.total_cost = roundQty(supEntry.total_cost + cost);
        }

        const bySupplier = Array.from(supplierMap.values()).sort(
            (a, b) => b.total_cost - a.total_cost || b.orders_count - a.orders_count
        );

        res.status(200).json({
            from: fromStr,
            to: toStr,
            stock_type: typeFilter || "all",
            summary: {
                total_items: stockItems.length,
                low_stock_count: lowStockItems.length,
                total_used: roundQty(totalUsed),
                total_restocked: roundQty(totalRestocked),
                usage_events: usageEvents,
                restock_events: restockEvents,
                po_total: purchaseOrders.length,
                po_received: poReceivedCount,
                po_pending: poPendingCount,
                po_spend: roundQty(poSpend),
                po_received_spend: roundQty(poReceivedSpend),
            },
            by_item: byItem,
            by_station: Array.from(stationMap.values()),
            by_supplier: bySupplier,
            low_stock_items: lowStockItems,
            movements,
            purchase_orders: purchaseOrders,
        });
    } catch (error) {
        console.error("getStockReports error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const deleteStock = async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID format" });

    try {
        const deleted = await prisma.$transaction(async (tx) => {
            await tx.stockOrder.deleteMany({
                where: { stock_id: id },
            });

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
