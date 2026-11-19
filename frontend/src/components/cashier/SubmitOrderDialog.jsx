import { ShoppingCart, Check, Users, Plus, Minus, AlertCircle, Trash2, Loader2 } from "lucide-react"
import { cn, menuItemName } from "@/lib/utils"
import { formatUSD, formatKHR } from "@/lib/currency"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui"
import { MenuItemImage } from "@/components/admin/MenuParts"
import { ItemNoteRow } from "@/components/shared"
import { useLang } from "@/i18n/LanguageContext"

export function OrderTicketPanel({
  tables,
  tableId,
  onTableChange,
  existingOrder,
  partySize,
  onPartySizeChange,
  note,
  onNoteChange,
  cartItems,
  onItemNoteChange,
  onIncrease,
  onDecrease,
  onClearCart,
  total,
  errorMsg,
  submitting,
  submitted,
  onConfirm,
  compact = false,
}) {
  const { t, lang } = useLang()
  const existingItemCount =
    existingOrder?.order_items?.reduce((s, oi) => s + Number(oi.quantity || 0), 0) || 0
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Table + Metadata Controls */}
      <div className="space-y-2.5 shrink-0">
        <Select
          value={tableId}
          onValueChange={onTableChange}
          disabled={submitting || submitted}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("cashier.selectTable")} />
          </SelectTrigger>
          <SelectContent>
            {tables.map((tbl) => (
              <SelectItem key={tbl.table_id} value={String(tbl.table_id)}>
                <span className="font-medium">{tbl.table_number}</span>
                {!tbl.is_available && (
                  <span className="ml-1.5 text-xs text-[var(--color-warning)]">
                    {t("cashier.occupied")}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {existingOrder && (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-accent-muted)] px-3 py-2 text-xs text-[var(--color-warning)]">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              {lang === "km" ? (
                <>
                  ការកុម្ម៉ង់សកម្ម{" "}
                  <span className="font-bold">
                    #{String(existingOrder.order_id).padStart(4, "0")}
                  </span>{" "}
                  មាន {existingItemCount} មុខរួចហើយ — មុខថ្មីនឹងត្រូវបន្ថែមចូល។
                </>
              ) : (
                <>
                  Active{" "}
                  <span className="font-bold">
                    Order #{String(existingOrder.order_id).padStart(4, "0")}
                  </span>{" "}
                  has <span className="font-bold">{existingItemCount}</span> item
                  {existingItemCount === 1 ? "" : "s"} — new items will be added to it.
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="w-28 relative shrink-0">
            <Users
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={partySize}
              onChange={(e) => onPartySizeChange(e.target.value)}
              placeholder={t("guest.guests")}
              disabled={submitting || submitted}
              className="w-full h-9 pl-8 pr-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/60 text-xs sm:text-sm text-[var(--color-text)] outline-none focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
            />
          </div>
          <input
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t("cashier.orderNotePlaceholder")}
            disabled={submitting || submitted}
            className="flex-1 min-w-0 h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/60 text-xs sm:text-sm text-[var(--color-text)] outline-none focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Cart Items Header */}
      <div className="flex items-center justify-between pt-3.5 pb-2 shrink-0">
        <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
          {t("common.items")} ({cartCount})
        </span>
        {cartItems.length > 0 && onClearCart && !submitting && !submitted && (
          <button
            type="button"
            onClick={onClearCart}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
          >
            <Trash2 size={11} />
            <span>{lang === "km" ? "សម្អាត" : "Clear"}</span>
          </button>
        )}
      </div>

      {/* Scrollable Ticket Items */}
      <div
        className={cn(
          "flex-1 overflow-y-auto space-y-2.5 pr-1",
          compact ? "max-h-64" : "min-h-[180px]"
        )}
      >
        {cartItems.length === 0 ? (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center border border-dashed border-[var(--color-border)] rounded-2xl p-6 text-[var(--color-muted)]">
            <ShoppingCart size={24} className="opacity-35 mb-2" />
            <div className="text-xs font-medium">
              {lang === "km"
                ? "ចុចលើមុខម្ហូបដើម្បីបន្ថែមចូលវិក្កយបត្រ"
                : "Tap menu items to build an order"}
            </div>
          </div>
        ) : (
          cartItems.map((item) => (
            <div
              key={item.menu_item_id}
              className="pb-2.5 border-b border-[var(--color-border)]/70 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-[var(--color-surface-subtle)] border border-[var(--color-border)]/60 shrink-0">
                  <MenuItemImage item={item} lang={lang} iconSize={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--color-text)] truncate">
                    {menuItemName(item, lang)}
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)] tabular-nums">
                    {formatUSD(item.price)} × {item.qty} ={" "}
                    <span className="font-semibold text-[var(--color-text-secondary)]">
                      {formatUSD(Number(item.price) * item.qty)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={submitting || submitted}
                    onClick={() => onDecrease(item.menu_item_id)}
                    aria-label="Decrease quantity"
                    className="w-6 h-6 rounded-lg bg-[var(--color-danger-muted)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="text-xs font-bold w-5 text-center text-[var(--color-text)] tabular-nums">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    disabled={submitting || submitted}
                    onClick={() => onIncrease(item.menu_item_id)}
                    aria-label="Increase quantity"
                    className="w-6 h-6 rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              <div className="mt-1.5 pl-12">
                <ItemNoteRow
                  note={item.note}
                  onChange={(v) => onItemNoteChange(item.menu_item_id, v)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Error + Total + Submit Footer */}
      <div className="pt-3 mt-3 border-t border-[var(--color-border)] space-y-2.5 shrink-0">
        {errorMsg && (
          <div
            role="alert"
            className="text-xs font-medium text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2"
          >
            {errorMsg}
          </div>
        )}

        <div className="bg-[var(--color-banner-bg)] text-[var(--color-banner-text)] rounded-xl flex items-center justify-between px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {t("common.total")}
          </span>
          <div className="text-right tabular-nums">
            <span className="text-base font-bold">{formatUSD(total)}</span>
            <span className="text-emerald-300 text-xs font-semibold ml-1.5">
              {formatKHR(total)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting || submitted || cartItems.length === 0}
          className={cn(
            "w-full h-11 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs",
            submitted
              ? "bg-[var(--color-success)] text-white"
              : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white",
            (submitting || submitted || cartItems.length === 0) &&
              "opacity-60 cursor-not-allowed"
          )}
        >
          {submitted ? (
            <>
              <Check size={16} />
              <span>{t("common.done")}</span>
            </>
          ) : submitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>{t("cashier.submitting")}</span>
            </>
          ) : (
            <>
              <ShoppingCart size={15} />
              <span>{t("cashier.submitOrder")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function SubmitOrderDialog({ open, onOpenChange, ...panelProps }) {
  const { t } = useLang()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <ShoppingCart size={16} className="text-[var(--color-primary)]" />
            </div>
            <DialogTitle>{t("cashier.submitOrder")}</DialogTitle>
          </div>
        </DialogHeader>
        <OrderTicketPanel {...panelProps} compact />
      </DialogContent>
    </Dialog>
  )
}
