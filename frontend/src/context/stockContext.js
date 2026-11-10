import { create } from "zustand";
import api from "../services/axios";

export const useStockStore = create((set, get) => ({
  stockItems: [],
  lowStock: [],
  isLoading: false,
  error: null,

  fetchStock: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/stock");
      set({ stockItems: res.data, isLoading: false });
      return res.data;
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      set({ error: status ? `${status}: ${message}` : message, isLoading: false });
      throw error;
    }
  },

  fetchLowStock: async () => {
    try {
      const res = await api.get("/stock/low");
      set({ lowStock: res.data });
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  createStock: async (data) => {
    try {
      const res = await api.post("/stock", data);
      await get().fetchStock();
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  updateStock: async (id, data) => {
    try {
      const res = await api.put(`/stock/${id}`, data);
      await get().fetchStock();
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  increaseStock: async (id, quantity) => {
    try {
      const res = await api.patch(`/stock/${id}/increase`, { quantity });
      await get().fetchStock();
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  decreaseStock: async (id, quantity) => {
    try {
      const res = await api.patch(`/stock/${id}/decrease`, { quantity });
      await get().fetchStock();
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  deleteStock: async (id) => {
    try {
      await api.delete(`/stock/${id}`);
      set({ stockItems: get().stockItems.filter(s => s.stock_id !== id) });
    } catch (error) {
      throw error;
    }
  },

  
  
  
  uploadStockImage: async (id, file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post(`/stock/${id}/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await get().fetchStock();
      return res.data;
    } catch (error) {
      throw error;
    }
  },
}));
