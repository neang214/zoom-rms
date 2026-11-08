import { useEffect } from "react"
import { usePaymentStore } from "../../context/paymentContext"
import { useOrderStore } from "../../context/orderContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { PaymentStats, PaymentsTable } from "@/components/admin/PaymentsParts"
import { useLang } from "@/i18n/LanguageContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"

export default function Payments() {
  const { t } = useLang()
  usePageTitle(t("nav.paymentsOnly"))
  const { payments, fetchPayments, isLoading: paymentsLoading } = usePaymentStore()
  const { orders, fetchOrders } = useOrderStore()

  useEffect(() => {
    fetchPayments().catch(() => { })
    fetchOrders().catch(() => { })
  }, [fetchPayments, fetchOrders])

  useSocketRole("admin")
  useSocketEvent("payment:completed", () => {
    fetchPayments().catch(() => { })
    fetchOrders().catch(() => { })
  })
  useSocketEvent("order:status_changed", () => {
    fetchPayments().catch(() => { })
    fetchOrders().catch(() => { })
  })

  const todaysPayments = payments.filter((p) => {
    const d = new Date(p.payment_date)
    const today = new Date()
    return d.toDateString() === today.toDateString() && p.status === "Completed"
  })

  const todaysRevenue = todaysPayments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-[var(--color-text)]">{t("nav.paymentsOnly")}</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">{t("payments.subtitle")}</p>
      </div>

      <PaymentStats orders={orders} todaysPayments={todaysPayments} todaysRevenue={todaysRevenue} />

      <PaymentsTable payments={payments} orders={orders} isLoading={paymentsLoading} />
    </div>
  )
} 