import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useTableStore } from "../../context/tableContext"
import { useOrderStore } from "../../context/orderContext"
import { useSocketTable, useSocketEvent } from "../../services/socket"
import { useGuestOrderSound } from "../../hooks/useGuestOrderSound"
import { usePageTitle } from "../../hooks/usePageTitle"
import { InvalidTable } from "@/components/guest/GuestOrderParts"
import { statusSteps, StatusHeader, StatusContent } from "@/components/guest/GuestOrderStatusParts"
import { useLang } from "@/i18n/LanguageContext"

const KHR_RATE = 4100

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
  const [tableError, setTableError] = useState(false)

  useSocketTable(table?.table_id)
  useGuestOrderSound()

  const refetchOrder = async () => {
    if (!table?.table_id) return
    try {
      const active = await getActiveOrderBySession()
      setOrder(active)
    } catch (err) {
      console.error(err)
    }
  }

  useSocketEvent("order:status_changed", (data) => {
    if (data?.status) {
      setOrder(prev => prev && (!data.order_id || prev.order_id === data.order_id) ? { ...prev, status: data.status } : prev)
    }
  })
  useSocketEvent("order_item:new", () => refetchOrder())
  useSocketEvent("order_item:status_changed", () => refetchOrder())
  useSocketEvent("order_item:deleted", () => refetchOrder())
  useSocketEvent("order:confirmed", () => refetchOrder())
  useSocketEvent("order:deleted", () => setOrder(null))

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    getTableByToken(token)
      .then(async (t) => {
        setTable(t)
        localStorage.setItem("zoom_last_table_token", token)
        const active = await getActiveOrderBySession()
        setOrder(active)
      })
      .catch(() => setTableError(true))
      .finally(() => setLoading(false))
  }, [token])

  if (!token || tableError) {
    return <InvalidTable navigate={navigate} message={t("guest.tableNotFound")} />
  }

  const itemTotal = order?.order_items?.reduce((s, oi) => s + Number(oi.unit_price) * oi.quantity, 0) || 0
  const totalKHR = Math.round(itemTotal * KHR_RATE)
  const statusKey = order?.status || "Pending"
  const currentStepIndex = statusSteps.indexOf(statusKey)

  return (
    <div className="min-h-screen w-full bg-[var(--color-background)] pb-10">
      <StatusHeader table={table} token={token} navigate={navigate} />
      <StatusContent
        loading={loading} order={order} token={token} navigate={navigate}
        statusKey={statusKey} currentStepIndex={currentStepIndex}
        itemTotal={itemTotal} totalKHR={totalKHR} onRefresh={refetchOrder}
      />
    </div>
  )
}
