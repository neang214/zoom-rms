import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } from "@/components/ui"
import { Users, AlertTriangle, Printer, Trash2 } from "lucide-react"
import { cn, menuItemName } from "@/lib/utils"
import { isAllergyNote } from "@/lib/noteTags"
import { orderTotal, printOrderReceipt } from "./orderHelpers"
import { useLang } from "@/i18n/LanguageContext"

export default function ViewOrderDialog({ order, onClose, onDeleteItem }) {
  const { t, lang } = useLang()
  const isPaid = order ? (order.is_paid ?? order.status === "Paid") : false
  return (
    <Dialog open={!!order} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle>Order#{String(order.order_id).padStart(4, "0")}</DialogTitle>
              <DialogDescription>{t("common.table")} {order.table?.table_number} · {new Date(order.order_date).toLocaleString()}</DialogDescription>
            </DialogHeader>
            {(order.party_size != null || order.note) && (
              <div className="flex flex-wrap gap-1.5 -mt-1">
                {order.party_size != null && (
                  <span className="flex items-center gap-1 text-[10px] bg-[var(--color-info-muted)] text-[var(--color-info)] border border-[var(--color-info)]/25 px-2 py-0.5 rounded-full font-medium">
                    <Users size={10} /> {order.party_size} guest{order.party_size !== 1 ? "s" : ""}
                  </span>
                )}
                {order.note && (
                  <span className="text-[10px] bg-[var(--color-accent-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/25 px-2 py-0.5 rounded-full font-medium">📝 {order.note}</span>
                )}
              </div>
            )}
            <div className="space-y-2">
              {order.order_items?.map(oi => (
                <div key={oi.order_item_id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--color-text)] min-w-0">
                      {menuItemName(oi.menu_item, lang)} <span className="text-[var(--color-muted)]">x{oi.quantity}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium">${(Number(oi.unit_price) * oi.quantity).toFixed(2)}</span>
                      {onDeleteItem && !isPaid && (
                        <button
                          type="button"
                          onClick={() => onDeleteItem(order, oi)}
                          title={t("common.delete")}
                          className="p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  {oi.note && (
                    <div className={cn(
                      "flex items-center gap-1 text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-full w-fit",
                      isAllergyNote(oi.note) ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-[var(--color-danger)]/25" : "bg-[var(--color-accent-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/25"
                    )}>
                      {isAllergyNote(oi.note) && <AlertTriangle size={9} />}
                      {oi.note}
                    </div>
                  )}
                </div>
              ))}
              <div className="border-t border-[var(--color-border)] pt-2 flex justify-between font-bold text-[var(--color-primary)]">
                <span>{t("common.total")}</span>
                <span>${orderTotal(order).toFixed(2)}</span>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => printOrderReceipt(order)}
                  className="w-full gap-2 border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
                >
                  <Printer size={14} /> {t("cashier.printReceipt")}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
