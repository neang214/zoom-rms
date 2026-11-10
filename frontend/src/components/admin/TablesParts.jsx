import { useState, useEffect } from "react"
import {
  Button, Badge, Card,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui"
import { Eye, Pencil, Trash2, QrCode, Printer, RefreshCw, Copy, Check, RotateCcw, Archive } from "lucide-react"
import TableQRCode, { buildTableOrderUrl } from "../TableQRCode"
import { useLang } from "@/i18n/LanguageContext"
import { menuItemName } from "@/lib/utils"

export function printElement(elementId) {
  const el = document.getElementById(elementId)
  if (!el) return
  const win = window.open("", "_blank", "width=800,height=600")
  if (!win) {
    window.print()
    return
  }
  win.document.write(`
    <html>
      <head>
        <title>Print QR Codes</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #111827; }
          .qr-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
          .qr-grid > * { border: 1px solid #d1d5db; border-radius: 16px; padding: 16px; text-align: center; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="qr-grid">${el.innerHTML}</div>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 300)
}

function itemTotal(order) {
  if (!order?.order_items) return 0
  return order.order_items.reduce((sum, oi) => sum + Number(oi.unit_price) * oi.quantity, 0)
}

export function TablesList({
  tables, isLoading, onQr, onView, onEdit, onDelete,
  archivedMode = false, onRestore, restoringId = null,
}) {
  const { t } = useLang()
  return (
    <Card>
      <div className="p-5 pb-4 border-b border-[var(--color-border)]">
        <div className="font-semibold text-[var(--color-primary)]">
          {archivedMode ? t("tables.archivedTab") : t("tables.restaurantTables")}
        </div>
        <div className="text-xs text-[var(--color-muted)] mt-0.5">
          {archivedMode ? t("tables.archivedBanner") : t("tables.manageDining")}
        </div>
      </div>
      <div className="p-2">
        {isLoading ? (
          <div className="text-center py-10 text-sm text-[var(--color-muted)]">{t("tables.loading")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead>{t("tables.tableNum")}</TableHead>
                <TableHead>{t("tables.capacity")}</TableHead>
                <TableHead>{t("tables.status")}</TableHead>
                <TableHead>{t("tables.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tables || []).map(tb => (
                <TableRow key={tb.table_id}>
                  <TableCell className="font-semibold">{tb.table_number}</TableCell>
                  <TableCell className="text-[var(--color-muted)]">{tb.capacity} {t("tables.guests")}</TableCell>
                  <TableCell>
                    {archivedMode ? (
                      <Badge variant="outline">
                        <Archive size={11} />
                        {t("tables.archivedBadge")}
                      </Badge>
                    ) : (
                      <Badge variant={tb.is_available ? "success" : "warning"}>
                        {tb.is_available ? t("tables.available") : t("tables.occupied")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {archivedMode ? (
                      <button
                        type="button"
                        onClick={() => onRestore?.(tb)}
                        disabled={restoringId === tb.table_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw size={12} className={restoringId === tb.table_id ? "animate-spin" : ""} />
                        {t("tables.restore")}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onQr(tb)} title={t("tables.tableQrCode")} className="p-1.5 rounded-lg hover:bg-[var(--color-primary-muted)] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"><QrCode size={14} /></button>
                        <button onClick={() => onView(tb)} title={t("tables.activeOrder")} className="p-1.5 rounded-lg hover:bg-[var(--color-info-muted)] text-[var(--color-muted)] hover:text-[var(--color-info)] transition-colors cursor-pointer"><Eye size={14} /></button>
                        <button onClick={() => onEdit(tb)} title={t("tables.editTitle")} className="p-1.5 rounded-lg hover:bg-[var(--color-accent-muted)] text-[var(--color-muted)] hover:text-[var(--color-warning)] transition-colors cursor-pointer"><Pencil size={14} /></button>
                        <button onClick={() => onDelete(tb.table_id)} title={t("common.delete")} className="p-1.5 rounded-lg hover:bg-[var(--color-danger-muted)] text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!tables || tables.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-[var(--color-muted)] py-8">
                    {archivedMode ? t("tables.noArchived") : t("tables.noTablesFound")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  )
}

export function TableFormDialog({ open, onClose, title, description, form, setForm, showStatus, errorMsg, saving, onSubmit, submitLabel }) {
  const { t } = useLang()
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>{t("tables.tableNum")}</Label>
            <Input value={form.table_number} onChange={e => setForm(f => ({ ...f, table_number: e.target.value }))} placeholder="e.g. T-012" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("tables.capacity")}{showStatus ? "" : ` (${t("tables.guests")})`}</Label>
            <Input value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} type="number" placeholder="4" />
          </div>
          {showStatus && (
            <div className="space-y-1.5">
              <Label>{t("tables.status")}</Label>
              <Select value={form.is_available ? "Available" : "Occupied"} onValueChange={v => setForm(f => ({ ...f, is_available: v === "Available" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">{t("tables.available")}</SelectItem>
                  <SelectItem value="Occupied">{t("tables.occupied")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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

export function TableViewDialog({ table, order, loading, onClose }) {
  const { t, lang } = useLang()
  return (
    <Dialog open={!!table} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        {table && (
          <>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("tables.tableOrders")} - {table.table_number}</h2>
                <p className="text-sm text-[var(--color-muted)]">{t("tables.viewActiveOrder")}</p>
              </div>
              <div className="border border-[var(--color-primary)]/40 rounded-lg px-2 py-1">
                <span className="font-display font-bold text-xs text-[var(--color-primary)]">ZOOM</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 my-3">
              {[
                { label: t("tables.status"), value: table.is_available ? t("tables.available") : t("tables.occupied") },
                { label: t("tables.orderTotal"), value: `$${itemTotal(order).toFixed(2)}`, green: true },
                { label: t("tables.capacity"), value: `${table.capacity} ${t("tables.guests")}`, green: true },
              ].map(({ label, value, green }) => (
                <div key={label} className="rounded-xl border border-[var(--color-border)] p-3 text-center">
                  <div className="text-xs text-[var(--color-muted)] mb-1">{label}</div>
                  <div className={`text-lg font-bold ${green ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="font-semibold text-[var(--color-text)] mb-3">{t("tables.activeOrder")}</div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center text-[var(--color-muted)] text-sm py-8">{t("common.loading")}</div>
              ) : !order ? (
                <div className="text-center text-[var(--color-muted)] text-sm py-8">{t("tables.noActiveOrder")}</div>
              ) : (
                <div className="border border-[var(--color-border)] rounded-xl p-4">
                  <div className="font-medium text-[var(--color-text)] text-sm">{t("common.order")} #{order.order_id}</div>
                  <div className="text-xs text-[var(--color-muted)] mb-3">{new Date(order.order_date).toLocaleString()} · {order.status}</div>
                  {order.order_items?.map((oi) => (
                    <div key={oi.order_item_id} className="flex gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text)] truncate">{menuItemName(oi.menu_item, lang)}</div>
                        <div className="flex justify-between mt-1">
                          <span className="text-sm text-[var(--color-text)]">${Number(oi.unit_price).toFixed(2)}</span>
                          <span className="text-sm text-[var(--color-muted)]">{t("common.qty")}: {oi.quantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-[var(--color-border)] pt-3">
                    <div className="flex justify-between text-sm font-medium text-[var(--color-text)]">
                      <span>{t("common.total")}</span>
                      <span>${itemTotal(order).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Button variant="dark" className="w-full mt-3" onClick={onClose}>{t("common.close")}</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function SingleQrDialog({ table, onClose, onRegenerate, regenerating, onPrint }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [table?.table_id, table?.qr_token])

  const orderUrl = table ? buildTableOrderUrl(table) : ""
  const handleCopy = async () => {
    if (!orderUrl) return
    try {
      await navigator.clipboard.writeText(orderUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Dialog open={!!table} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        {table && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle>{t("tables.tableQrCode")}</DialogTitle>
              <DialogDescription>{t("tables.scanToOrder")} {table.table_number}</DialogDescription>
            </DialogHeader>
            <div id="single-qr-print" className="flex justify-center py-2">
              <TableQRCode table={table} size={180} />
            </div>
            <div className="text-center text-xs text-[var(--color-muted)] break-all px-2 bg-[var(--color-background)] rounded-xl py-2 border border-[var(--color-border)]">
              {orderUrl}
            </div>
            <div className="flex flex-wrap gap-2 justify-end mt-2">
              <Button variant="outline" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check size={14} className="text-[var(--color-primary)]" /> : <Copy size={14} />}
                {copied ? t("tables.copied") : t("tables.copyLink")}
              </Button>
              <Button variant="outline" onClick={() => onRegenerate(table.table_id)} disabled={regenerating} className="gap-1.5">
                <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
                {regenerating ? t("tables.regenerating") : t("tables.regenerateQr")}
              </Button>
              <Button onClick={() => onPrint("single-qr-print")} className="gap-1.5">
                <Printer size={14} /> {t("tables.print")}
              </Button>
              <Button variant="ghost" onClick={onClose}>{t("common.close")}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function PrintAllQrDialog({ open, onClose, tables, onPrint }) {
  const { t } = useLang()
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("tables.allTableQr")}</DialogTitle>
          <DialogDescription>{t("tables.printOnePerTable")}</DialogDescription>
        </DialogHeader>
        <div id="all-qr-print" className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto py-2">
          {tables.map(t => <TableQRCode key={t.table_id} table={t} size={140} />)}
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
          <Button onClick={() => onPrint("all-qr-print")} className="gap-1.5"><Printer size={14} /> {t("tables.printAll")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
