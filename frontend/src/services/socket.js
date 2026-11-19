import { io } from "socket.io-client"
import { useEffect, useRef, useState } from "react"

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || "").replace(/\/$/, "")

let socket = null
const resetSubscribers = new Set()

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

function useSocketEpoch() {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    const bump = () => setEpoch((n) => n + 1)
    resetSubscribers.add(bump)
    return () => {
      resetSubscribers.delete(bump)
    }
  }, [])
  return epoch
}

export function useSocketRole(role) {
  const epoch = useSocketEpoch()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!role) return
    const s = getSocket()

    const onConnect = () => {
      s.emit("join_role", role)
      setConnected(true)
    }
    const onDisconnect = () => setConnected(false)

    if (s.connected) onConnect()
    s.on("connect", onConnect)
    s.on("disconnect", onDisconnect)

    return () => {
      s.off("connect", onConnect)
      s.off("disconnect", onDisconnect)
    }
  }, [role, epoch])

  return { socket: getSocket(), connected }
}

export function useSocketTable(tableId) {
  const epoch = useSocketEpoch()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!tableId) return
    const s = getSocket()

    const onConnect = () => {
      s.emit("join_table", tableId)
      setConnected(true)
    }
    const onDisconnect = () => setConnected(false)

    if (s.connected) onConnect()
    s.on("connect", onConnect)
    s.on("disconnect", onDisconnect)

    return () => {
      s.emit("leave_table", tableId)
      s.off("connect", onConnect)
      s.off("disconnect", onDisconnect)
    }
  }, [tableId, epoch])

  return { socket: getSocket(), connected }
}

export function useSocketEvent(eventName, handler) {
  const epoch = useSocketEpoch()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!eventName) return
    const s = getSocket()
    const wrapped = (...args) => handlerRef.current?.(...args)
    s.on(eventName, wrapped)
    return () => s.off(eventName, wrapped)
  }, [eventName, epoch])
}

export function resetSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  resetSubscribers.forEach((fn) => fn())
}

export default getSocket
