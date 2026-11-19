import { useState, useEffect, useMemo } from "react"
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
import {
  Users,
  AlertTriangle,
  Printer,
  Trash2,
  Plus,
  Minus,
  Pencil,
  Check,
  X,
  Loader2,
  RotateCcw,
} from "lucide-react"
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

  // Local staged drafts — nothing hits the API until cashier confirms
  const [draftQty, setDraftQty] = useState({})
  const [draftNote, setDraftNote] = useState({})
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteInput, setNoteInput] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState("")

  useEffect(() => {
    setDraftQty({})
    setDraftNote({})
    setEditingNoteId(null)
    setNoteInput("")
    setConfirming(false)
    setSaving(false)
    setErrMsg("")
  }, [order?.order_id])

  const getQty = (oi) =>
    draftQty[oi.order_item_id] !== undefined ? draftQty[oi.order_item_id] : oi.quantity

  const getNote = (oi) =>
    draftNote[oi.order_item_id] !== undefined ? draftNote[oi.order_item_id] : (oi.note || "")

  const pendingChanges = useMemo(() => {
    if (!order?.order_items) return []
    const changes = []
    for (const oi of order.order_items) {
      const nextQty =
        draftQty[oi.order_item_id] !== undefined ? draftQty[oi.order_item_id] : oi.quantity
      const origNote = (oi.note || "").trim()
      const nextNote =
        draftNote[oi.order_item_id] !== undefined
          ? draftNote[oi.order_item_id].trim()
          : origNote

      const qtyChanged = nextQty !== oi.quantity
      const noteChanged = nextNote !== origNote

      if (qtyChanged || noteChanged) {
        changes.push({
          oi,
          qtyChanged,
          fromQty: oi.quantity,
          toQty: nextQty,
          noteChanged,
          fromNote: origNote,
          toNote: nextNote,
        })
      }
    }
    return changes
  }, [order, draftQty, draftNote])

  const hasChanges = pendingChanges.length > 0

  const originalTotal = order ? orderTotal(order) : 0
  const draftTotal = useMemo(() => {
    if (!order?.order_items) return 0
    return order.order_items.reduce(
      (sum, oi) => sum + Number(oi.unit_price || 0) * getQty(oi),
      0
    )
  }, [order, draftQty])

  const stageQtyDelta = (oi, delta) => {
    const next = Math.max(1, getQty(oi) + delta)
    setErrMsg("")
    setDraftQty((prev) => {
      const copy = { ...prev }
      if (next === oi.quantity) delete copy[oi.order_item_id]
      else copy[oi.order_item_id] = next
      return copy
    })
  }

  const stageNote = (oi) => {
    const trimmed = noteInput.trim()
    const orig = (oi.note || "").trim()
    setErrMsg("")
    setDraftNote((prev) => {
      const copy = { ...prev }
      if (trimmed === orig) delete copy[oi.order_item_id]
      else copy[oi.order_item_id] = trimmed
      return copy
    })
    setEditingNoteId(null)
  }

  const discardDrafts = () => {
    setDraftQty({})
    setDraftNote({})
    setEditingNoteId(null)
    setConfirming(false)
    setErrMsg("")
  }

  const handleConfirmUpdates = async () => {
    if (!hasChanges || saving) return
    setSaving(true)
    setErrMsg("")
    try {
      for (const ch of pendingChanges) {
        if (ch.qtyChanged && onUpdateItemQty) {
          await onUpdateItemQty(ch.oi.order_item_id, ch.toQty)
        }
        if (ch.noteChanged && onUpdateItemNote) {
          await onUpdateItemNote(ch.oi.order_item_id, ch.toNote || null)
        }
      }
      setDraftQty({})
      setDraftNote({})
      setConfirming(false)
    } catch (err) {
      setErrMsg(err?.response?.data?.message || t("common.failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && !saving && onClose()}>
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

            {confirming ? (
              /* Explicit Cashier Confirmation View */
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-accent-muted)]/60 p-3.5 text-xs text-[var(--color-warning)] font-medium">
                  {lang === "km"
                    ? "សូមពិនិត្យ និងបញ្ជាក់ការកែប្រែខាងក្រោមមុនពេលរក្សាទុក៖"
                    : "Please review and confirm these updates before saving:"}
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]/70 max-h-60 overflow-y-auto">
                  {pendingChanges.map((ch) => (
                    <div key={ch.oi.order_item_id} className="p-3 text-xs space-y-1">
                      <div className="font-semibold text-sm text-[var(--color-text)]">
                        {menuItemName(ch.oi.menu_item, lang)}
                      </div>
                      {ch.qtyChanged && (
                        <div className="text-[var(--color-text-secondary)]">
                          {t("common.qty")}:{" "}
                          <span className="line-through text-[var(--color-muted)]">
                            ×{ch.fromQty}
                          </span>{" "}
                          →{" "}
                          <span className="font-bold text-[var(--color-primary)]">
                            ×{ch.toQty}
                          </span>
                        </div>
                      )}
                      {ch.noteChanged && (
                        <div className="text-[var(--color-text-secondary)]">
                          {t("history.note")}:{" "}
                          <span className="font-semibold text-[var(--color-warning)]">
                            {ch.toNote || (lang === "km" ? "(លុបចំណាំ)" : "(cleared)")}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm px-1">
                  <span className="text-[var(--color-muted)] font-medium">
                    {t("common.total")}
                  </span>
                  <div className="tabular-nums flex items-baseline gap-2">
                    {Math.abs(draftTotal - originalTotal) > 0.001 && (
                      <span className="text-xs line-through text-[var(--color-muted)]">
                        {formatUSD(originalTotal)}
                      </span>
                    )}
                    <span className="font-bold text-base text-[var(--color-primary)]">
                      {formatUSD(draftTotal)}
                    </span>
                  </div>
                </div>

                {errMsg && (
                  <div
                    role="alert"
                    className="text-xs font-medium text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2"
                  >
                    {errMsg}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setConfirming(false)}
                    className="flex-1"
                  >
                    {t("common.back")}
                  </Button>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={handleConfirmUpdates}
                    className="flex-[1.4]"
                  >
                    {saving ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    <span>
                      {saving
                        ? t("common.updating")
                        : lang === "km"
                          ? "បញ្ជាក់ការកែប្រែ"
                          : "Confirm Update"}
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Order Details & Staged Edit View */
              <>
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
                      const curQty = getQty(oi)
                      const curNote = getNote(oi)
                      const qtyDirty = curQty !== oi.quantity
                      const noteDirty = curNote.trim() !== (oi.note || "").trim()
                      const rowDirty = qtyDirty || noteDirty
                      const badge = itemStatusBadge[oi.status] || itemStatusBadge.Pending

                      return (
                        <div
                          key={oi.order_item_id}
                          className={cn(
                            "py-2.5 first:pt-0 last:pb-0 text-sm transition-colors",
                            rowDirty &&
                              "bg-[var(--color-primary-muted)]/35 -mx-2 px-2 rounded-xl"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-[var(--color-text)] truncate">
                                  {menuItemName(oi.menu_item, lang)}
                                </span>
                                {!(canEdit && onUpdateItemQty) && (
                                  <span className="text-xs text-[var(--color-muted)] font-semibold">
                                    ×{curQty}
                                  </span>
                                )}
                                {oi.status && (
                                  <Badge variant={badge.variant} className="text-[10px] py-0 px-2">
                                    {t(badge.key)}
                                  </Badge>
                                )}
                                {rowDirty && (
                                  <span className="text-[10px] font-bold text-[var(--color-primary)]">
                                    {lang === "km" ? "• បានកែ" : "• Edited"}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {canEdit && onUpdateItemQty && (
                                <div className="flex items-center gap-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-lg p-0.5">
                                  <button
                                    type="button"
                                    disabled={curQty <= 1}
                                    onClick={() => stageQtyDelta(oi, -1)}
                                    aria-label="Decrease quantity"
                                    className="w-6 h-6 rounded-md bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-35 cursor-pointer"
                                  >
                                    <Minus size={11} />
                                  </button>
                                  <span className="text-xs font-bold min-w-[18px] text-center tabular-nums">
                                    {curQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => stageQtyDelta(oi, 1)}
                                    aria-label="Increase quantity"
                                    className="w-6 h-6 rounded-md bg-[var(--color-primary)] text-white flex items-center justify-center cursor-pointer"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>
                              )}

                              <span className="font-semibold text-[var(--color-text)] tabular-nums min-w-[56px] text-right">
                                {formatUSD(Number(oi.unit_price) * curQty)}
                              </span>

                              {canEdit && onUpdateItemNote && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteId(oi.order_item_id)
                                    setNoteInput(curNote)
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
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                placeholder={t("noteTag.freeTextPlaceholder")}
                                className="h-8 text-xs flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => stageNote(oi)}
                                aria-label="Apply note draft"
                                className="p-1.5 rounded-lg bg-[var(--color-primary)] text-white cursor-pointer"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingNoteId(null)}
                                aria-label="Cancel note edit"
                                className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : curNote ? (
                            <div
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px] font-medium mt-1.5 px-2 py-0.5 rounded-full",
                                isAllergyNote(curNote)
                                  ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-[var(--color-danger)]/20"
                                  : "bg-[var(--color-accent-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/20"
                              )}
                            >
                              {isAllergyNote(curNote) && <AlertTriangle size={10} />}
                              <span>{curNote}</span>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>

                  {/* Total Row */}
                  <div className="border-t border-[var(--color-border)] pt-3 flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                      {t("common.total")}
                    </span>
                    <div className="text-right tabular-nums">
                      {hasChanges && Math.abs(draftTotal - originalTotal) > 0.001 && (
                        <span className="text-xs line-through text-[var(--color-muted)] mr-2">
                          {formatUSD(originalTotal)}
                        </span>
                      )}
                      <span className="text-lg font-bold text-[var(--color-primary)]">
                        {formatUSD(draftTotal)}
                      </span>
                      <span className="text-xs text-[var(--color-muted)] ml-2">
                        {formatKHR(draftTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Confirm / Discard Bar When Changes Are Staged */}
                  {hasChanges ? (
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={discardDrafts}
                        className="flex-1"
                      >
                        <RotateCcw size={14} />
                        <span>{lang === "km" ? "បោះបង់ការកែ" : "Discard"}</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="flex-[1.4]"
                      >
                        <Check size={15} />
                        <span>
                          {lang === "km"
                            ? `រក្សាទុកការកែ (${pendingChanges.length})`
                            : `Save Updates (${pendingChanges.length})`}
                        </span>
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => printOrderReceipt(order)}
                      className="w-full"
                    >
                      <Printer size={15} /> {t("cashier.printReceipt")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
