import { create } from "zustand";
import api from "../services/axios";

export const useTableStore = create((set, get) => ({
  tables: [],
  archivedTables: [],
  isLoading: false,
  archivedLoading: false,
  error: null,

  fetchTables: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/tables");
      set({ tables: res.data, isLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchTablesWithTokens: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/tables/admin/all");
      set({ tables: res.data, isLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        throw error;
      }
    }
  },

  fetchArchivedTables: async () => {
    set({ archivedLoading: true, error: null });
    try {
      const res = await api.get("/tables/admin/archived");
      set({ archivedTables: res.data, archivedLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, archivedLoading: false });
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        throw error;
      }
    }
  },

  
  
  getTableByToken: async (token) => {
    try {
      // 1. Fetch table info by QR token
      const res = await api.get(`/tables/qr/${token}`);
      // 2. Create/refresh the 2-hour guest session for this table
      const sessionRes = await api.post("/guest-sessions", { qr_token: token });
      if (sessionRes.data?.session_token) {
        localStorage.setItem("zoom_guest_session", sessionRes.data.session_token);
      }
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  createTable: async (data) => {
    try {
      const res = await api.post("/tables", data);
      set({ tables: [...get().tables, res.data] });
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  updateTable: async (id, data) => {
    try {
      const res = await api.put(`/tables/${id}`, data);
      set({ tables: get().tables.map(t => t.table_id === id ? { ...t, ...res.data } : t) });
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  
  
  regenerateQrToken: async (id) => {
    try {
      const res = await api.patch(`/tables/${id}/regenerate-qr`);
      set({ tables: get().tables.map(t => t.table_id === id ? { ...t, ...res.data } : t) });
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  deleteTable: async (id) => {
    try {
      const res = await api.delete(`/tables/${id}`);
      set({ tables: get().tables.filter(t => t.table_id !== id) });
      if (res.data?.archived) {
        await get().fetchArchivedTables();
      }
      return res.data;
    } catch (error) {
      throw error;
    }
  },

  restoreTable: async (id) => {
    try {
      const res = await api.patch(`/tables/${id}/restore`);
      const restored = res.data?.table;
      set({
        archivedTables: get().archivedTables.filter(t => t.table_id !== id),
        tables: restored
          ? [...get().tables.filter(t => t.table_id !== id), restored]
          : get().tables,
      });
      return res.data;
    } catch (error) {
      throw error;
    }
  },
}));
