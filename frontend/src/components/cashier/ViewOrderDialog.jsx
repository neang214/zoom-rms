import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Badge,
} from "@/components/ui"
import { Users, AlertTriangle, Printer, Trash2, Plus, Minus, Pencil, Check, X } from "lucide-react"
import { cn, menuItemName } from "@/lib/utils"
import { formatUSD, formatKHR, orderTotal } from "@/lib/currency"
import { isAllergyNote } from "@/lib/noteTags"
import { printOrderReceipt } from "./orderHelpers"
import { useLang } from "@/i18n/LanguageContext"

const itemStatusBadge = {
  Pending: { variant: "secondary", key: "status.pending" },
  Preparing: { variant: "warning", key: "status.preparing" },
  Ready: { variant: "success", key: "status.ready" },
}

export default function ViewOrderDialog({
  order,
  onClose,
  onDeleteItem,
  onUpdateItemQty,
  onUpdateItemNote,
}) {
  const { t, lang } = useLang()
  const isPaid = order ? (order.is_paid ?? order.status === "Paid") : false
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [errMsg, setErrMsg] = useState("")

  useEffect(() => {
    setEditingNoteId(null)
    setNoteDraft("")
    setErrMsg("")
  }, [order?.order_id])

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

  const total = order ? orderTotal(order) : 0

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("common.order")} #{String(order.order_id).padStart(4, "0")}
              </DialogTitle>
              <DialogDescription>
                {t("common.table")} {order.table?.table_number || "—"} ·{" "}
                {new Date(order.order_date).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            {(order.party_size != null || order.note) && (
              <div className="flex flex-wrap gap-1.5 -mt-1">
                {order.party_size != null && (
                  <Badge variant="blue" className="gap-1">
                    <Users size={11} /> {order.party_size}{" "}
                    {order.party_size !== 1 ? t("history.guests") : t("history.guest")}
                  </Badge>
                )}
                {order.note && (
                  <Badge variant="warning">
                    {t("history.note")}: {order.note}
                  </Badge>
                )}
              </div>
            )}

            <div className="space-y-3">
              {errMsg && (
                <div
                  role="alert"
                  className="text-xs font-medium text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2"
                >
                  {errMsg}
                </div>
              )}

              <div className="divide-y divide-[var(--color-border)]/70 max-h-[45dvh] overflow-y-auto pr-1">
                {order.order_items?.map((oi) => {
                  const canEdit = !isPaid && oi.status === "Pending"
                  const isBusy = busyId === oi.order_item_id
                  const badge = itemStatusBadge[oi.status] || itemStatusBadge.Pending

                  return (
                    <div key={oi.order_item_id} className="py-2.5 first:pt-0 last:pb-0 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-[var(--color-text)] truncate">
                              {menuItemName(oi.menu_item, lang)}
                            </span>
                            {!(canEdit && onUpdateItemQty) && (
                              <span className="text-xs text-[var(--color-muted)] font-semibold">
                                ×{oi.quantity}
                              </span>
                            )}
                            {oi.status && (
                              <Badge variant={badge.variant} className="text-[10px] py-0 px-2">
                                {t(badge.key)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {canEdit && onUpdateItemQty && (
                            <div className="flex items-center gap-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-lg p-0.5">
                              <button
                                type="button"
                                disabled={isBusy || oi.quantity <= 1}
                                onClick={() => handleQtyChange(oi, -1)}
                                aria-label="Decrease quantity"
                                className="w-6 h-6 rounded-md bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-35 cursor-pointer"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="text-xs font-bold min-w-[18px] text-center tabular-nums">
                                {oi.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQtyChange(oi, 1)}
                                aria-label="Increase quantity"
                                className="w-6 h-6 rounded-md bg-[var(--color-primary)] text-white flex items-center justify-center disabled:opacity-35 cursor-pointer"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          )}

                          <span className="font-semibold text-[var(--color-text)] tabular-nums min-w-[56px] text-right">
                            {formatUSD(Number(oi.unit_price) * oi.quantity)}
                          </span>

                          {canEdit && onUpdateItemNote && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(oi.order_item_id)
                                setNoteDraft(oi.note || "")
                              }}
                              title={t("common.edit")}
                              aria-label="Edit item note"
                              className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                            >
                              <Pencil size={13} />
                            </button>
                          )}

                          {onDeleteItem && !isPaid && (
                            <button
                              type="button"
                              onClick={() => onDeleteItem(order, oi)}
                              title={t("common.delete")}
                              aria-label={t("common.delete")}
                              className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {editingNoteId === oi.order_item_id ? (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Input
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder={t("noteTag.freeTextPlaceholder")}
                            className="h-8 text-xs flex-1"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleSaveNote(oi)}
                            aria-label="Save note"
                            className="p-1.5 rounded-lg bg-[var(--color-primary)] text-white cursor-pointer disabled:opacity-50"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setEditingNoteId(null)}
                            aria-label="Cancel"
                            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : oi.note ? (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-medium mt-1.5 px-2 py-0.5 rounded-full",
                            isAllergyNote(oi.note)
                              ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-[var(--color-danger)]/20"
                              : "bg-[var(--color-accent-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/20"
                          )}
                        >
                          {isAllergyNote(oi.note) && <AlertTriangle size={10} />}
                          <span>{oi.note}</span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-[var(--color-border)] pt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                  {t("common.total")}
                </span>
                <div className="text-right tabular-nums">
                  <span className="text-lg font-bold text-[var(--color-primary)]">
                    {formatUSD(total)}
                  </span>
                  <span className="text-xs text-[var(--color-muted)] ml-2">
                    {formatKHR(total)}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => printOrderReceipt(order)}
                className="w-full"
              >
                <Printer size={15} /> {t("cashier.printReceipt")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
