import { create } from "zustand";
import api from "../services/axios";

export const useOrderStore = create((set, get) => ({
    orders: [],
    unconfirmedOrders: [],
    isLoading: false,
    error: null,

    fetchOrders: async (status) => {
        set({ isLoading: true, error: null });
        try {
            const res = await api.get("/orders", {
                params: status ? { status } : {},
            });
            set({ orders: res.data, isLoading: false });
            return res.data;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    getActiveOrderBySession: async () => {
        try {
            const res = await api.get("/orders/session/active");
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    fetchUnconfirmedOrders: async () => {
        try {
            const res = await api.get("/orders/unconfirmed");
            set({ unconfirmedOrders: res.data });
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    fetchOrderById: async (id) => {
        try {
            const res = await api.get(`/orders/${id}`);
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    getActiveOrderByTable: async (tableId) => {
        try {
            const res = await api.get(`/orders/table/${tableId}`);
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    createOrder: async (data) => {
        try {
            const res = await api.post("/orders", data);
            set({ orders: [res.data, ...get().orders] });
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    updateOrderDetails: async (orderId, data) => {
        try {
            const res = await api.patch(`/orders/${orderId}/details`, data);
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    confirmOrder: async (id) => {
        try {
            const res = await api.patch(`/orders/${id}/confirm`);
            set({
                unconfirmedOrders: get().unconfirmedOrders.filter(
                    (o) => o.order_id !== id,
                ),
                orders: get().orders.map((o) =>
                    o.order_id === id ? { ...o, ...res.data } : o,
                ),
            });
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    rejectOrder: async (id) => {
        try {
            await api.delete(`/orders/${id}`);
            set({
                unconfirmedOrders: get().unconfirmedOrders.filter(
                    (o) => o.order_id !== id,
                ),
                orders: get().orders.filter((o) => o.order_id !== id),
            });
        } catch (error) {
            throw error;
        }
    },

    updateOrderStatus: async (id, status) => {
        try {
            const res = await api.patch(`/orders/${id}/status`, { status });
            set({
                orders: get().orders.map((o) =>
                    o.order_id === id ? { ...o, ...res.data } : o,
                ),
            });
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    deleteOrder: async (id) => {
        try {
            await api.delete(`/orders/${id}`);
            set({ orders: get().orders.filter((o) => o.order_id !== id) });
        } catch (error) {
            throw error;
        }
    },

    deleteOrderItem: async (itemId) => {
        try {
            const res = await api.delete(`/order-items/${itemId}`);
            if (res.data?.orderDeleted) {
                set({
                    orders: get().orders.filter((o) => o.order_id !== res.data.order_id),
                });
            } else {
                set({
                    orders: get().orders.map((o) => ({
                        ...o,
                        order_items: (o.order_items || []).filter(
                            (oi) => oi.order_item_id !== itemId,
                        ),
                    })),
                });
            }
            return res.data;
        } catch (error) {
            throw error;
        }
    },

    fetchOrderHistory: async (dateOrParams, tableId) => {
        try {
            let params = {};
            if (typeof dateOrParams === "object" && dateOrParams !== null) {
                params = { ...dateOrParams };
                if (tableId && !params.table_id) params.table_id = tableId;
            } else {
                if (dateOrParams) params.date = dateOrParams;
                if (tableId) params.table_id = tableId;
            }
            const res = await api.get("/orders/history", { params });
            return res.data;
        } catch (error) {
            throw error;
        }
    },
}));
