import { io } from "socket.io-client"
import { useEffect, useRef, useState } from "react"

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || "").replace(/\/$/, "")

let socket = null

// One shared connection for the whole app — every page that needs
// real-time updates reuses this instead of opening its own socket.
function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
  }
  return socket
}

// Joins the given role's room (e.g. "kitchen", "cashier") so this client

export function useSocketRole(role) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!role) return
    const s = getSocket()

    const join = () => {
      s.emit("join_role", role)
      setConnected(true)
    }

    if (s.connected) join()
    s.on("connect", join)
    s.on("disconnect", () => setConnected(false))

    return () => {
      s.off("connect", join)
    }
  }, [role])

  return { socket: getSocket(), connected }
}

export function useSocketTable(tableId) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!tableId) return
    const s = getSocket()

    const join = () => {
      s.emit("join_table", tableId)
      setConnected(true)
    }

    if (s.connected) join()
    s.on("connect", join)
    s.on("disconnect", () => setConnected(false))

    return () => {
      s.emit("leave_table", tableId)
      s.off("connect", join)
    }
  }, [tableId])

  return { socket: getSocket(), connected }
}

export function useSocketEvent(eventName, handler) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!eventName) return
    const s = getSocket()
    const wrapped = (...args) => handlerRef.current?.(...args)
    s.on(eventName, wrapped)
    return () => s.off(eventName, wrapped)
  }, [eventName])
}

export function resetSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export default getSocket
