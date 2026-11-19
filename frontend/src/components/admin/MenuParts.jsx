import { useEffect, useMemo, useRef, useState } from "react"
import { ImagePlus, X, Pencil, Trash2, UtensilsCrossed, RotateCcw, Archive, BarChart3, Loader2 } from "lucide-react"
import { cn, imageUrl, menuItemName, deleteErrorMessage, categoryDisplayName } from "@/lib/utils"
import { useLang } from "@/i18n/LanguageContext"
import {
  Button, Input, Label,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui"

export function MenuNoPhoto({ className, iconSize = 28 }) {
  return (
    <div
      className={cn(
        "w-full h-full bg-[var(--color-primary-muted)] flex items-center justify-center text-[var(--color-primary)]/50 select-none",
        className
      )}
    >
      <UtensilsCrossed size={iconSize} />
    </div>
  )
}

export function MenuItemImage({ item, lang, className, iconSize = 28 }) {
  const src = imageUrl(item?.image_url)
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) {
    return <MenuNoPhoto className={className} iconSize={iconSize} />
  }

  return (
    <img
      src={src}
      alt={menuItemName(item, lang)}
      onError={() => setFailedSrc(src)}
      className={cn("w-full h-full object-cover group-hover:scale-105 transition-transform duration-300", className)}
    />
  )
}

export function ImagePicker({ preview, onSelect, onClear }) {
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
          const file = e.target.files?.[0]
          if (file) onSelect(file)
        }}
      />
      {hasValidPreview ? (
        <div className="relative w-36 h-36 aspect-square mx-auto rounded-2xl overflow-hidden border border-[var(--color-border)] group shadow-2xs">
          <img
            src={preview}
            alt="preview"
            onError={() => setFailedPreview(preview)}
            className="w-full h-full object-cover"
          />
          <button type="button" onClick={onClear}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors cursor-pointer">
            <X size={14} />
          </button>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
            <span className="text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-lg">{t("menu.changePhoto")}</span>
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-36 h-36 aspect-square mx-auto rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] flex flex-col items-center justify-center gap-1.5 px-2 text-center text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)]/40 transition-all cursor-pointer">
          <ImagePlus size={22} />
          <span className="text-xs font-medium leading-tight">{t("menu.clickToUpload")}</span>
          <span className="text-[10px] text-[var(--color-muted)]">{t("menu.squareHint")}</span>
        </button>
      )}
    </div>
  )
}

