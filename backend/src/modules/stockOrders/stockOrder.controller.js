import prisma from "../../utils/db.js";
import { encodeInvoiceWithTimestamp, serializeStockOrder } from "../stock/stock.controller.js";

export const getAllPurchaseOrders = async (req, res) => {
    try {
        const purchaseOrders = await prisma.stockOrder.findMany({
            include: {
                stock: { select: { item_name: true, last_updated: true, unit: { select: { unit_name: true } } } },
                supplier: { select: { supplier_name: true } },
                user: { select: { username: true } },
            },
            orderBy: { stock_order_id: "desc" },
        });
        res.status(200).json(purchaseOrders.map(serializeStockOrder));
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getPurchaseOrder = async (req, res) => {
    try {
        const purchaseOrder = await prisma.stockOrder.findUnique({
            where: { stock_order_id: parseInt(req.params.id) },
            include: {
                stock: { select: { item_name: true, last_updated: true, unit: { select: { unit_name: true } } } },
                supplier: { select: { supplier_name: true } },
                user: { select: { username: true } },
            },
        });
        if (!purchaseOrder)
            return res
                .status(404)
                .json({ message: "Purchase order not found" });
        res.json(serializeStockOrder(purchaseOrder));
    } catch {
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const createPurchase = async (req, res) => {
    const { invoice, quantity, stock_id, supplier_id } = req.body;
    const user_id = req.user?.userId || null;

    if (!quantity || !stock_id || !supplier_id) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const parsedQuantity = parseFloat(quantity);
        const parsedStockId = parseInt(stock_id, 10);
        const parsedSupplierId = parseInt(supplier_id, 10);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({ message: "Quantity must be a positive number" });
        }
        if (!Number.isInteger(parsedStockId) || parsedStockId <= 0 || !Number.isInteger(parsedSupplierId) || parsedSupplierId <= 0) {
            return res.status(400).json({ message: "Invalid stock or supplier ID" });
        }

        const activeSupplier = await prisma.supplier.findFirst({
            where: { supplier_id: parsedSupplierId, deleted_at: null },
            select: { supplier_id: true },
        });
        if (!activeSupplier) {
            return res.status(400).json({ message: "Supplier not found or archived" });
        }

        const purchaseOrder = await prisma.$transaction(async (tx) => {
            await tx.stock.update({
                where: { stock_id: parsedStockId },
                data: { last_updated: new Date() },
            });

            return tx.stockOrder.create({
                data: {
                    invoice: encodeInvoiceWithTimestamp(invoice || "NONE"),
                    quantity: parsedQuantity,
                    user_id,
                    stock_id: parsedStockId,
                    supplier_id: parsedSupplierId,
                },
                include: {
                    stock: { select: { item_name: true, last_updated: true, unit: { select: { unit_name: true } } } },
                    supplier: { select: { supplier_name: true } },
                    user: { select: { username: true } },
                },
            });
        });
        res.status(201).json(serializeStockOrder(purchaseOrder));
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updateStatus = async (req, res) => {
    const { status } = req.body;
    const validate = ["Pending", "Ordered", "Received"];

    if (!validate.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
    }

    try {
        const purchaseOrderId = parseInt(req.params.id);

        await prisma.$transaction(async (tx) => {
            const order = await tx.stockOrder.findUnique({
                where: { stock_order_id: purchaseOrderId },
            });

            if (!order) {
                throw new Error("NOT_FOUND");
            }

            if (order.status === "Received") {
                throw new Error("ALREADY_RECEIVED");
            }

            if (order.status === "Ordered" && status === "Pending") {
                throw new Error("INVALID_TRANSITION");
            }

            if (status === "Received" && order.status !== "Received") {
                await tx.stock.update({
                    where: { stock_id: order.stock_id },
                    data: { quantity: { increment: order.quantity } },
                });
            } else {
                await tx.stock.update({
                    where: { stock_id: order.stock_id },
                    data: { last_updated: new Date() },
                });
            }

            await tx.stockOrder.update({
                where: { stock_order_id: purchaseOrderId },
                data: { status },
            });
        });

        res.status(200).json({ message: "Stock order updated successfully" });
    } catch (error) {
        if (error.message === "NOT_FOUND" || error.code === "P2025") {
            return res
                .status(404)
                .json({ message: "Purchase order not found" });
        }
        if (error.message === "ALREADY_RECEIVED") {
            return res
                .status(400)
                .json({ message: "Received purchase orders cannot be modified" });
        }
        if (error.message === "INVALID_TRANSITION") {
            return res
                .status(400)
                .json({ message: "Cannot revert an ordered purchase order back to Pending" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};
