import axios from "axios"
import { useLoadingBarStore } from "../context/loadingBarContext"

export const GUEST_SESSION_KEY = "zoom_guest_session"

let onUnauthorized = null

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

const clientApi = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, ""),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
})

clientApi.interceptors.request.use(
  (config) => {
    if (!config.silent) {
      useLoadingBarStore.getState().start()
      config._trackedByLoadingBar = true
    }

    const token = sessionStorage.getItem("rms_token")
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`
    } else {
      const guestSession = localStorage.getItem(GUEST_SESSION_KEY)
      if (guestSession) {
        config.headers["x-guest-session"] = guestSession
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

clientApi.interceptors.response.use(
  (response) => {
    if (response.config?._trackedByLoadingBar) {
      useLoadingBarStore.getState().stop()
    }
    return response
  },
  (error) => {
    if (error?.config?._trackedByLoadingBar) {
      useLoadingBarStore.getState().stop()
    }

    if (error?.response?.status === 401) {
      const hadStaffSession =
        Boolean(sessionStorage.getItem("rms_token")) ||
        sessionStorage.getItem("rms-tab-authenticated") === "true"

      sessionStorage.removeItem("rms_token")
      sessionStorage.removeItem("rms-tab-authenticated")
      sessionStorage.removeItem("rms-auth-storage")
      localStorage.removeItem("rms_token")

      if (hadStaffSession) {
        onUnauthorized?.()
      }
    }

    return Promise.reject(error)
  }
)

export default clientApi
