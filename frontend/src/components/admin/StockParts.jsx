import { useEffect, useRef, useState } from "react"
import { Search, Plus, Eye, Pencil, Trash2, Package, AlertTriangle, Layers, ImagePlus, X, ChefHat, Coffee, Store, Truck, Check } from "lucide-react"
import {
  Button, Badge, Input, Label, Card,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui"
import { cn, imageUrl, deleteErrorMessage } from "@/lib/utils"
import { useLang } from "@/i18n/LanguageContext"

export function stockStatus(item) {
  if (item.min_level == null) return "InStock"
  return Number(item.quantity) < Number(item.min_level) ? "LowStock" : "InStock"
}

export const STOCK_TYPES = {
  kitchen: { labelKey: "stock.kitchen", label: "Kitchen", icon: ChefHat, color: "bg-[var(--color-flame-muted)] text-[var(--color-flame)]" },
  barista: { labelKey: "stock.barista", label: "Barista", icon: Coffee, color: "bg-[var(--color-accent-muted)] text-[var(--color-warning)]" },
  both: { labelKey: "stock.bothShared", label: "Both", icon: Store, color: "bg-[var(--color-primary-muted)] text-[var(--color-primary)]" },
}

export function StockTypeBadge({ type }) {
  const { t } = useLang()
  const cfg = STOCK_TYPES[type] || STOCK_TYPES.both
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
      <Icon size={11} /> {t(cfg.labelKey) || cfg.label}
    </span>
  )
}

export function stockImageUrl(item) {
  return imageUrl(item?.image_url)
}

export function NoPhoto({ size = 64, className = "rounded-lg", iconClassName = "text-[var(--color-primary)]/50" }) {
  return (
    <div
      className={cn("bg-[var(--color-primary-muted)] flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Package size={size / 2.5} className={iconClassName} />
    </div>
  )
}

export function StockImage({
  item,
  size = 64,
  className = "rounded-lg",
  placeholderClassName,
  iconClassName = "text-[var(--color-primary)]/50",
}) {
  const src = stockImageUrl(item)
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) {
    return (
      <NoPhoto
        size={size}
        className={cn(className, placeholderClassName)}
        iconClassName={iconClassName}
      />
    )
  }

  return (
    <img
      src={src}
      alt={item?.item_name || "Stock item"}
      onError={() => setFailedSrc(src)}
      className={cn("object-cover shrink-0", className)}
      style={{ width: size, height: size }}
    />
  )
}

export function StockImagePicker({ preview, onSelect, onClear }) {
  const { t } = useLang()
  const inputRef = useRef(null)
  const [failedPreview, setFailedPreview] = useState(null)

  useEffect(() => {
    setFailedPreview(null)
  }, [preview])

  const hasValidPreview = Boolean(preview && failedPreview !== preview)

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
        }}
      />
      {hasValidPreview ? (
        <div className="relative w-40 h-40 aspect-square mx-auto rounded-2xl overflow-hidden border border-[var(--color-border)] group">
          <img
            src={preview}
            alt="preview"
            onError={() => setFailedPreview(preview)}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            <span className="text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-lg">
              {t("menu.changePhoto")}
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-40 h-40 aspect-square mx-auto rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] flex flex-col items-center justify-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)]/40 transition-all cursor-pointer"
        >
          <ImagePlus size={24} />
          <span className="text-xs font-medium">{t("menu.clickToUpload")}</span>
          <span className="text-[10px] text-[var(--color-muted)]">1:1 Square</span>
        </button>
      )}
    </div>
  )
}

