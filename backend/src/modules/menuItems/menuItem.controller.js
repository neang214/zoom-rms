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
