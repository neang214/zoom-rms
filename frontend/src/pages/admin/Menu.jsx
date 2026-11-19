import { useState, useEffect, useRef } from "react"
import { Search, Plus, Tag, UtensilsCrossed, Archive, X } from "lucide-react"
import { Button } from "@/components/ui"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import api from "../../services/axios"
import { usePageTitle } from "../../hooks/usePageTitle"
import {
  MenuGrid,
  MenuFormDialog,
  AddCategoryDialog,
  MenuItemSalesDialog,
} from "@/components/admin/MenuParts"
import { ConfirmModal } from "@/components/shared"
import { useLang } from "@/i18n/LanguageContext"
import {
  cn,
  deleteErrorMessage,
  imageUrl,
  menuItemMatchesSearch,
  menuItemName,
  categoryDisplayName,
} from "@/lib/utils"
import { normalizeImageToJpg } from "@/lib/currency"

function revokeIfBlob(url) {
  if (typeof url === "string" && url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

export default function Menu() {
  const { t, lang } = useLang()
  usePageTitle(t("nav.menu"))
  const {
    items,
    archivedItems,
    fetchItems,
    fetchArchivedItems,
    createItem,
    updateItem,
    toggleItem,
    deleteItem,
    restoreItem,
    fetchItemSales,
    isLoading,
    archivedLoading,
  } = useMenuItemStore()
  const { categories, fetchCategories, createCategory, deleteCategory } =
    useMenuCategoryStore()

  const [activeTab, setActiveTab] = useState("active")
  const [activeCat, setActiveCat] = useState("All")
  const [search, setSearch] = useState("")
  const [restoringId, setRestoringId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [salesItem, setSalesItem] = useState(null)
  const [addCatOpen, setAddCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatType, setNewCatType] = useState("food")
  const [form, setForm] = useState({
    item_name: "",
    item_name_km: "",
    category_id: "",
    price: "",
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const [deleteItemTarget, setDeleteItemTarget] = useState(null)
  const [deletingItem, setDeletingItem] = useState(false)
  const [deleteItemError, setDeleteItemError] = useState("")

  const previewUrlRef = useRef(null)

  const setPreviewSafe = (nextUrl) => {
    revokeIfBlob(previewUrlRef.current)
    previewUrlRef.current = nextUrl
    setImagePreview(nextUrl)
  }

  useEffect(() => {
    fetchItems().catch(() => {})
    fetchArchivedItems().catch(() => {})
    fetchCategories().catch(() => {})
    return () => revokeIfBlob(previewUrlRef.current)
  }, [fetchItems, fetchArchivedItems, fetchCategories])

  const sourceItems = activeTab === "archived" ? archivedItems || [] : items || []
  const filtered = sourceItems.filter((i) => {
    const matchesCat = activeCat === "All" || i.category_id === activeCat
    const cat = (categories || []).find((c) => c.category_id === i.category_id)
    return matchesCat && menuItemMatchesSearch(i, search, cat?.category_name)
  })

  const categoryName = (id) =>
    (categories || []).find((c) => c.category_id === id)?.category_name || "—"

  const handleImageSelect = async (file) => {
    const cleanJpgFile = await normalizeImageToJpg(file)
    setImageFile(cleanJpgFile)
    setPreviewSafe(URL.createObjectURL(cleanJpgFile))
  }

  const handleImageClear = () => {
    setImageFile(null)
    setPreviewSafe(null)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setErrorMsg("")
    setImageFile(null)
    setPreviewSafe(item.image_url ? imageUrl(item.image_url) : null)
    setForm({
      item_name: item.item_name,
      item_name_km: item.item_name_km || "",
      category_id: item.category_id,
      price: item.price,
    })
  }

  const openAdd = () => {
    setForm({
      item_name: "",
      item_name_km: "",
      category_id: categories[0]?.category_id || "",
      price: "",
    })
    setImageFile(null)
    setPreviewSafe(null)
    setErrorMsg("")
    setAddOpen(true)
  }

  const uploadItemImage = async (id, file) => {
    const formData = new FormData()
    formData.append("image", file, file.name || "menu.jpg")
    await api.post(`/menu-items/${id}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  }

  const handleAdd = async () => {
    const parsedPrice = parseFloat(form.price)
    if (
      !form.item_name?.trim() ||
      !form.category_id ||
      form.price === "" ||
      isNaN(parsedPrice) ||
      parsedPrice <= 0
    ) {
      setErrorMsg("Valid name, category, and positive price are required.")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      const created = await createItem({
        item_name: form.item_name.trim(),
        item_name_km: form.item_name_km?.trim() || null,
        category_id: parseInt(form.category_id, 10),
        price: parsedPrice,
        available: true,
      })
      if (imageFile && created?.menu_item_id) {
        await uploadItemImage(created.menu_item_id, imageFile)
        await fetchItems()
      }
      setPreviewSafe(null)
      setAddOpen(false)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to add item.")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    const parsedPrice = parseFloat(form.price)
    if (!form.item_name?.trim() || form.price === "" || isNaN(parsedPrice) || parsedPrice <= 0) {
      setErrorMsg("Valid name and positive price are required.")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      await updateItem(editItem.menu_item_id, {
        item_name: form.item_name.trim(),
        item_name_km: form.item_name_km?.trim() || null,
        price: parsedPrice,
      })
      if (imageFile) {
        await uploadItemImage(editItem.menu_item_id, imageFile)
        await fetchItems()
      }
      setPreviewSafe(null)
      setEditItem(null)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to update item.")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAvailable = async () => {
    setSaving(true)
    setErrorMsg("")
    try {
      await toggleItem(editItem.menu_item_id, !editItem.available)
      setEditItem(null)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to update status.")
    } finally {
      setSaving(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    setSaving(true)
    setErrorMsg("")
    try {
      await createCategory({ category_name: newCatName.trim(), type: newCatType })
      setAddCatOpen(false)
      setNewCatName("")
      setNewCatType("food")
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to add category.")
    } finally {
      setSaving(false)
    }
  }

  const requestDeleteItem = (item) => {
    setDeleteItemError("")
    setDeleteItemTarget(item)
  }

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return
    setDeletingItem(true)
    setDeleteItemError("")
    try {
      await deleteItem(deleteItemTarget.menu_item_id)
      setDeleteItemTarget(null)
    } catch (err) {
      setDeleteItemError(deleteErrorMessage(err, t))
    } finally {
      setDeletingItem(false)
    }
  }

  const handleDeleteCategory = async (cat) => {
    await deleteCategory(cat.category_id)
    if (activeCat === cat.category_id) setActiveCat("All")
  }

  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    if (tab === "archived") fetchArchivedItems().catch(() => {})
  }

  const handleRestoreItem = async (item) => {
    setRestoringId(item.menu_item_id)
    try {
      await restoreItem(item.menu_item_id)
    } catch (err) {
      console.error("Failed to restore menu item:", err)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2.5 items-center flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("menu.searchPlaceholder")}
              className="w-full h-10 pl-10 pr-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={openAdd} size="sm" className="h-10 px-4">
              <Plus size={15} /> {t("menu.addMenu")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3.5"
              onClick={() => {
                setErrorMsg("")
                setAddCatOpen(true)
              }}
            >
              <Tag size={14} /> {t("menu.category")}
            </Button>
          </div>
        </div>

        {/* Active / Archived Switcher */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          {[
            { key: "active", label: t("menu.activeTab"), icon: UtensilsCrossed, count: (items || []).length },
            { key: "archived", label: t("menu.archivedTab"), icon: Archive, count: (archivedItems || []).length },
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleTabSwitch(key)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === key
                  ? "bg-[var(--color-primary)] text-white shadow-2xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              )}
            >
              <Icon size={13} />
              <span>{label}</span>
              <span
                className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded-full font-bold tabular-nums",
                  activeTab === key
                    ? "bg-white/20 text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setActiveCat("All")}
          className={cn(
            "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
            activeCat === "All"
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-2xs"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
          )}
        >
          {t("common.all")}
        </button>
        {(categories || []).map((cat) => {
          const active = activeCat === cat.category_id
          return (
            <button
              key={cat.category_id}
              type="button"
              onClick={() => setActiveCat(active ? "All" : cat.category_id)}
              className={cn(
                "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                active
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-2xs"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
              )}
            >
              {categoryDisplayName(cat, lang)}
            </button>
          )
        })}
      </div>

      {activeTab === "archived" && (
        <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Archive size={14} className="text-[var(--color-muted)] shrink-0" />
          <span>{t("menu.archivedBanner")}</span>
        </div>
      )}

      <MenuGrid
        items={filtered}
        isLoading={activeTab === "archived" ? archivedLoading : isLoading}
        categoryName={categoryName}
        onEdit={openEdit}
        onDelete={requestDeleteItem}
        onViewSales={setSalesItem}
        archivedMode={activeTab === "archived"}
        onRestore={handleRestoreItem}
        restoringId={restoringId}
      />

      <MenuFormDialog
        open={addOpen}
        onClose={() => {
          setPreviewSafe(null)
          setAddOpen(false)
        }}
        isEdit={false}
        item={null}
        title={t("menu.addItemTitle")}
        description={t("menu.addItemDesc")}
        form={form}
        setForm={setForm}
        categories={categories}
        imagePreview={imagePreview}
        onImageSelect={handleImageSelect}
        onImageClear={handleImageClear}
        errorMsg={errorMsg}
        saving={saving}
        onSubmit={handleAdd}
        submitLabel={t("menu.addMenu")}
      />

      <MenuFormDialog
        open={!!editItem}
        onClose={() => {
          setPreviewSafe(null)
          setEditItem(null)
        }}
        isEdit
        item={editItem}
        title={t("menu.editItemTitle")}
        description={t("menu.editItemDesc")}
        form={form}
        setForm={setForm}
        categories={categories}
        imagePreview={imagePreview}
        onImageSelect={handleImageSelect}
        onImageClear={handleImageClear}
        errorMsg={errorMsg}
        saving={saving}
        onSubmit={handleUpdate}
        submitLabel={t("menu.updateMenu")}
        onToggleAvailable={handleToggleAvailable}
      />

      <AddCategoryDialog
        open={addCatOpen}
        onClose={() => setAddCatOpen(false)}
        newCatName={newCatName}
        setNewCatName={setNewCatName}
        newCatType={newCatType}
        setNewCatType={setNewCatType}
        errorMsg={errorMsg}
        saving={saving}
        onSubmit={handleAddCategory}
        categories={categories}
        onDeleteCategory={handleDeleteCategory}
      />

      <MenuItemSalesDialog
        key={salesItem?.menu_item_id || "none"}
        item={salesItem}
        categoryName={categoryName}
        onClose={() => setSalesItem(null)}
        fetchItemSales={fetchItemSales}
      />

      <ConfirmModal
        open={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={handleDeleteItem}
        busy={deletingItem}
        danger
        title={t("menu.deleteTitle")}
        message={t("menu.deleteConfirmMsg").replace(
          "{name}",
          deleteItemTarget ? menuItemName(deleteItemTarget, lang) : ""
        )}
        confirmLabel={t("common.delete")}
        errorMsg={deleteItemError}
      />
    </div>
  )
}
