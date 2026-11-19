import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useTableStore } from "../../context/tableContext"
import { useOrderStore } from "../../context/orderContext"
import { useSocketTable, useSocketEvent } from "../../services/socket"
import { useGuestOrderSound } from "../../hooks/useGuestOrderSound"
import { usePageTitle } from "../../hooks/usePageTitle"
import { InvalidTable } from "@/components/guest/GuestOrderParts"
import {
  statusSteps,
  StatusHeader,
  StatusContent,
} from "@/components/guest/GuestOrderStatusParts"
import { orderTotal } from "@/lib/currency"
import { useLang } from "@/i18n/LanguageContext"

export default function GuestOrderStatus() {
  usePageTitle("Your Order")
  const { t } = useLang()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("t")

  const { getTableByToken } = useTableStore()
  const { getActiveOrderBySession } = useOrderStore()

  const [table, setTable] = useState(null)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tableError, setTableError] = useState(false)

  const { connected } = useSocketTable(table?.table_id)
  useGuestOrderSound()

  const refetchOrder = useCallback(async () => {
    if (!table?.table_id) return
    setRefreshing(true)
    try {
      const active = await getActiveOrderBySession()
      setOrder(active || null)
    } catch (err) {
      console.error(err)
    } finally {
      setRefreshing(false)
    }
  }, [table?.table_id, getActiveOrderBySession])

  useSocketEvent("order:status_changed", (data) => {
    if (!data?.status) return
    setOrder((prev) =>
      prev && (!data.order_id || prev.order_id === data.order_id)
        ? { ...prev, status: data.status }
        : prev
    )
  })
  useSocketEvent("order_item:new", () => refetchOrder())
  useSocketEvent("order_item:status_changed", () => refetchOrder())
  useSocketEvent("order_item:deleted", () => refetchOrder())
  useSocketEvent("order_item:updated", () => refetchOrder())
  useSocketEvent("order_item:note_changed", () => refetchOrder())
  useSocketEvent("order:confirmed", () => refetchOrder())
  useSocketEvent("order:deleted", (data) => {
    setOrder((prev) => {
      if (!prev) return null
      if (data?.order_id && prev.order_id !== data.order_id) return prev
      return null
    })
  })

  useEffect(() => {
    let cancelled = false
    setTable(null)
    setOrder(null)
    setTableError(false)

    if (!token) {
      setLoading(false)
      return
    }

    setLoading(true)
    getTableByToken(token)
      .then(async (tbl) => {
        if (cancelled) return
        setTable(tbl)
        localStorage.setItem("zoom_last_table_token", token)
        const active = await getActiveOrderBySession()
        if (!cancelled) setOrder(active || null)
      })
      .catch(() => {
        if (!cancelled) setTableError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, getTableByToken, getActiveOrderBySession])

  if (!token || tableError) {
    return <InvalidTable navigate={navigate} message={t("guest.tableNotFound")} />
  }

  const itemTotal = orderTotal(order)
  const statusKey = order?.status || "Pending"
  const currentStepIndex = Math.max(0, statusSteps.indexOf(statusKey))

  return (
    <div className="min-h-dvh w-full bg-[var(--color-background)] pb-12">
      <StatusHeader
        table={table}
        token={token}
        connected={connected}
        navigate={navigate}
      />
      <StatusContent
        loading={loading}
        refreshing={refreshing}
        order={order}
        token={token}
        navigate={navigate}
        statusKey={statusKey}
        currentStepIndex={currentStepIndex}
        itemTotal={itemTotal}
        onRefresh={refetchOrder}
      />
    </div>
  )
}
