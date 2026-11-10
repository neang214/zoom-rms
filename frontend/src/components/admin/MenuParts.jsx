import { useEffect, useRef, useState } from "react"
import { ImagePlus, X, Pencil, Trash2, UtensilsCrossed } from "lucide-react"
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
        <div className="relative w-44 h-44 aspect-square mx-auto rounded-2xl overflow-hidden border border-[var(--color-border)] group">
          <img
            src={preview}
            alt="preview"
            onError={() => setFailedPreview(preview)}
            className="w-full h-full object-cover"
          />
          <button type="button" onClick={onClear}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
            <X size={14} />
          </button>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
            <span className="text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-lg">{t("menu.changePhoto")}</span>
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-44 h-44 aspect-square mx-auto rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] flex flex-col items-center justify-center gap-2 text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)]/40 transition-all">
          <ImagePlus size={24} />
          <span className="text-xs font-medium">{t("menu.clickToUpload")}</span>
          <span className="text-[10px] text-[var(--color-muted)]">PNG or JPG (1:1 Square)</span>
        </button>
      )}
    </div>
  )
}

export function FormFields({ form, setForm, categories, isEdit, imagePreview, onImageSelect, onImageClear }) {
  const { t, lang } = useLang()
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("menu.photo")}</Label>
        <ImagePicker preview={imagePreview} onSelect={onImageSelect} onClear={onImageClear} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("menu.itemName")}</Label>
        <Input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} placeholder={t("menu.itemName")} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("menu.itemNameKm")} <span className="text-[var(--color-muted)] font-normal">(optional)</span></Label>
        <Input value={form.item_name_km || ""} onChange={e => setForm(f => ({ ...f, item_name_km: e.target.value }))} placeholder="ឈ្មោះជាភាសាខ្មែរ" />
        <p className="text-[11px] text-[var(--color-muted)]">{t("menu.itemNameKmHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label>{t("menu.category")}</Label>
        <Select value={form.category_id ? String(form.category_id) : ""} onValueChange={v => setForm(f => ({ ...f, category_id: parseInt(v) }))} disabled={isEdit}>
          <SelectTrigger><SelectValue placeholder={t("menu.allCategories")} /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.category_id} value={String(c.category_id)}>{categoryDisplayName(c, lang)}</SelectItem>)}
          </SelectContent>
        </Select>
        {isEdit && <p className="text-xs text-[var(--color-muted)]">{t("menu.categoryCantChange")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>{t("menu.price")}</Label>
        <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="$ 0.00" type="number" step="0.01" />
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

export function MenuGrid({ items, isLoading, categoryName, onEdit, onDelete }) {
  const { t, lang } = useLang()
  if (isLoading) return <div className="text-center py-16 text-[var(--color-muted)] text-sm">{t("menu.loading")}</div>
  if (items.length === 0) return <div className="text-center py-16 text-[var(--color-muted)] text-sm">{t("menu.notFound")}</div>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {(items || []).map(item => (
        <div
          key={item.menu_item_id}
          className={cn(
            "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-xs hover:shadow-md hover:border-[var(--color-border-strong)] transition-all duration-200 group flex flex-col relative",
            !item.available && "opacity-65"
          )}
        >
          <div className="relative aspect-square overflow-hidden bg-[var(--color-border)]/40 shrink-0">
            <MenuItemImage item={item} lang={lang} />
            {!item.available ? (
              <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
                <span className="bg-[var(--color-danger)] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  {t("common.soldOut")}
                </span>
              </div>
            ) : (
              <div className="absolute top-2 left-2">
                <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {t("common.available")}
                </span>
              </div>
            )}
          </div>
          <div className="p-3 flex flex-col flex-1 justify-between gap-2">
            <div>
              <div className="font-semibold text-[var(--color-text)] text-sm leading-snug line-clamp-2">
                {menuItemName(item, lang)}
              </div>
              <div className="mt-1">
                <span className="inline-block text-[10px] font-medium text-[var(--color-muted)] bg-[var(--color-background)] px-2 py-0.5 rounded-md border border-[var(--color-border)] line-clamp-1 max-w-full">
                  {categoryDisplayName(categoryName(item.category_id), lang)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]/60">
              <span className="text-base font-bold text-[var(--color-primary)]">
                ${Number(item.price).toFixed(2)}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onEdit(item)}
                  title="Edit item"
                  className="p-1.5 rounded-lg hover:bg-[var(--color-primary-muted)] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onDelete(item)}
                  title="Delete item"
                  className="p-1.5 rounded-lg hover:bg-[var(--color-danger-muted)] text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <FormFields
            form={form} setForm={setForm} categories={categories} isEdit={isEdit}
            imagePreview={imagePreview} onImageSelect={onImageSelect} onImageClear={onImageClear}
          />
        </div>
        {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 mt-3">{errorMsg}</div>}
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
          {isEdit && item && (
            <Button variant="destructive" size="sm" onClick={onToggleAvailable} disabled={saving}>
              {item.available ? t("common.soldOut") : t("menu.markAvailable")}
            </Button>
          )}
          <Button onClick={onSubmit} disabled={saving}>{saving ? t("common.saving") : submitLabel}</Button>
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
