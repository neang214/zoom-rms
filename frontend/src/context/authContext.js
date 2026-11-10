import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import api from "../services/axios";
import { resetSocket } from "../services/socket";

const TAB_SESSION_KEY = "rms-tab-authenticated";

export const authContext = create(
    persist(
        (set, get) => ({
            user: null,
            isLoading: true,

            checkAuth: async () => {
                const isTabAuthed = sessionStorage.getItem(TAB_SESSION_KEY) === "true";
                const token = sessionStorage.getItem("rms_token");

                // If tab or browser was closed, sessionStorage is empty -> require login
                if (!isTabAuthed || !token) {
                    localStorage.removeItem("rms_token");
                    set({ user: null, isLoading: false });
                    return;
                }

                set({ isLoading: true });

                try {
                    const res = await api.get("/auth/me");
                    const userData = res.data.user || res.data;
                    set({ user: userData, isLoading: false });
                } catch (error) {
                    if (
                        error.response?.status === 401 ||
                        error.response?.status === 403
                    ) {
                        sessionStorage.removeItem(TAB_SESSION_KEY);
                        sessionStorage.removeItem("rms_token");
                        localStorage.removeItem("rms_token");
                        set({ user: null });
                    }
                    set({ isLoading: false });
                }
            },

            login: async (formData) => {
                set({ isLoading: true });
                try {
                    const res = await api.post("/auth/login", formData);
                    const userData = res.data.user || res.data;
                    if (res.data.token) {
                        sessionStorage.setItem("rms_token", res.data.token);
                    }
                    sessionStorage.setItem(TAB_SESSION_KEY, "true");
                    localStorage.removeItem("rms_token");
                    resetSocket();
                    set({ user: userData, isLoading: false });
                } catch (error) {
                    console.error("Login failed:", error);
                    set({ user: null, isLoading: false });
                    throw error;
                }
            },

            logout: async () => {
                try {
                    await api.post("/auth/logout");
                } catch (err) {
                    console.error("Logout request error:", err);
                } finally {
                    sessionStorage.removeItem(TAB_SESSION_KEY);
                    sessionStorage.removeItem("rms_token");
                    sessionStorage.removeItem("rms-auth-storage");
                    localStorage.removeItem("rms_token");
                    localStorage.removeItem("rms-auth-storage");
                    resetSocket();
                    set({ user: null });
                }
            },
        }),
        {
            name: "rms-auth-storage",
            
            
            
            
            
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({ user: state.user }),
        },
    ),
);
