import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button, Input } from "@/components/ui"
import { Users, AlertTriangle, Printer, Trash2, Plus, Minus, Pencil, Check, X } from "lucide-react"
import { cn, menuItemName } from "@/lib/utils"
import { isAllergyNote } from "@/lib/noteTags"
import { orderTotal, printOrderReceipt } from "./orderHelpers"
import { useLang } from "@/i18n/LanguageContext"

export default function ViewOrderDialog({ order, onClose, onDeleteItem, onUpdateItemQty, onUpdateItemNote }) {
  const { t, lang } = useLang()
  const isPaid = order ? (order.is_paid ?? order.status === "Paid") : false
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [errMsg, setErrMsg] = useState("")

  const handleQtyChange = async (oi, delta) => {
    if (!onUpdateItemQty) return
    const next = oi.quantity + delta
    if (next < 1) return
    setBusyId(oi.order_item_id)
    setErrMsg("")
    try {
      await onUpdateItemQty(oi.order_item_id, next)
    } catch (err) {
      setErrMsg(err?.response?.data?.message || t("common.failed"))
    } finally {
      setBusyId(null)
    }
  }

  const handleSaveNote = async (oi) => {
    if (!onUpdateItemNote) return
    setBusyId(oi.order_item_id)
    setErrMsg("")
    try {
      await onUpdateItemNote(oi.order_item_id, noteDraft.trim() || null)
      setEditingNoteId(null)
    } catch (err) {
      setErrMsg(err?.response?.data?.message || t("common.failed"))
    } finally {
      setBusyId(null)
    }
  }

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
            <div className="space-y-2.5">
              {errMsg && (
                <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-lg px-2.5 py-1.5">
                  {errMsg}
                </div>
              )}
              {order.order_items?.map(oi => {
                const canEdit = !isPaid && oi.status === "Pending"
                const isBusy = busyId === oi.order_item_id
                return (
                <div key={oi.order_item_id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--color-text)] min-w-0">
                      {menuItemName(oi.menu_item, lang)}{" "}
                      {!(canEdit && onUpdateItemQty) && (
                        <span className="text-[var(--color-muted)]">x{oi.quantity}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canEdit && onUpdateItemQty && (
                        <div className="flex items-center gap-1 border border-[var(--color-border)] rounded-lg px-1 py-0.5">
                          <button
                            type="button"
                            disabled={isBusy || oi.quantity <= 1}
                            onClick={() => handleQtyChange(oi, -1)}
                            className="p-0.5 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-semibold min-w-[16px] text-center">{oi.quantity}</span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQtyChange(oi, 1)}
                            className="p-0.5 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                      <span className="font-medium">${(Number(oi.unit_price) * oi.quantity).toFixed(2)}</span>
                      {canEdit && onUpdateItemNote && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(oi.order_item_id)
                            setNoteDraft(oi.note || "")
                          }}
                          title="Edit note"
                          className="p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
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
                  {editingNoteId === oi.order_item_id ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Input
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Item note..."
                        className="h-7 text-xs flex-1"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSaveNote(oi)}
                        className="p-1 rounded-md bg-[var(--color-primary)] text-white cursor-pointer disabled:opacity-50"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setEditingNoteId(null)}
                        className="p-1 rounded-md border border-[var(--color-border)] text-[var(--color-muted)] cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : oi.note ? (
                    <div className={cn(
                      "flex items-center gap-1 text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-full w-fit",
                      isAllergyNote(oi.note) ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-[var(--color-danger)]/25" : "bg-[var(--color-accent-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/25"
                    )}>
                      {isAllergyNote(oi.note) && <AlertTriangle size={9} />}
                      {oi.note}
                    </div>
                  ) : null}
                </div>
              )})}
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