export function FormFields({ form, setForm, categories, isEdit, imagePreview, onImageSelect, onImageClear }) {
  const { t, lang } = useLang()
  return (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <Label>{t("menu.photo")}</Label>
        <ImagePicker preview={imagePreview} onSelect={onImageSelect} onClear={onImageClear} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("menu.itemName")}</Label>
        <Input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} placeholder={t("menu.itemName")} />
      </div>
      <div className="space-y-1.5">
        <Label>
          {t("menu.itemNameKm")}{" "}
          <span className="text-[var(--color-muted)] font-normal">{t("common.optional")}</span>
        </Label>
        <Input value={form.item_name_km || ""} onChange={e => setForm(f => ({ ...f, item_name_km: e.target.value }))} placeholder="ឈ្មោះជាភាសាខ្មែរ" />
        <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">{t("menu.itemNameKmHint")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("menu.category")}</Label>
          <Select value={form.category_id ? String(form.category_id) : ""} onValueChange={v => setForm(f => ({ ...f, category_id: parseInt(v) }))} disabled={isEdit}>
            <SelectTrigger><SelectValue placeholder={t("menu.allCategories")} /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.category_id} value={String(c.category_id)}>{categoryDisplayName(c, lang)}</SelectItem>)}
            </SelectContent>
          </Select>
          {isEdit && <p className="text-[11px] leading-snug text-[var(--color-muted)]">{t("menu.categoryCantChange")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>{t("menu.price")}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-muted)]">$</span>
            <Input
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
              type="number"
              step="0.01"
              className="pl-7"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function MenuCategoryBar({ categories, activeCat, onSelect }) {
  const { t, lang } = useLang()
  return (
    <Select value={activeCat === "All" ? "All" : String(activeCat)} onValueChange={v => onSelect(v === "All" ? "All" : parseInt(v))}>
      <SelectTrigger className="w-48"><SelectValue placeholder={t("menu.allCategories")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="All">{t("menu.allCategories")}</SelectItem>
        {categories.map(cat => (
          <SelectItem key={cat.category_id} value={String(cat.category_id)}>{categoryDisplayName(cat, lang)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function MenuGrid({
  items,
  isLoading,
  categoryName,
  onEdit,
  onDelete,
  onViewSales,
  archivedMode = false,
  onRestore,
  restoringId = null,
}) {
  const { t, lang } = useLang()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden animate-pulse"
          >
            <div className="aspect-[4/3] bg-[var(--color-surface-subtle)]" />
            <div className="p-3.5 space-y-2">
              <div className="h-4 bg-[var(--color-surface-subtle)] rounded w-3/4" />
              <div className="h-3.5 bg-[var(--color-surface-subtle)] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-center py-16 text-[var(--color-muted)] text-sm">
        {archivedMode ? t("menu.noArchived") : t("menu.notFound")}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {(items || []).map((item) => (
        <div
          key={item.menu_item_id}
          onClick={() => onViewSales?.(item)}
          className={cn(
            "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] transition-all duration-200 group flex flex-col relative",
            onViewSales && "cursor-pointer",
            (!item.available || archivedMode) && "opacity-75"
          )}
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-surface-subtle)] shrink-0">
            <MenuItemImage item={item} lang={lang} className="group-hover:scale-[1.04]" />

            {archivedMode ? (
              <div className="absolute top-2.5 left-2.5">
                <span className="inline-flex items-center gap-1 bg-black/65 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                  <Archive size={10} />
                  {t("menu.archivedBadge")}
                </span>
              </div>
            ) : !item.available ? (
              <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
                <span className="bg-[var(--color-danger)] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  {t("common.soldOut")}
                </span>
              </div>
            ) : (
              <div className="absolute top-2.5 left-2.5">
                <span className="inline-flex items-center gap-1.5 bg-black/55 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {t("common.available")}
                </span>
              </div>
            )}
          </div>

          <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
            <div className="space-y-1.5">
              <div className="font-semibold text-[var(--color-text)] text-sm leading-snug line-clamp-2 min-h-[2.45rem]">
                {menuItemName(item, lang)}
              </div>
              <span className="inline-block text-[11px] font-medium text-[var(--color-muted)] bg-[var(--color-surface-subtle)] px-2 py-0.5 rounded-md line-clamp-1 max-w-full">
                {categoryDisplayName(categoryName(item.category_id), lang)}
              </span>
            </div>

            <div className="flex items-end justify-between gap-2 pt-2 border-t border-[var(--color-border)]/50">
              <div className="leading-tight">
                <div className="text-[15px] font-bold text-[var(--color-primary)] tabular-nums">
                  {formatUSD(item.price)}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
                  {formatKHR(item.price)}
                </div>
              </div>

              {archivedMode ? (
                <div className="flex items-center gap-1">
                  {onViewSales && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewSales(item)
                      }}
                      title={t("menu.viewSales")}
                      aria-label={t("menu.viewSales")}
                      className="p-1.5 rounded-lg hover:bg-[var(--color-primary-muted)] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    >
                      <BarChart3 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRestore?.(item)
                    }}
                    disabled={restoringId === item.menu_item_id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw
                      size={12}
                      className={cn(restoringId === item.menu_item_id && "animate-spin")}
                    />
                    {t("menu.restore")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  {onViewSales && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewSales(item)
                      }}
                      title={t("menu.viewSales")}
                      aria-label={t("menu.viewSales")}
                      className="p-1.5 rounded-lg hover:bg-[var(--color-primary-muted)] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    >
                      <BarChart3 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(item)
                    }}
                    title={t("common.edit")}
                    aria-label={t("common.edit")}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-primary-muted)] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item)
                    }}
                    title={t("common.delete")}
                    aria-label={t("common.delete")}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-danger-muted)] text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function MenuFormDialog({
  open, onClose, isEdit, item, title, description,
  form, setForm, categories, imagePreview, onImageSelect, onImageClear,
  errorMsg, saving, onSubmit, submitLabel, onToggleAvailable,
}) {
  const { t } = useLang()
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 flex flex-col max-h-[90dvh] overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3.5 pr-12 border-b border-[var(--color-border)] shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <FormFields
            form={form} setForm={setForm} categories={categories} isEdit={isEdit}
            imagePreview={imagePreview} onImageSelect={onImageSelect} onImageClear={onImageClear}
          />
          {errorMsg && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-background)]/40 shrink-0 flex flex-wrap items-center justify-between gap-2">
          {isEdit && item ? (
            <Button
              type="button"
              variant="outline"
              onClick={onToggleAvailable}
              disabled={saving}
              className={cn(
                item.available
                  ? "border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)]"
                  : "border-[var(--color-primary)]/50 text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)]"
              )}
            >
              {item.available ? t("common.soldOut") : t("menu.markAvailable")}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="button" onClick={onSubmit} disabled={saving}>{saving ? t("common.saving") : submitLabel}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AddCategoryDialog({ open, onClose, newCatName, setNewCatName, newCatType, setNewCatType, errorMsg, saving, onSubmit, categories = [], onDeleteCategory }) {
  const { t, lang } = useLang()
  
  
  
  
  
  
  const [confirmingId, setConfirmingId] = useState(null)
  const [rowBusy, setRowBusy] = useState(false)
  const [rowError, setRowError] = useState("")

  const startConfirm = (cat) => { setConfirmingId(cat.category_id); setRowError("") }
  const cancelConfirm = () => { setConfirmingId(null); setRowError("") }
  const doDelete = async (cat) => {
    setRowBusy(true)
    setRowError("")
    try {
      await onDeleteCategory(cat)
      setConfirmingId(null)
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
          <DialogTitle>{t("menu.category")}</DialogTitle>
          <DialogDescription>{t("menu.categoriesDesc")}</DialogDescription>
        </DialogHeader>

        {categories.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] mt-1">
            {categories.map(cat => (
              confirmingId === cat.category_id ? (
                <div key={cat.category_id} className="px-3 py-2.5 bg-[var(--color-danger-muted)] space-y-2">
                  <div className="text-xs text-[var(--color-danger)]">{t("common.delete")} "{categoryDisplayName(cat, lang)}"?</div>
                  {rowError && <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-muted)] rounded-lg px-2 py-1.5">{rowError}</div>}
                  <div className="flex gap-2">
                    <button onClick={cancelConfirm} disabled={rowBusy}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-60">
                      {t("common.cancel")}
                    </button>
                    <button onClick={() => doDelete(cat)} disabled={rowBusy}
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-[var(--color-danger)] text-white disabled:opacity-60">
                      {rowBusy ? t("common.deleting") : t("common.delete")}
                    </button>
                  </div>
                </div>
              ) : (
                <div key={cat.category_id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-[var(--color-text)]">{categoryDisplayName(cat, lang)}</span>
                  <button onClick={() => startConfirm(cat)}
                    className="p-1 rounded-lg hover:bg-[var(--color-danger-muted)] text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            ))}
          </div>
        )}

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>{t("menu.categoryName")}</Label>
            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Soup" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("menu.type")}</Label>
            <Select value={newCatType} onValueChange={setNewCatType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="food">{t("menu.foodType")}</SelectItem>
                <SelectItem value="drink">{t("menu.drinkType")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 mt-3">{errorMsg}</div>}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? t("common.saving") : t("menu.addCategory")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const KHR_RATE = 4100

function getPhnomPenhMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find(p => p.type === "year")?.value || String(new Date().getFullYear())
  const month = parts.find(p => p.type === "month")?.value || String(new Date().getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, "0")}`
}

function formatMonthLabel(ym, lang) {
  if (!ym) return ""
  const dt = new Date(`${ym}-01T00:00:00Z`)
  if (Number.isNaN(dt.getTime())) return ym
  return new Intl.DateTimeFormat(lang === "km" ? "km-KH" : "en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt)
}

export function MenuItemSalesDialog({ item, categoryName, onClose, fetchItemSales }) {
  const { t, lang } = useLang()
  const currentMonth = useMemo(() => getPhnomPenhMonth(), [])
  const [fromMonth, setFromMonth] = useState(currentMonth)
  const [toMonth, setToMonth] = useState(currentMonth)
  const [salesData, setSalesData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!item?.menu_item_id || !fetchItemSales) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const data = await fetchItemSales(item.menu_item_id, { from: fromMonth, to: toMonth })
        if (!cancelled) setSalesData(data)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || t("menu.salesLoadFailed"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [item?.menu_item_id, fromMonth, toMonth, fetchItemSales, t])

  const presets = useMemo(() => [
    { id: "this", label: t("menu.thisMonth"), from: currentMonth, to: currentMonth },
    { id: "3m", label: t("menu.last3Months"), from: shiftMonth(currentMonth, -2), to: currentMonth },
    { id: "6m", label: t("menu.last6Months"), from: shiftMonth(currentMonth, -5), to: currentMonth },
    { id: "year", label: t("menu.thisYear"), from: `${currentMonth.slice(0, 4)}-01`, to: currentMonth },
  ], [currentMonth, t])

  const summary = salesData?.summary || { total_quantity: 0, total_revenue: 0, total_orders: 0 }
  const monthly = useMemo(() => salesData?.monthly || [], [salesData?.monthly])
  const maxRevenue = useMemo(
    () => Math.max(0, ...monthly.map(m => Number(m.revenue) || 0)),
    [monthly]
  )

  const handleFromChange = (val) => {
    if (!val) return
    setFromMonth(val)
    if (val > toMonth) setToMonth(val)
  }

  const handleToChange = (val) => {
    if (!val) return
    setToMonth(val)
    if (val < fromMonth) setFromMonth(val)
  }

  const rangeText = fromMonth === toMonth
    ? formatMonthLabel(fromMonth, lang)
    : `${formatMonthLabel(fromMonth, lang)} – ${formatMonthLabel(toMonth, lang)}`

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 flex flex-col max-h-[90dvh] overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-3 pr-7">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-[var(--color-border)] shrink-0 bg-[var(--color-background)]">
              <MenuItemImage item={item} lang={lang} iconSize={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="truncate">{item ? menuItemName(item, lang) : ""}</DialogTitle>
                {item?.deleted_at && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)]">
                    <Archive size={10} />
                    {t("menu.archivedBadge")}
                  </span>
                )}
              </div>
              <DialogDescription className="mt-0.5">
                {t("menu.salesTitle")} · {item ? `${categoryDisplayName(categoryName(item.category_id), lang)} · $${Number(item.price || 0).toFixed(2)}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-[var(--color-muted)]">{t("menu.fromMonth")}</Label>
                <Input
                  type="month"
                  value={fromMonth}
                  max={currentMonth}
                  onChange={(e) => handleFromChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[var(--color-muted)]">{t("menu.toMonth")}</Label>
                <Input
                  type="month"
                  value={toMonth}
                  max={currentMonth}
                  onChange={(e) => handleToChange(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {presets.map(p => {
                const active = fromMonth === p.from && toMonth === p.to
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setFromMonth(p.from); setToMonth(p.to) }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
                      active
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                        : "bg-[var(--color-background)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {loading && !salesData ? (
            <div className="flex items-center justify-center py-10 text-[var(--color-muted)] gap-2 text-sm">
              <Loader2 size={16} className="animate-spin" />
              <span>{t("common.loading")}</span>
            </div>
          ) : (
            <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                  <div className="text-[11px] font-medium text-[var(--color-muted)]">{t("menu.soldQty")}</div>
                  <div className="text-xl font-bold text-[var(--color-text)] mt-0.5 tabular-nums">
                    {summary.total_quantity}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary-muted)]/40 p-3">
                  <div className="text-[11px] font-medium text-[var(--color-primary)]">{t("menu.totalEarned")}</div>
                  <div className="text-xl font-bold text-[var(--color-primary)] mt-0.5 tabular-nums">
                    ${Number(summary.total_revenue || 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)] tabular-nums">
                    ៛{Math.round(Number(summary.total_revenue || 0) * KHR_RATE).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                  <div className="text-[11px] font-medium text-[var(--color-muted)]">{t("menu.paidOrders")}</div>
                  <div className="text-xl font-bold text-[var(--color-text)] mt-0.5 tabular-nums">
                    {summary.total_orders}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text)]">{t("menu.monthlyBreakdown")}</span>
                  <span className="text-[11px] text-[var(--color-muted)]">{rangeText}</span>
                </div>

                {summary.total_quantity === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--color-border)] py-8 px-4 text-center text-xs text-[var(--color-muted)]">
                    {t("menu.noSalesInRange")}
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
                    {monthly.map(m => {
                      const pct = maxRevenue > 0 && m.revenue > 0
                        ? Math.max(4, Math.round((m.revenue / maxRevenue) * 100))
                        : 0
                      return (
                        <div key={m.month} className="px-3.5 py-2.5 bg-[var(--color-surface)] space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[var(--color-text)]">{formatMonthLabel(m.month, lang)}</span>
                            <div className="flex items-center gap-3 tabular-nums">
                              <span className="text-[var(--color-muted)]">
                                {m.orders} {t("menu.ordersCount")} · {m.quantity} {t("menu.soldUnit")}
                              </span>
                              <span className="font-bold text-[var(--color-primary)] min-w-[60px] text-right">
                                ${Number(m.revenue || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[var(--color-background)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
