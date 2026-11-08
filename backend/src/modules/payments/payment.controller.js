import prisma from "../../utils/db.js";
import { getIO } from "../../sockets/index.js";

export const getAllPayments = async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            include: {
                order: {
                    include: {
                        table: { select: { table_number: true } },
                        order_items: {
                            include: {
                                menu_item: { select: { item_name: true, item_name_km: true, price: true } },
                            },
                        },
                    },
                },
                user: { select: { username: true } },
                method: { select: { method_name: true } },
            },
            orderBy: { payment_date: "desc" },
        });

        res.status(200).json(payments);
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getPaymentById = async (req, res) => {
    try {
        const payment = await prisma.payment.findUnique({
            where: { payment_id: parseInt(req.params.id) },
            include: {
                order: {
                    include: {
                        table: { select: { table_number: true } },
                        order_items: {
                            include: {
                                menu_item: { select: { item_name: true, item_name_km: true, price: true } },
                            },
                        },
                    },
                },
                user: { select: { username: true } },
                method: { select: { method_name: true } },
            },
        });
        if (!payment)
            return res.status(404).json({ message: "Payment not found" });

        res.status(200).json(payment);
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getPaymentByOrder = async (req, res) => {
    try {
        const payment = await prisma.payment.findFirst({
            where: { order_id: parseInt(req.params.orderId) },
            include: {
                method: { select: { method_name: true } },
            },
        });

        if (!payment)
            return res
                .status(404)
                .json({ message: "No payment found for this order" });

        res.json(payment);
    } catch {
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const createPayment = async (req, res) => {
    const { order_id, method_id, method_name, external_ref } = req.body;
    const user_id = req.user.userId;

    if (!order_id || (!method_id && !method_name))
        return res
            .status(400)
            .json({ message: "order_id and a payment method are required" });

    const parsedOrderId = parseInt(order_id);

    try {
        const result = await prisma.$transaction(async (tx) => {
            // Serialize concurrent payment attempts for the same order
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${parsedOrderId})`;

            const order = await tx.order.findUnique({
                where: { order_id: parsedOrderId },
                include: {
                    order_items: true,
                    payments: { where: { status: "Completed" } },
                },
            });

            if (!order) {
                const err = new Error("ORDER_NOT_FOUND");
                err.statusCode = 404;
                throw err;
            }

            if (order.payments.length > 0 || order.status === "Paid") {
                const err = new Error("ORDER_ALREADY_PAID");
                err.statusCode = 409;
                throw err;
            }

            const totalAmount = order.order_items.reduce((sum, item) => {
                return sum + item.quantity * Number(item.unit_price);
            }, 0);

            let resolvedMethodId = method_id ? parseInt(method_id) : null;
            if (method_name) {
                let m = await tx.paymentMethod.findFirst({ where: { method_name } });
                if (!m) m = await tx.paymentMethod.create({ data: { method_name } });
                resolvedMethodId = m.method_id;
            }

            const payment = await tx.payment.create({
                data: {
                    order: { connect: { order_id: parsedOrderId } },
                    method: { connect: { method_id: resolvedMethodId } },
                    user: { connect: { user_id: user_id } },
                    amount: totalAmount,
                    status: "Completed",
                    ...(external_ref ? { external_ref: String(external_ref).slice(0, 100) } : {}),
                },
            });

            await tx.order.update({
                where: { order_id: parsedOrderId },
                data: { status: "Paid" },
            });

            if (order.table_id) {
                await tx.table.update({
                    where: { table_id: order.table_id },
                    data: { is_available: true },
                });
            }

            return { payment, order };
        });

        // Emit real-time payment, order status, and table availability updates
        const io = getIO();
        io.to("role:cashier").to("role:admin")
            .emit("payment:completed", { order_id: parsedOrderId, payment: result.payment });
        io.to("role:cashier").to("role:admin")
            .emit("order:status_changed", { order_id: parsedOrderId, table_id: result.order.table_id, status: "Paid" });
        io.to(`table:${result.order.table_id}`)
            .emit("order:status_changed", { order_id: parsedOrderId, table_id: result.order.table_id, status: "Paid" });

        if (result.order.table_id) {
            io.to("role:admin").to("role:cashier")
                .emit("table:updated", { table_id: result.order.table_id, is_available: true });
        }

        res.status(201).json(result.payment);
    } catch (error) {
        if (error.statusCode === 404)
            return res.status(404).json({ message: "Order not found" });
        if (error.statusCode === 409 || error.message === "ORDER_ALREADY_PAID")
            return res.status(409).json({ message: "This order has already been paid" });
        if (error.code === "P2003")
            return res.status(404).json({ message: "Payment method not found" });
        if (error.code === "P2002")
            return res.status(409).json({ message: "Duplicate payment reference" });
        console.error("createPayment error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updatePaymentStatus = async (req, res) => {
    const { status } = req.body;
    const validStatuses = ["Pending", "Completed", "Failed"];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            message: `Status must be one of: ${validStatuses.join(", ")}`,
        });
    }

    try {
        const payment = await prisma.payment.update({
            where: { payment_id: parseInt(req.params.id) },
            data: { status },
        });

        res.json(payment);
    } catch (error) {
        if (error.code === "P2025")
            return res.status(404).json({ message: "Payment not found" });
        res.status(500).json({ message: "Internal Server Error" });
    }
};
