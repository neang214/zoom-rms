import { ShoppingCart, Check, Users, Plus, Minus, AlertCircle } from "lucide-react"
import { cn, menuItemName, imageUrl } from "@/lib/utils"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui"
import { ItemNoteRow } from "@/components/shared"
import { useLang } from "@/i18n/LanguageContext"

const FALLBACK_IMG = "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&h=200&fit=crop"

export default function SubmitOrderDialog({
  open, onOpenChange, tables, tableId, onTableChange, existingOrder,
  partySize, onPartySizeChange, note, onNoteChange,
  cartItems, onItemNoteChange, onIncrease, onDecrease,
  total, totalKHR, errorMsg, submitting, submitted, onConfirm,
}) {
  const { t, lang } = useLang()
  const existingItemCount = existingOrder?.order_items?.reduce((s, oi) => s + Number(oi.quantity || 0), 0) || 0
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center"><ShoppingCart size={16} className="text-[var(--color-primary)]" /></div>
            <DialogTitle>{t("cashier.submitOrder")}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={tableId} onValueChange={onTableChange} disabled={submitting || submitted}>
            <SelectTrigger><SelectValue placeholder={t("cashier.selectTable")} /></SelectTrigger>
            <SelectContent>
              {tables.map(tbl => (
                <SelectItem key={tbl.table_id} value={String(tbl.table_id)}>
                  {tbl.table_number} {tbl.is_available ? "" : t("cashier.occupied")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {existingOrder && (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-accent-muted)] px-3 py-2 text-xs text-[var(--color-warning)]">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div>
                Active <span className="font-bold">Order #{String(existingOrder.order_id).padStart(4, "0")}</span> already has{" "}
                <span className="font-bold">{existingItemCount} {existingItemCount === 1 ? "item" : "items"}</span>. These items will be added to it.
              </div>
            </div>
          )}

          {}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                type="number" min="1" inputMode="numeric"
                value={partySize}
                onChange={e => onPartySizeChange(e.target.value)}
                placeholder="Guests (optional)"
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
          <input
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder={t("cashier.orderNotePlaceholder")}
            className="w-full h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />

          {}
          <div className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide pt-1">
            {t("cashier.itemsLabel")}
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {cartItems.map(item => (
              <div key={item.menu_item_id} className="pb-2 border-b border-[var(--color-border)] last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <img
                    src={imageUrl(item.image_url, FALLBACK_IMG)}
                    alt={menuItemName(item, lang)}
                    onError={(e) => { e.currentTarget.src = FALLBACK_IMG }}
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[var(--color-text)] truncate">{menuItemName(item, lang)}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">${Number(item.price).toFixed(2)}</div>
                  </div>
                  {}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" disabled={submitting || submitted} onClick={() => onDecrease(item.menu_item_id)}
                      className="w-6 h-6 rounded-full bg-[var(--color-danger-muted)] text-[var(--color-danger)] flex items-center justify-center disabled:opacity-50">
                      <Minus size={11} />
                    </button>
                    <span className="text-xs font-bold w-4 text-center text-[var(--color-text)]">{item.qty}</span>
                    <button type="button" disabled={submitting || submitted} onClick={() => onIncrease(item.menu_item_id)}
                      className="w-6 h-6 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center disabled:opacity-50">
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 pl-14">
                  <ItemNoteRow note={item.note} onChange={(v) => onItemNoteChange(item.menu_item_id, v)} />
                </div>
              </div>
            ))}
          </div>

          {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2">{errorMsg}</div>}

          <div className="bg-[var(--color-text)] text-white rounded-xl flex items-center justify-between px-4 py-3">
            <div className="text-sm font-bold">{t("common.total")}: ${total.toFixed(2)} <span className="text-[var(--color-primary)]">៛{totalKHR.toLocaleString()}</span></div>
            <button type="button" onClick={onConfirm} disabled={submitting || submitted}
              className={cn("font-semibold text-sm px-5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer", submitted ? "bg-[var(--color-primary)]" : "bg-[var(--color-danger)] hover:bg-[var(--color-danger)]", (submitting || submitted) && "opacity-60 cursor-not-allowed")}>
              {submitted ? <><Check size={14} /> {t("common.done")}</> : submitting ? t("cashier.submitting") : t("cashier.confirm")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
