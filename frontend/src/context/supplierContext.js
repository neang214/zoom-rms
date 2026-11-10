import { create } from "zustand";
import api from "../services/axios";

export const useSupplierStore = create((set, get) => ({
  suppliers: [],
  archivedSuppliers: [],
  isLoading: false,
  archivedLoading: false,
  error: null,

  fetchSuppliers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/suppliers");
      set({ suppliers: res.data, isLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchArchivedSuppliers: async () => {
    set({ archivedLoading: true, error: null });
    try {
      const res = await api.get("/suppliers/archived");
      set({ archivedSuppliers: res.data, archivedLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, archivedLoading: false });
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        throw error;
      }
    }
  },

  createSupplier: async (data) => {
    const res = await api.post("/suppliers", data);
    set({ suppliers: [...get().suppliers, res.data] });
    return res.data;
  },

  updateSupplier: async (id, data) => {
    const res = await api.put(`/suppliers/${id}`, data);
    set({ suppliers: get().suppliers.map(s => s.supplier_id === id ? { ...s, ...res.data } : s) });
    return res.data;
  },

  deleteSupplier: async (id) => {
    const res = await api.delete(`/suppliers/${id}`);
    set({ suppliers: get().suppliers.filter(s => s.supplier_id !== id) });
    if (res.data?.archived) {
      await get().fetchArchivedSuppliers();
    }
    return res.data;
  },

  restoreSupplier: async (id) => {
    const res = await api.patch(`/suppliers/${id}/restore`);
    const restored = res.data?.supplier;
    set({
      archivedSuppliers: get().archivedSuppliers.filter(s => s.supplier_id !== id),
      suppliers: restored
        ? [...get().suppliers.filter(s => s.supplier_id !== id), restored].sort((a, b) =>
            String(a.supplier_name || "").localeCompare(String(b.supplier_name || ""))
          )
        : get().suppliers,
    });
    return res.data;
  },
}));
