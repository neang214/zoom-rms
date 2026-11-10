import { Pencil, Trash2, Phone, Mail, RotateCcw, Archive } from "lucide-react"
import { Button, Card, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui"
import { useLang } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"

const colors = ["bg-[var(--color-primary-muted)] text-[var(--color-primary)]", "bg-[var(--color-info-muted)] text-[var(--color-info)]", "bg-[var(--color-flame-muted)] text-[var(--color-flame)]", "bg-[var(--color-plum-muted)] text-[var(--color-plum)]"]

export function SupplierGrid({
  suppliers, isLoading, onEdit, onDelete,
  archivedMode = false, onRestore, restoringId = null,
}) {
  const { t } = useLang()
  if (isLoading) return <div className="text-center py-16 text-[var(--color-muted)] text-sm">{t("suppliers.loading")}</div>
  if (suppliers.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-muted)] text-sm">
        {archivedMode ? t("suppliers.noArchived") : t("suppliers.noSuppliers")}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {suppliers.map((sup, idx) => (
        <Card key={sup.supplier_id} className={cn("hover:shadow-md transition-shadow", archivedMode && "opacity-80")}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${colors[idx % colors.length]}`}>
                  {sup.supplier_name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--color-text)] text-sm truncate">{sup.supplier_name}</div>
                  <div className="text-xs text-[var(--color-muted)]">{t("nav.suppliers")} #{sup.supplier_id}</div>
                </div>
              </div>
              {archivedMode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)] shrink-0">
                  <Archive size={10} />
                  {t("suppliers.archivedBadge")}
                </span>
              )}
            </div>

            <div className="space-y-1.5 mb-4">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <Phone size={12} className="text-[var(--color-primary)]" /> {sup.phone || "—"}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <Mail size={12} className="text-[var(--color-primary)]" /> {sup.email || "—"}
              </div>
            </div>

            {archivedMode ? (
              <button
                type="button"
                onClick={() => onRestore?.(sup)}
                disabled={restoringId === sup.supplier_id}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold bg-[var(--color-primary-muted)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw size={13} className={cn(restoringId === sup.supplier_id && "animate-spin")} />
                {t("suppliers.restore")}
              </button>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => onEdit(sup)} className="flex-1 flex items-center justify-center gap-1.5 border border-[var(--color-border)] rounded-xl py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all cursor-pointer">
                  <Pencil size={13} /> {t("common.edit") || "Edit"}
                </button>
                <button type="button" onClick={() => onDelete(sup.supplier_id)} className="flex-1 flex items-center justify-center gap-1.5 border border-[var(--color-danger)]/25 text-[var(--color-danger)] rounded-xl py-2 text-sm font-medium hover:bg-[var(--color-danger-muted)] transition-colors cursor-pointer">
                  <Trash2 size={13} /> {t("common.delete") || "Delete"}
                </button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

export function SupplierFormDialog({ open, onClose, isEdit, title, description, form, setForm, errorMsg, saving, onSubmit, submitLabel }) {
  const { t } = useLang()
  const ph = (text) => (isEdit ? undefined : text)
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>{t("suppliers.name")}</Label>
            <Input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder={ph(t("suppliers.enterName"))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("suppliers.phone")}</Label>
            <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={ph(t("suppliers.enterPhone"))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("suppliers.email")}</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={ph(t("suppliers.enterEmail"))} />
          </div>
        </div>
        {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 mt-3">{errorMsg}</div>}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? t("common.saving") : submitLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
