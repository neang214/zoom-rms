import { useState, useEffect, useCallback } from "react"
import { useOrderStore } from "../../context/orderContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { ReportBuilder, toLocalDateStr } from "@/components/admin/PaymentsParts"
import { useLang } from "@/i18n/LanguageContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"

export default function Reports() {
  const { t } = useLang()
  usePageTitle(t("nav.reports"))
  const { orders, fetchOrders, isLoading: ordersLoading } = useOrderStore()

  const todayStr = toLocalDateStr()
  const [activePeriod, setActivePeriod] = useState("Daily")
  const [customFrom, setCustomFrom] = useState(todayStr)
  const [customTo, setCustomTo] = useState(todayStr)

  const refresh = useCallback(() => {
    fetchOrders().catch(() => { })
  }, [fetchOrders])

  useEffect(() => {
    refresh()
  }, [refresh])

  useSocketRole("admin")
  useSocketEvent("payment:completed", refresh)
  useSocketEvent("order:new", refresh)
  useSocketEvent("order:status_changed", refresh)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-[var(--color-text)]">{t("report.title")}</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          {t("reports.filterSales")}
        </p>
      </div>

      <ReportBuilder
        activePeriod={activePeriod}
        setActivePeriod={setActivePeriod}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        orders={orders}
        ordersLoading={ordersLoading}
      />
    </div>
  )
} 