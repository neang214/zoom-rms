import { useState, useEffect } from "react"
import { Search, Plus, Tag } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import api from "../../services/axios"
import { usePageTitle } from "../../hooks/usePageTitle"
import {
  MenuCategoryBar, MenuGrid, MenuFormDialog, AddCategoryDialog,
} from "@/components/admin/MenuParts"
import { ConfirmModal } from "@/components/shared"
import { useLang } from "@/i18n/LanguageContext"
import { deleteErrorMessage, imageUrl, menuItemMatchesSearch, menuItemName } from "@/lib/utils"

function normalizeImageToJpg(file, maxWidth = 800, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const cleanName = (file.name || "menu").replace(/\.[^.]+$/, "") + ".jpg"
          resolve(new File([blob], cleanName, { type: "image/jpeg" }))
        },
        "image/jpeg",
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}

export default function Menu() {
  const { t, lang } = useLang()
  usePageTitle(t("nav.menu"))
  const { items, fetchItems, createItem, updateItem, toggleItem, deleteItem, isLoading } = useMenuItemStore()
  const { categories, fetchCategories, createCategory, deleteCategory } = useMenuCategoryStore()

  const [activeCat, setActiveCat] = useState("All")
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [addCatOpen, setAddCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatType, setNewCatType] = useState("food")
  const [form, setForm] = useState({ item_name: "", item_name_km: "", category_id: "", price: "" })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const [deleteItemTarget, setDeleteItemTarget] = useState(null)
  const [deletingItem, setDeletingItem] = useState(false)
  const [deleteItemError, setDeleteItemError] = = State("")

  useEffect(() => {
    fetchItems()
    fetchCategories()
  }, [])

  const filtered = (items || []).filter(i => {
    const matchesCat = activeCat === "All" || i.category_id === activeCat
    const cat = (categories || []).find(c => c.category_id === i.category_id)
    const matchesSearch = menuItemMatchesSearch(i, search, cat?.category_name)
    return matchesCat && matchesSearch
  })

  const categoryName = (id) => (categories || []).find(c => c.category_id === id)?.category_name || "—"

  const handleImageSelect = async (file) => {
    const cleanJpgFile = await normalizeImageToJpg(file)
    setImageFile(cleanJpgFile)
    setImagePreview(URL.createObjectURL(cleanJpgFile))
  }

  const handleImageClear = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setErrorMsg("")
    setImageFile(null)
    setImagePreview(item.image_url ? imageUrl(item.image_url) : null)
    setForm({ item_name: item.item_name, item_name_km: item.item_name_km || "", category_id: item.category_id, price: item.price })
  }

  const openAdd = () => {
    setForm({ item_name: "", item_name_km: "", category_id: categories[0]?.category_id || "", price: "" })
    setImageFile(null)
    setImagePreview(null)
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
    if (!form.item_name?.trim() || !form.category_id || form.price === "" || isNaN(parsedPrice) || parsedPrice <= 0) {
      setErrorMsg("Valid name, category, and positive price are required.")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      const created = await createItem({
        item_name: form.item_name.trim(),
        item_name_km: form.item_name_km?.trim() || null,
        category_id: parseInt(form.category_id),
        price: parsedPrice,
        available: true,
      })
      if (imageFile && created?.menu_item_id) {
        await uploadItemImage(created.menu_item_id, imageFile)
        await fetchItems()
      }
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
      setEditItem(null)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to update item.")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAvailable = async () => {
    setSaving(true)
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
    if (!newCatName) return
    setSaving(true)
    try {
      await createCategory({ category_name: newCatName, type: newCatType })
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder={t("menu.searchPlaceholder")} />
        </div>
        <div className="flex gap-2">
          <Button onClick={openAdd} size="sm" className="gap-1.5"><Plus size={14} /> {t("menu.addMenu")}</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setErrorMsg(""); setAddCatOpen(true) }}><Tag size={14} /> {t("menu.category")}</Button>
        </div>
      </div>

      <MenuCategoryBar categories={categories} activeCat={activeCat} onSelect={setActiveCat} />

      <MenuGrid items={filtered} isLoading={isLoading} categoryName={categoryName} onEdit={openEdit} onDelete={requestDeleteItem} />

      <MenuFormDialog
        open={addOpen} onClose={() => setAddOpen(false)} isEdit={false} item={null}
        title={t("menu.addItemTitle")} description={t("menu.addItemDesc")}
        form={form} setForm={setForm} categories={categories}
        imagePreview={imagePreview} onImageSelect={handleImageSelect} onImageClear={handleImageClear}
        errorMsg={errorMsg} saving={saving} onSubmit={handleAdd} submitLabel={t("menu.addMenu")}
      />

      <MenuFormDialog
        open={!!editItem} onClose={() => setEditItem(null)} isEdit item={editItem}
        title={t("menu.editItemTitle")} description={t("menu.editItemDesc")}
        form={form} setForm={setForm} categories={categories}
        imagePreview={imagePreview} onImageSelect={handleImageSelect} onImageClear={handleImageClear}
        errorMsg={errorMsg} saving={saving} onSubmit={handleUpdate} submitLabel={t("menu.updateMenu")}
        onToggleAvailable={handleToggleAvailable}
      />

      <AddCategoryDialog
        open={addCatOpen} onClose={() => setAddCatOpen(false)}
        newCatName={newCatName} setNewCatName={setNewCatName}
        newCatType={newCatType} setNewCatType={setNewCatType}
        errorMsg={errorMsg} saving={saving} onSubmit={handleAddCategory}
        categories={categories} onDeleteCategory={handleDeleteCategory}
      />

      <ConfirmModal
        open={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={handleDeleteItem}
        busy={deletingItem}
        danger
        title={t("menu.deleteTitle")}
        message={`This will permanently delete "${deleteItemTarget ? menuItemName(deleteItemTarget, lang) : ""}". This can't be undone.`}
        confirmLabel={t("common.delete")}
        errorMsg={deleteItemError}
      />
    </div>
  )
}