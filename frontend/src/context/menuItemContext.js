import { create } from "zustand";
import api from "../services/axios";

export const useMenuItemStore = create((set, get) => ({
  items: [],
  archivedItems: [],
  isLoading: false,
  archivedLoading: false,
  error: null,

  fetchItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/menu-items");
      set({ items: res.data, isLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchArchivedItems: async () => {
    set({ archivedLoading: true, error: null });
    try {
      const res = await api.get("/menu-items/archived");
      set({ archivedItems: res.data, archivedLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, archivedLoading: false });
      throw error;
    }
  },

  createItem: async (data) => {
    try {
      const res = await api.post("/menu-items", data);
      set({ items: [...get().items, res.data] });
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  updateItem: async (id, data) => {
    try {
      const res = await api.put(`/menu-items/${id}`, data);
      set({ items: get().items.map(i => i.menu_item_id === id ? { ...i, ...res.data } : i) });
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  toggleItem: async (id, available) => {
    try {
      const res = await api.patch(`/menu-items/${id}/toggle`, { available });
      set({ items: get().items.map(i => i.menu_item_id === id ? { ...i, available } : i) });
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  deleteItem: async (id) => {
    try {
      const res = await api.delete(`/menu-items/${id}`);
      set({ items: get().items.filter(i => i.menu_item_id !== id) });
      if (res.data?.archived) {
        await get().fetchArchivedItems();
      }
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  restoreItem: async (id) => {
    try {
      const res = await api.patch(`/menu-items/${id}/restore`);
      const restored = res.data?.menu_item;
      set({
        archivedItems: get().archivedItems.filter(i => i.menu_item_id !== id),
        items: restored
          ? [...get().items.filter(i => i.menu_item_id !== id), restored]
          : get().items,
      });
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  fetchItemSales: async (id, { from, to } = {}) => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const res = await api.get(`/menu-items/${id}/sales`, { params });
    return res.data;
  },
}));
