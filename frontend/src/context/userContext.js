import { create } from "zustand";
import api from "../services/axios";

export const useUserStore = create((set, get) => ({
  users: [],
  archivedUsers: [],
  isLoading: false,
  archivedLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/users");
      set({ users: res.data, isLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchArchivedUsers: async () => {
    set({ archivedLoading: true, error: null });
    try {
      const res = await api.get("/users/archived");
      set({ archivedUsers: res.data, archivedLoading: false });
      return res.data;
    } catch (error) {
      set({ error: error.message, archivedLoading: false });
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        throw error;
      }
    }
  },

  createUser: async (data) => {
    const res = await api.post("/users", data);
    set({ users: [res.data, ...get().users] });
    return res.data;
  },

  updateUser: async (id, data) => {
    const res = await api.put(`/users/${id}`, data);
    set({ users: get().users.map(u => u.user_id === id ? { ...u, ...res.data } : u) });
    return res.data;
  },

  deleteUser: async (id) => {
    const res = await api.delete(`/users/${id}`);
    set({ users: get().users.filter(u => u.user_id !== id) });
    if (res.data?.archived) {
      await get().fetchArchivedUsers();
    }
    return res.data;
  },

  restoreUser: async (id) => {
    const res = await api.patch(`/users/${id}/restore`);
    const restored = res.data?.user;
    set({
      archivedUsers: get().archivedUsers.filter(u => u.user_id !== id),
      users: restored
        ? [restored, ...get().users.filter(u => u.user_id !== id)]
        : get().users,
    });
    return res.data;
  },
}));
