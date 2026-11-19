import { Eye, Printer, CreditCard, Users, AlertTriangle, Trash2, Pencil, Clock } from "lucide-react"
import { cn, menuItemName } from "@/lib/utils"
import { formatUSD, formatKHR, orderTotal } from "@/lib/currency"
import { isAllergyNote } from "@/lib/noteTags"
import { statusConfig, printOrderReceipt } from "./orderHelpers"
import { useLang } from "@/i18n/LanguageContext"

function formatElapsed(dateStr, nowMs) {
  if (!dateStr) return ""
  const diffMin = Math.max(0, Math.floor((nowMs - new Date(dateStr).getTime()) / 60000))
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const hrs = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

function OrderCard({ order, nowMs, onPay, onView, onDelete }) {
  const { t, lang } = useLang()
  const cfg = statusConfig[order.status] || statusConfig.Pending
  const total = orderTotal(order)
  const items = order.order_items || []
  const itemCount = items.reduce((s, oi) => s + Number(oi.quantity || 0), 0)
  const hasAllergy = items.some((oi) => isAllergyNote(oi.note))
  const isPaid = order.is_paid ?? order.status === "Paid"
  const hasEditableItems = !isPaid && items.some((oi) => oi.status === "Pending")

  const accentBorder =
    order.status === "Served"
      ? "border-l-4 border-l-[var(--color-primary)]"
      : order.status === "Preparing"
        ? "border-l-4 border-l-[var(--color-warning)]"
        : "border-l-4 border-l-[var(--color-border-strong)]"

  return (
    <div
      className={cn(
        "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5",
        accentBorder,
        hasAllergy && "ring-1 ring-[var(--color-danger)]/40"
      )}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-[var(--color-text)] tabular-nums">
              #{String(order.order_id).padStart(4, "0")}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--color-surface-subtle)] text-[var(--color-text)]">
              {t("common.table")} {order.table?.table_number || "—"}
            </span>
            {order.queue_number != null && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
                Q#{order.queue_number}
              </span>
            )}
            {hasAllergy && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-danger-muted)] text-[var(--color-danger)]">
                <AlertTriangle size={10} /> Allergy
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-xs text-[var(--color-muted)] mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />
              {new Date(order.order_date).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {nowMs && ` · ${formatElapsed(order.order_date, nowMs)}`}
            </span>
            {order.party_size != null && (
              <span className="inline-flex items-center gap-1">
                <Users size={11} /> {order.party_size}
              </span>
            )}
          </div>
        </div>

        <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0", cfg.color)}>
          {t(cfg.labelKey)}
        </span>
      </div>

      {/* Compact Items Preview */}
      <div className="bg-[var(--color-background)]/65 border border-[var(--color-border)]/70 rounded-xl p-2.5 space-y-1">
        {items.slice(0, 3).map((oi) => (
          <div key={oi.order_item_id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--color-text-secondary)] truncate">
              <span className="font-bold text-[var(--color-text)] mr-1.5">{oi.quantity}×</span>
              {menuItemName(oi.menu_item, lang)}
            </span>
            <span className="text-[var(--color-muted)] tabular-nums shrink-0">
              {formatUSD(Number(oi.unit_price) * oi.quantity)}
            </span>
          </div>
        ))}
        {items.length > 3 && (
          <button
            type="button"
            onClick={() => onView(order)}
            className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline pt-0.5 cursor-pointer"
          >
            +{items.length - 3} {lang === "km" ? "មុខទៀត..." : "more items..."}
          </button>
        )}
        {order.note && (
          <div className="text-[11px] text-[var(--color-warning)] pt-1 border-t border-[var(--color-border)]/60 truncate">
            {t("history.note")}: {order.note}
          </div>
        )}
      </div>

      {/* Total & Action Row */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--color-border)]/60">
        <div className="leading-tight">
          <div className="text-[11px] text-[var(--color-muted)]">
            {itemCount} {t("station.items")}
          </div>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-lg font-bold text-[var(--color-text)]">
              {formatUSD(total)}
            </span>
            <span className="text-[11px] text-[var(--color-muted)]">
              {formatKHR(total)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => printOrderReceipt(order)}
            title={t("cashier.printReceipt")}
            aria-label={t("cashier.printReceipt")}
            className="p-2 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] hover:border-[var(--color-primary)]/30 transition-colors cursor-pointer"
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            onClick={() => onView(order)}
            title={hasEditableItems ? t("common.edit") : t("cashier.viewDetails")}
            aria-label={hasEditableItems ? t("common.edit") : t("cashier.viewDetails")}
            className="p-2 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] hover:border-[var(--color-primary)]/30 transition-colors cursor-pointer"
          >
            {hasEditableItems ? <Pencil size={15} /> : <Eye size={15} />}
          </button>

          {onDelete && !isPaid && (
            <button
              type="button"
              onClick={() => onDelete(order)}
              title={t("common.delete")}
              aria-label={t("common.delete")}
              className="p-2 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] hover:border-[var(--color-danger)]/30 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          )}

          {onPay && (
            <button
              type="button"
              onClick={() => onPay(order)}
              className="flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] active:scale-95 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <CreditCard size={14} />
              <span>{t("cashier.pay")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ActiveOrdersTable({ orders, nowMs, onPay, onView, onDelete }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
      {orders.map((order) => (
        <OrderCard
          key={order.order_id}
          order={order}
          nowMs={nowMs}
          onPay={onPay}
          onView={onView}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
