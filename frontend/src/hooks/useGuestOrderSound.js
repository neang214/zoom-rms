import { useEffect } from "react"
import { useSocketEvent } from "../services/socket"
import { playAlertSound, unlockAudioOnFirstInteraction } from "./useStaffNotifications"

const STORAGE_KEY = "zoom_last_alerted_status"

export function useGuestOrderSound() {
  useEffect(() => {
    unlockAudioOnFirstInteraction()
  }, [])

  useSocketEvent("order:status_changed", (data) => {
    if (!data?.status) return
    
    
    
    if (data.status !== "Served" && data.status !== "Paid") {
      if (localStorage.getItem(STORAGE_KEY) === `${data.order_id}:Served`) {
        localStorage.removeItem(STORAGE_KEY)
      }
      return
    }

    const lastAlerted = localStorage.getItem(STORAGE_KEY)
    if (lastAlerted === `${data.order_id}:${data.status}`) return

    localStorage.setItem(STORAGE_KEY, `${data.order_id}:${data.status}`)
    playAlertSound()
  })
}
