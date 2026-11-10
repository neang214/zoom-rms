import { useState, useCallback } from "react"
import { useSocketRole, useSocketEvent } from "../services/socket"
import { useOrderItemStore } from "../context/orderItemContext"

let sharedAudioCtx = null
let lastSoundPlayedAt = 0
const SOUND_COOLDOWN_MS = 3500
const ORDER_BATCH_WINDOW_MS = 8000
const recentOrderRingMap = new Map()

function shouldRingForOrder(orderId, eventGroup = "new") {
  const now = Date.now()
  // Clean up expired entries
  for (const [k, ts] of recentOrderRingMap.entries()) {
    if (now - ts > ORDER_BATCH_WINDOW_MS) {
      recentOrderRingMap.delete(k)
    }
  }
  if (!orderId) return true
  const key = `${eventGroup}:${orderId}`
  const prev = recentOrderRingMap.get(key)
  // Always refresh the rolling window timestamp so sequential items in the same order stay grouped
  recentOrderRingMap.set(key, now)
  if (prev && now - prev < ORDER_BATCH_WINDOW_MS) {
    return false
  }
  return true
}

function getAudioContext() {
  if (!sharedAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    sharedAudioCtx = new Ctx()
  }
  return sharedAudioCtx
}

export function isAudioUnlocked() {
  return !!sharedAudioCtx && sharedAudioCtx.state === "running"
}

export function unlockAudioNow() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === "suspended") {
      ctx.resume().then(() => playAlertSound({ force: true })).catch(() => {})
    } else {
      playAlertSound({ force: true })
    }
  } catch (err) {
    console.warn("Could not unlock audio:", err)
  }
}

export function playAlertSound({ force = false } = {}) {
  try {
    const nowMs = Date.now()
    if (!force && nowMs - lastSoundPlayedAt < SOUND_COOLDOWN_MS) {
      return
    }
    lastSoundPlayedAt = nowMs

    const ctx = getAudioContext()
    if (!ctx) return

    const scheduleChime = () => {
      const playTone = (freq, startTime, duration, volume = 0.5) => {
        try {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = freq
          osc.type = "sine"
          const t0 = Math.max(startTime, ctx.currentTime + 0.01)
          gain.gain.setValueAtTime(volume, t0)
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
          osc.start(t0)
          osc.stop(t0 + duration)
        } catch {}
      }
      const now = ctx.currentTime + 0.02
      playTone(880, now, 0.22)
      playTone(1175, now + 0.24, 0.32)
    }

    if (ctx.state === "suspended") {
      ctx.resume().then(scheduleChime).catch(() => {})
    } else {
      scheduleChime()
    }
  } catch (err) {
    console.warn("Could not play alert sound:", err)
  }
}

export function unlockAudioOnFirstInteraction() {
  const unlock = () => {
    try {
      const ctx = getAudioContext()
      if (ctx) {
        if (ctx.state === "suspended") ctx.resume()
        // Silent buffer play is required to unlock audio on iOS WebKit & Android Chrome
        const buffer = ctx.createBuffer(1, 1, 22050)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        source.start(0)
      }
    } catch {}
    window.removeEventListener("click", unlock)
    window.removeEventListener("keydown", unlock)
    window.removeEventListener("touchstart", unlock)
  }
  window.addEventListener("click", unlock, { once: true })
  window.addEventListener("keydown", unlock, { once: true })
  window.addEventListener("touchstart", unlock, { once: true })
}

export function useStaffNotifications(role) {
  const { connected } = useSocketRole(role)
  const [bellRinging, setBellRinging] = useState(false)

  const { kitchenQueue, baristaQueue, fetchKitchenQueue, fetchBaristaQueue } = useOrderItemStore()

  const ring = useCallback(() => {
    setBellRinging(true)
    playAlertSound()
    setTimeout(() => setBellRinging(false), 2000)
  }, [])

  const ringForOrder = useCallback((orderId, eventGroup = "new") => {
    if (!shouldRingForOrder(orderId, eventGroup)) return
    ring()
  }, [ring])

  useSocketEvent("order:new", (order) => {
    const orderId = order?.order_id
    if (role === "cashier") {
      ringForOrder(orderId, "new")
    }
    if (role === "kitchen") {
      fetchKitchenQueue()
      ringForOrder(orderId, "new")
    }
    if (role === "barista") {
      fetchBaristaQueue()
      ringForOrder(orderId, "new")
    }
  })

  useSocketEvent("order:confirmed", (order) => {
    const orderId = order?.order_id
    if (role === "kitchen") {
      fetchKitchenQueue()
      ringForOrder(orderId, "new")
    }
    if (role === "barista") {
      fetchBaristaQueue()
      ringForOrder(orderId, "new")
    }
  })

  useSocketEvent("order:deleted", () => {
    if (role === "kitchen") fetchKitchenQueue()
    if (role === "barista") fetchBaristaQueue()
  })

  useSocketEvent("order_item:new", (item) => {
    const orderId = item?.order_id ?? item?.order?.order_id
    if (role === "cashier") {
      ringForOrder(orderId, "new")
    }
    if (role === "kitchen") {
      fetchKitchenQueue()
      ringForOrder(orderId, "new")
    }
    if (role === "barista") {
      fetchBaristaQueue()
      ringForOrder(orderId, "new")
    }
  })

  useSocketEvent("order_item:status_changed", (item) => {
    if (role === "kitchen") fetchKitchenQueue()
    if (role === "barista") fetchBaristaQueue()
    if (item?.status === "Ready" && role === "cashier") {
      const orderId = item?.order_id ?? item?.order?.order_id
      ringForOrder(orderId, "ready")
    }
  })

  useSocketEvent("order:status_changed", (order) => {
    if (order?.status === "Served" && role === "cashier") {
      ringForOrder(order?.order_id, "ready")
    }
  })

  let count = 0
  if (role === "kitchen") count = kitchenQueue.filter(i => i.status === "Pending").length
  if (role === "barista") count = baristaQueue.filter(i => i.status === "Pending").length

  const refresh = useCallback(() => {
    if (role === "kitchen") fetchKitchenQueue()
    if (role === "barista") fetchBaristaQueue()
  }, [role])

  return { count, bellRinging, connected, refresh }
}
