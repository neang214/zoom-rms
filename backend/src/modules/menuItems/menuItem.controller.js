import prisma from "../../utils/db.js";
import { Prisma } from "../../generated/prisma/client.js";
import { handleEntityImageUpload, deleteCloudinaryImage } from "../../utils/cloudinary.js";

const findActiveMenuItem = (id, select) =>
  prisma.menuItem.findFirst({
    where: { menu_item_id: id, deleted_at: null },
    ...(select ? { select } : {}),
  });

export const getAllItems = async (req, res) => {
    try {
        const menuItems = await prisma.menuItem.findMany({
            where: { deleted_at: null },
        });
        res.json(menuItems);
    } catch {
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getArchivedItems = async (req, res) => {
    try {
        const menuItems = await prisma.menuItem.findMany({
            where: { deleted_at: { not: null } },
            orderBy: { deleted_at: "desc" },
        });
        res.json(menuItems);
    } catch {
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getItemsByCategory = async (req, res) => {
    try {
        const menuItems = await prisma.menuItem.findMany({
            where: {
                category_id: parseInt(req.params.categoryId, 10),
                available: true,
                deleted_at: null,
            },
            include: {
                category: { select: { category_name: true } },
            },
        });

        res.status(200).json(menuItems);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getItem = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid ID format" });
    }

    try {
        const menuItem = await findActiveMenuItem(id);
        if (!menuItem) {
            return res.status(404).json({ message: "Menu item not found" });
        }
        res.json(menuItem);
    } catch {
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const createItem = async (req, res) => {
    const { item_name, item_name_km, category_id, price, available } = req.body;
    try {
        const menuItem = await prisma.menuItem.create({
            data: {
                item_name,
                item_name_km: item_name_km || null,
                category_id: parseInt(category_id, 10),
                price: new Prisma.Decimal(price),
                available: available === true || available === "true",
            },
        });
        res.status(201).json(menuItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const updateItem = async (req, res) => {
    const { item_name, item_name_km, price } = req.body;
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid ID format" });
    }

    try {
        const existing = await findActiveMenuItem(id, { menu_item_id: true });
        if (!existing) {
            return res.status(404).json({ message: "Item not found" });
        }

        const menuItem = await prisma.menuItem.update({
            where: { menu_item_id: id },
            data: {
                item_name,
                item_name_km: item_name_km || null,
                price: new Prisma.Decimal(price),
            },
        });
        res.json(menuItem);
    } catch (error) {
        if (error.code === "P2025")
            return res.status(404).json({ message: "Item not found" });
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const toggleItem = async (req, res) => {
    const { available } = req.body;
    const isAvailable =
        available === true || available === "true" || available === 1;
    try {
        const itemId = parseInt(req.params.id, 10);

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({ message: "Invalid ID format" });
        }

        const existing = await findActiveMenuItem(itemId, { menu_item_id: true });
        if (!existing) {
            return res.status(404).json({ message: "Item not found" });
        }

        await prisma.menuItem.update({
            where: { menu_item_id: itemId },
            data: { available: isAvailable },
        });

        res.json({
            message: "Status updated successfully",
            available: isAvailable,
        });
    } catch (error) {
        if (error.code === "P2025")
            return res.status(404).json({ message: "Item not found" });
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const uploadItemImage = async (req, res) => {
  return handleEntityImageUpload({
    req,
    res,
    findExisting: (id) =>
      findActiveMenuItem(id, { menu_item_id: true, image_url: true }),
    updateImageUrl: (id, imageUrl) =>
      prisma.menuItem.update({
        where: { menu_item_id: id },
        data: { image_url: imageUrl },
      }),
    folder: "zoom-rms/menu",
    publicIdPrefix: "menu",
    entityKey: "menu_item",
    notFoundMessage: "Menu item not found",
  });
};

export const deleteItem = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: "Invalid ID format" });

    try {
        const existing = await findActiveMenuItem(id, {
            menu_item_id: true,
            image_url: true,
            _count: { select: { order_items: true } },
        });
        if (!existing) {
            return res.status(404).json({ message: "Item not found" });
        }

        // Items with no order history can be deleted outright; items with orders are archived
        // so past receipts, order history, and sales analytics remain intact.
        if (existing._count.order_items === 0) {
            try {
                const deleted = await prisma.menuItem.delete({
                    where: { menu_item_id: id },
                    select: { image_url: true },
                });
                await deleteCloudinaryImage(deleted.image_url);
                return res.json({ message: "Menu deleted", archived: false });
            } catch (err) {
                if (err.code !== "P2003") throw err;
            }
        }

        await prisma.menuItem.update({
            where: { menu_item_id: id },
            data: { deleted_at: new Date(), available: false },
        });
        res.json({
            message: "Menu item removed from menus (order history preserved)",
            archived: true,
        });
    } catch (error) {
        if (error.code === "P2025")
            return res.status(404).json({ message: "Item not found" });
        console.error("deleteItem error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const restoreItem = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: "Invalid ID format" });

    try {
        const existing = await prisma.menuItem.findUnique({
            where: { menu_item_id: id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Item not found" });
        }
        if (!existing.deleted_at) {
            return res.status(400).json({ message: "Menu item is not archived" });
        }

        const restored = await prisma.menuItem.update({
            where: { menu_item_id: id },
            data: { deleted_at: null, available: true },
        });

        res.json({ message: "Menu item restored", menu_item: restored });
    } catch (error) {
        if (error.code === "P2025")
            return res.status(404).json({ message: "Item not found" });
        console.error("restoreItem error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_SALES_MONTHS = 36;

function getPhnomPenhYearMonth(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Phnom_Penh",
        year: "numeric",
        month: "2-digit",
    }).formatToParts(new Date(date));
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    return `${year}-${month}`;
}

function enumerateMonthRange(fromMonth, toMonth) {
    const [fromY, fromM] = fromMonth.split("-").map(Number);
    const [toY, toM] = toMonth.split("-").map(Number);
    const months = [];
    let y = fromY;
    let m = fromM;
    while (y < toY || (y === toY && m <= toM)) {
        months.push(`${y}-${String(m).padStart(2, "0")}`);
        m += 1;
        if (m > 12) {
            m = 1;
            y += 1;
        }
        if (months.length > MAX_SALES_MONTHS) break;
    }
    return months;
}

export const getItemSales = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ message: "Invalid ID format" });

    const defaultMonth = getPhnomPenhYearMonth();
    const fromMonth = String(req.query.from || defaultMonth).trim();
    const toMonth = String(req.query.to || defaultMonth).trim();

    if (!MONTH_RE.test(fromMonth) || !MONTH_RE.test(toMonth))
        return res.status(400).json({ message: "from and to must be formatted as YYYY-MM" });

    if (fromMonth > toMonth)
        return res.status(400).json({ message: "Start month cannot be after end month" });

    const months = enumerateMonthRange(fromMonth, toMonth);
    if (months.length > MAX_SALES_MONTHS)
        return res.status(400).json({ message: `Month range cannot exceed ${MAX_SALES_MONTHS} months` });

    const [toY, toM] = toMonth.split("-").map(Number);
    const nextY = toM === 12 ? toY + 1 : toY;
    const nextM = toM === 12 ? 1 : toM + 1;
    const startDate = new Date(`${fromMonth}-01T00:00:00+07:00`);
    const endExclusive = new Date(`${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00+07:00`);

    try {
        const menuItem = await prisma.menuItem.findUnique({
            where: { menu_item_id: id },
            select: {
                menu_item_id: true,
                item_name: true,
                item_name_km: true,
                price: true,
                image_url: true,
                deleted_at: true,
                category: { select: { category_name: true } },
            },
        });

        if (!menuItem)
            return res.status(404).json({ message: "Menu item not found" });

        const soldLines = await prisma.orderItem.findMany({
            where: {
                menu_item_id: id,
                order: {
                    order_date: { gte: startDate, lt: endExclusive },
                    OR: [
                        { status: "Paid" },
                        { payments: { some: { status: "Completed" } } },
                    ],
                },
            },
            select: {
                order_id: true,
                quantity: true,
                unit_price: true,
                order: { select: { order_date: true } },
            },
        });

        const monthMap = new Map(
            months.map((m) => [m, { month: m, quantity: 0, revenue: 0, orderIds: new Set() }])
        );
        const totalOrderIds = new Set();
        let totalQuantity = 0;
        let totalRevenue = 0;

        for (const line of soldLines) {
            const qty = Number(line.quantity || 0);
            const earned = qty * Number(line.unit_price || 0);
            const monthKey = getPhnomPenhYearMonth(line.order?.order_date);

            totalQuantity += qty;
            totalRevenue += earned;
            if (line.order_id) totalOrderIds.add(line.order_id);

            const bucket = monthMap.get(monthKey);
            if (bucket) {
                bucket.quantity += qty;
                bucket.revenue += earned;
                if (line.order_id) bucket.orderIds.add(line.order_id);
            }
        }

        const monthly = months.map((m) => {
            const bucket = monthMap.get(m);
            return {
                month: m,
                quantity: bucket.quantity,
                revenue: parseFloat(bucket.revenue.toFixed(2)),
                orders: bucket.orderIds.size,
            };
        });

        return res.json({
            menu_item: {
                ...menuItem,
                category_name: menuItem.category?.category_name || null,
            },
            from: fromMonth,
            to: toMonth,
            summary: {
                total_quantity: totalQuantity,
                total_revenue: parseFloat(totalRevenue.toFixed(2)),
                total_orders: totalOrderIds.size,
            },
            monthly,
        });
    } catch (error) {
        console.error("getItemSales error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
