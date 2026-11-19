import { Eye, Printer, CreditCard, Users, AlertTriangle, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { isAllergyNote } from "@/lib/noteTags"
import { orderTotal, statusConfig, printOrderReceipt } from "./orderHelpers"
import { useLang } from "@/i18n/LanguageContext"

function OrderRow({ order, onPay, onView, onDelete }) {
  const { t } = useLang()
  const cfg = statusConfig[order.status] || statusConfig.Pending
  const total = orderTotal(order)
  const itemCount = order.order_items?.reduce((s, oi) => s + oi.quantity, 0) || 0
  const hasAllergy = order.order_items?.some(oi => isAllergyNote(oi.note))
  const isPaid = order.is_paid ?? order.status === "Paid"
  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-primary-muted)]/40 transition-colors">
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          <div className="text-sm font-semibold text-[var(--color-text)]">#{String(order.order_id).padStart(4, "0")}</div>
          {hasAllergy && <AlertTriangle size={12} className="text-[var(--color-danger)]" />}
        </div>
        <div className="text-[10px] text-[var(--color-muted)]">{new Date(order.order_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </td>
      <td className="py-3 px-3 text-sm text-[var(--color-text)]">
        {order.table?.table_number}
        {order.party_size != null && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-[var(--color-muted)]">
            <Users size={10} /> {order.party_size}
          </span>
        )}
      </td>
      <td className="py-3 px-3 text-sm text-[var(--color-muted)]">{itemCount} {t("station.items")}</td>
      <td className="py-3 px-3">
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", cfg.color)}>{t(cfg.labelKey)}</span>
      </td>
      <td className="py-3 px-3 text-sm font-bold text-[var(--color-text)] text-right">${total.toFixed(2)}</td>
      <td className="py-3 px-3">
        <div className="flex items-center justify-end gap-1.5">
          {}
          {onPay && (
            <button onClick={() => onPay(order)}
              className="flex items-center gap-1 bg-[var(--color-primary)] text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-[var(--color-primary-dark)] transition-colors">
              <CreditCard size={12} /> {t("cashier.pay")}
            </button>
          )}
          <button onClick={() => printOrderReceipt(order)}
            title={t("cashier.printReceipt")}
            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors">
            <Printer size={15} />
          </button>
          <button onClick={() => onView(order)}
            title={t("cashier.viewDetails")}
            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors">
            <Eye size={15} />
          </button>
          {onDelete && !isPaid && (
            <button onClick={() => onDelete(order)}
              title={t("common.delete")}
              className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] hover:border-[var(--color-danger)]/30 transition-colors cursor-pointer">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function ActiveOrdersTable({ orders, onPay, onView, onDelete }) {
  const { t } = useLang()
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-primary-muted)]/30">
              <th className="text-left text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide py-2.5 px-3 whitespace-nowrap">{t("common.order")}</th>
              <th className="text-left text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide py-2.5 px-3 whitespace-nowrap">{t("common.table")}</th>
              <th className="text-left text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide py-2.5 px-3 whitespace-nowrap">{t("common.items")}</th>
              <th className="text-left text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide py-2.5 px-3 whitespace-nowrap">{t("common.status")}</th>
              <th className="text-right text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide py-2.5 px-3 whitespace-nowrap">{t("common.total")}</th>
              <th className="text-right text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide py-2.5 px-3 whitespace-nowrap">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <OrderRow key={order.order_id} order={order} onPay={onPay} onView={onView} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