export function StockStats({ stockItems, lowStockCount, unitNames, stockOrdersCount = 0 }) {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: t("stock.totalItem"), value: stockItems.length, sub: t("stock.inInventory"), icon: Package, color: "text-[var(--color-primary)]" },
        { label: t("stock.lowStock"), value: lowStockCount, sub: t("stock.lowStockSub"), icon: AlertTriangle, color: "text-[var(--color-warning)]" },
        { label: t("stock.units"), value: unitNames.length, sub: t("stock.unitTypes"), icon: Layers, color: "text-[var(--color-info)]" },
        { label: t("stock.purchaseOrders"), value: stockOrdersCount, sub: t("stock.supplierOrders"), icon: Truck, color: "text-[var(--color-plum)]" },
      ].map(({ label, value, sub, icon: Icon, color }) => (
        <Card key={label} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <Icon size={16} className={color} />
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)] mb-1">{value}</div>
          <div className="text-xs text-[var(--color-muted)]">{sub}</div>
        </Card>
      ))}
    </div>
  )
}

export function StockFormFields({ form, setForm, units, imagePreview, onImageSelect, onImageClear }) {
  const { t } = useLang()
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("stock.photo")}</Label>
        <StockImagePicker preview={imagePreview} onSelect={onImageSelect} onClear={onImageClear} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("stock.itemName")}</Label>
        <Input value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("stock.quantity")}</Label>
        <Input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("stock.unit")}</Label>
        <Select value={form.unit_id ? String(form.unit_id) : ""} onValueChange={v => setForm(p => ({ ...p, unit_id: parseInt(v) }))}>
          <SelectTrigger><SelectValue placeholder={t("stock.selectUnitPlaceholder")} /></SelectTrigger>
          <SelectContent>{units.map(u => <SelectItem key={u.unit_id} value={String(u.unit_id)}>{u.unit_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t("stock.minLevel")}</Label>
        <Input type="number" value={form.min_level} onChange={e => setForm(p => ({ ...p, min_level: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("stock.forStation")}</Label>
        <Select value={form.stock_type || "both"} onValueChange={v => setForm(p => ({ ...p, stock_type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="kitchen">{t("stock.kitchen")}</SelectItem>
            <SelectItem value="barista">{t("stock.barista")}</SelectItem>
            <SelectItem value="both">{t("stock.bothShared")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function StockTable({
  items, isLoading, search, setSearch, catFilter, setCatFilter, typeFilter, setTypeFilter,
  lowOnly, setLowOnly, lowStockCount = 0, unitNames,
  onAddUnit, onAddQty, onView, onEdit, onDelete,
}) {
  const { t } = useLang()
  return (
    <Card>
      <div className="p-5 pb-4 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-semibold text-[var(--color-primary)]">{t("stock.inventoryList")}</div>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">{t("stock.manageAllStock")}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLowOnly(!lowOnly)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
              lowOnly
                ? "bg-[var(--color-danger)] text-white border-[var(--color-danger)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-warning)]"
            )}
          >
            <AlertTriangle size={13} />
            {t("stock.lowStockOnly")} ({lowStockCount})
          </button>
          <Button variant="outline" size="sm" onClick={onAddUnit} className="gap-1.5">
            <Layers size={13} /> {t("stock.manageUnits")}
          </Button>
        </div>
      </div>
      <div className="p-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder={t("stock.searchPlaceholder")} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("stock.allStations")}</SelectItem>
            <SelectItem value="kitchen">{t("stock.kitchen")}</SelectItem>
            <SelectItem value="barista">{t("stock.barista")}</SelectItem>
            <SelectItem value="both">{t("stock.bothShared")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All categories">{t("stock.allUnits")}</SelectItem>
            {unitNames.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="px-2 pb-2">
        {isLoading ? (
          <div className="text-center py-10 text-sm text-[var(--color-muted)]">{t("stock.loadingStock")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead>{t("stock.itemName")}</TableHead>
                <TableHead>{t("stock.quantity")}</TableHead>
                <TableHead>{t("stock.status")}</TableHead>
                <TableHead>{t("stock.forStation")}</TableHead>
                <TableHead>{t("stock.minLevel")}</TableHead>
                <TableHead>{t("stock.unit")}</TableHead>
                <TableHead>{t("stock.lastUpdated")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.stock_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <StockImage item={item} size={64} className="rounded-lg" />
                      <span>{item.item_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{Number(item.quantity)} {item.unit?.unit_name}</TableCell>
                  <TableCell>
                    <Badge variant={stockStatus(item) === "InStock" ? "success" : "danger"}>
                      {stockStatus(item) === "InStock" ? t("stock.inStockStatus") : t("stock.lowStock")}
                    </Badge>
                  </TableCell>
                  <TableCell><StockTypeBadge type={item.stock_type} /></TableCell>
                  <TableCell className="text-[var(--color-muted)]">{item.min_level != null ? `${Number(item.min_level)} ${item.unit?.unit_name}` : "—"}</TableCell>
                  <TableCell className="text-[var(--color-muted)]">{item.unit?.unit_name}</TableCell>
                  <TableCell className="text-[var(--color-muted)]">{item.last_updated ? new Date(item.last_updated).toLocaleDateString("en-GB") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onAddQty(item)} className="p-1.5 rounded-lg hover:bg-[var(--color-primary-muted)] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors" title={t("stock.addQuantity")}><Plus size={14} /></button>
                      <button onClick={() => onView(item)} className="p-1.5 rounded-lg hover:bg-[var(--color-info-muted)] text-[var(--color-muted)] hover:text-[var(--color-info)] transition-colors"><Eye size={14} /></button>
                      <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-[var(--color-accent-muted)] text-[var(--color-muted)] hover:text-[var(--color-warning)] transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => onDelete(item.stock_id)} className="p-1.5 rounded-lg hover:bg-[var(--color-danger-muted)] text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-[var(--color-muted)] py-8">{t("stock.noStockFound")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  )
}

export function StockOrdersCard({ stockOrders = [], isLoading, onNewOrder, onUpdateStatus, updatingId }) {
  const { t } = useLang()
  const statusBadge = {
    Pending: "outline",
    Ordered: "warning",
    Received: "success",
  }

  return (
    <Card>
      <div className="p-5 pb-4 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-semibold text-[var(--color-primary)]">{t("stock.poTitle")}</div>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">
            {t("stock.poSub")}
          </div>
        </div>
        <Button size="sm" onClick={onNewOrder} className="gap-1.5">
          <Plus size={14} /> {t("stock.newPo")}
        </Button>
      </div>

      <div className="px-2 pb-2">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-[var(--color-muted)]">{t("stock.loadingPos")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead>{t("stock.poNum")}</TableHead>
                <TableHead>{t("stock.invoice")}</TableHead>
                <TableHead>{t("stock.stockItem")}</TableHead>
                <TableHead>{t("stock.supplier")}</TableHead>
                <TableHead>{t("stock.quantity")}</TableHead>
                <TableHead>{t("stock.placedBy")}</TableHead>
                <TableHead>{t("stock.status")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockOrders.map(po => (
                <TableRow key={po.stock_order_id}>
                  <TableCell className="font-semibold">PO-{String(po.stock_order_id).padStart(3, "0")}</TableCell>
                  <TableCell className="text-[var(--color-muted)]">{po.invoice || "—"}</TableCell>
                  <TableCell className="font-medium">{po.stock?.item_name || `#${po.stock_id}`}</TableCell>
                  <TableCell className="text-[var(--color-muted)]">{po.supplier?.supplier_name || `#${po.supplier_id}`}</TableCell>
                  <TableCell className="font-semibold">{Number(po.quantity)}</TableCell>
                  <TableCell className="text-[var(--color-muted)]">{po.user?.username || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadge[po.status] || "outline"}>{po.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {po.status === "Received" ? (
                      <span className="text-xs text-[var(--color-primary)] font-medium inline-flex items-center gap-1">
                        <Check size={13} /> {t("stock.stockAdded")}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {po.status === "Pending" && (
                          <button
                            disabled={updatingId === po.stock_order_id}
                            onClick={() => onUpdateStatus(po.stock_order_id, "Ordered")}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
                          >
                            {t("stock.markOrdered")}
                          </button>
                        )}
                        <button
                          disabled={updatingId === po.stock_order_id}
                          onClick={() => onUpdateStatus(po.stock_order_id, "Received")}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
                        >
                          {t("stock.receiveStock")}
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {stockOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-[var(--color-muted)] py-8">
                    {t("stock.noPos")}
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

export function StockOrderDialog({ open, onClose, form, setForm, stockItems = [], suppliers = [], errorMsg, saving, onSubmit }) {
  const { t } = useLang()
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("stock.newPo")}</DialogTitle>
          <DialogDescription>{t("stock.poDialogDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>{t("stock.stockItem")}</Label>
            <Select value={form.stock_id ? String(form.stock_id) : ""} onValueChange={v => setForm(f => ({ ...f, stock_id: parseInt(v) }))}>
              <SelectTrigger><SelectValue placeholder={t("stock.selectStockItem")} /></SelectTrigger>
              <SelectContent>
                {stockItems.map(s => (
                  <SelectItem key={s.stock_id} value={String(s.stock_id)}>
                    {s.item_name} ({Number(s.quantity)} {s.unit?.unit_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("stock.supplier")}</Label>
            <Select value={form.supplier_id ? String(form.supplier_id) : ""} onValueChange={v => setForm(f => ({ ...f, supplier_id: parseInt(v) }))}>
              <SelectTrigger><SelectValue placeholder={t("stock.selectSupplier")} /></SelectTrigger>
              <SelectContent>
                {suppliers.map(sup => (
                  <SelectItem key={sup.supplier_id} value={String(sup.supplier_id)}>
                    {sup.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("stock.qtyToOrder")}</Label>
            <Input
              type="number"
              min="1"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="e.g. 10"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("stock.invoiceRef")}</Label>
            <Input
              value={form.invoice}
              onChange={e => setForm(f => ({ ...f, invoice: e.target.value }))}
              placeholder="e.g. INV-2026-001"
            />
          </div>
        </div>
        {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 mt-3">{errorMsg}</div>}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? t("common.saving") : t("stock.placeOrder")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function StockFormDialog({ open, onClose, title, description, form, setForm, units, imagePreview, onImageSelect, onImageClear, errorMsg, saving, onSubmit, submitLabel }) {
  const { t } = useLang()
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-2"><StockFormFields form={form} setForm={setForm} units={units}
          imagePreview={imagePreview} onImageSelect={onImageSelect} onImageClear={onImageClear} /></div>
        {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 mt-3">{errorMsg}</div>}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? t("common.saving") : submitLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function StockViewDialog({ item, onClose }) {
  const { t } = useLang()
  return (
    <Dialog open={!!item} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        {item && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <StockImage item={item} size={64} className="rounded-2xl" iconClassName="text-[var(--color-primary)]" />
              <div>
                <div className="font-semibold text-[var(--color-text)]">{item.item_name}</div>
                <div className="text-xs text-[var(--color-muted)]">{t("stock.viewTitle")}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t("stock.quantity"), value: `${Number(item.quantity)} ${item.unit?.unit_name}`, color: "bg-[var(--color-primary-muted)]" },
                { label: t("stock.minLevel"), value: item.min_level != null ? `${Number(item.min_level)} ${item.unit?.unit_name}` : "—", color: "bg-[var(--color-accent-muted)]" },
                { label: t("stock.unit"), value: item.unit?.unit_name, color: "bg-[var(--color-info-muted)]" },
                { label: t("stock.status"), value: stockStatus(item) === "InStock" ? t("stock.inStockStatus") : t("stock.lowStock"), color: "bg-[var(--color-primary-muted)]" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-xl p-3 ${color}`}>
                  <div className="text-xs text-[var(--color-muted)] mb-1">{label}</div>
                  <div className="font-semibold text-sm text-[var(--color-text)]">{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3 bg-[var(--color-primary-muted)] mt-1">
              <div className="text-xs text-[var(--color-muted)] mb-1">{t("stock.lastUpdated")}</div>
              <div className="font-semibold text-sm text-[var(--color-text)]">{item.last_updated ? new Date(item.last_updated).toLocaleString() : "—"}</div>
            </div>
            <Button variant="outline" className="w-full mt-2" onClick={onClose}>{t("common.back")}</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AddQtyDialog({ item, addQty, setAddQty, errorMsg, saving, onConfirm, onClose }) {
  const { t } = useLang()
  return (
    <Dialog open={!!item} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>{t("stock.addQtyTitle")}</DialogTitle>
              <DialogDescription>{t("stock.addQtyDesc")} - {item.item_name} ({t("stock.current")}: {Number(item.quantity)} {item.unit?.unit_name})</DialogDescription>
            </DialogHeader>
            <Input value={addQty} onChange={e => setAddQty(e.target.value)} type="number" placeholder={t("stock.additionalQty")} className="mt-2" />
            {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 mt-3">{errorMsg}</div>}
            <div className="flex gap-2 justify-end mt-3">
              <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
              <Button onClick={onConfirm} disabled={saving}>{saving ? t("common.saving") : t("common.confirm")}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AddUnitDialog({
  open, newUnitName, setNewUnitName, errorMsg, saving, onConfirm, onClose,
  units = [], onUpdateUnit, onDeleteUnit,
}) {
  const { t } = useLang()
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState("")
  const [rowBusy, setRowBusy] = useState(false)
  const [rowError, setRowError] = useState("")

  const handleSaveEdit = async (id) => {
    if (!editValue.trim()) return
    setRowBusy(true)
    setRowError("")
    try {
      await onUpdateUnit(id, editValue.trim())
      setEditingId(null)
    } catch (err) {
      setRowError(err?.response?.data?.message || "Failed to update unit.")
    } finally {
      setRowBusy(false)
    }
  }

  const handleDelete = async (id) => {
    setRowBusy(true)
    setRowError("")
    try {
      await onDeleteUnit(id)
    } catch (err) {
      setRowError(deleteErrorMessage(err, t))
    } finally {
      setRowBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("stock.manageUnitsTitle")}</DialogTitle>
          <DialogDescription>{t("stock.manageUnitsDesc")}</DialogDescription>
        </DialogHeader>

        {units.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] mt-1">
            {units.map(u => (
              <div key={u.unit_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                {editingId === u.unit_id ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <button
                      onClick={() => handleSaveEdit(u.unit_id)}
                      disabled={rowBusy}
                      className="px-2 py-1 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium"
                    >
                      {t("common.confirm")}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={rowBusy}
                      className="px-2 py-1 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-muted)]"
                    >
                      {t("common.cancel")}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--color-text)] font-medium">{u.unit_name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(u.unit_id); setEditValue(u.unit_name); setRowError("") }}
                        className="p-1 rounded-lg hover:bg-[var(--color-accent-muted)] text-[var(--color-muted)] hover:text-[var(--color-warning)] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(u.unit_id)}
                        disabled={rowBusy}
                        className="p-1 rounded-lg hover:bg-[var(--color-danger-muted)] text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {rowError && (
          <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 mt-2">
            {rowError}
          </div>
        )}

        <div className="space-y-1.5 mt-2">
          <Label>{t("stock.newUnitName")}</Label>
          <Input value={newUnitName} onChange={e => setNewUnitName(e.target.value)} placeholder="e.g. liter, kg, pcs" />
        </div>
        {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 mt-3">{errorMsg}</div>}
        <div className="flex gap-2 justify-end mt-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.close")}</Button>
          <Button onClick={onConfirm} disabled={saving}>{saving ? t("common.saving") : t("stock.addUnit")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}