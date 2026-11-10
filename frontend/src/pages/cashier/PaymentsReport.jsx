import { useState, useEffect, useCallback } from "react"
import { usePaymentStore } from "../../context/paymentContext"
import { useOrderStore } from "../../context/orderContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { PaymentStats, ReportBuilder, toLocalDateStr } from "@/components/admin/PaymentsParts"
import { useLang } from "@/i18n/LanguageContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"

export default function PaymentsReport() {
  const { t } = useLang()
  usePageTitle("Payment & Report")
  const { payments, fetchPayments } = usePaymentStore()
  const { orders, fetchOrders, isLoading: ordersLoading } = useOrderStore()

  const todayStr = toLocalDateStr()
  const [activePeriod, setActivePeriod] = useState("Daily")
  const [customFrom, setCustomFrom] = useState(todayStr)
  const [customTo, setCustomTo] = useState(todayStr)

  const refresh = useCallback(() => {
    fetchPayments().catch(() => { })
    fetchOrders().catch(() => { })
  }, [fetchPayments, fetchOrders])

  useEffect(() => {
    refresh()
  }, [refresh])

  useSocketRole("cashier")
  useSocketEvent("payment:completed", refresh)
  useSocketEvent("order:new", refresh)
  useSocketEvent("order:status_changed", refresh)

  const todaysPayments = payments.filter((p) => {
    const d = new Date(p.payment_date)
    const today = new Date()
    return d.toDateString() === today.toDateString() && p.status === "Completed"
  })

  const todaysRevenue = todaysPayments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-[var(--color-text)]">{t("nav.payments")}</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">{t("reports.filterSales")}</p>
      </div>

      <PaymentStats orders={orders} todaysPayments={todaysPayments} todaysRevenue={todaysRevenue} />

      <ReportBuilder
        activePeriod={activePeriod}
        setActivePeriod={setActivePeriod}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        orders={orders}
        ordersLoading={ordersLoading}
        printFormat="thermal"
      />
    </div>
  )
}