import { useState, useEffect, useRef } from "react"
import { useLang } from "@/i18n/LanguageContext"
import { cn, deleteErrorMessage } from "@/lib/utils"
import { normalizeImageToJpg } from "@/lib/currency"
import { Plus, Package, Truck } from "lucide-react"
import { Button } from "@/components/ui"
import { useStockStore } from "../../context/stockContext"
import { useUnitStore } from "../../context/unitContext"
import { useStockOrderStore } from "../../context/stockOrderContext"
import { useSupplierStore } from "../../context/supplierContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { SimpleHeader, ConfirmModal } from "@/components/shared"
import {
  StockStats,
  StockTable,
  StockFormDialog,
  StockViewDialog,
  AddQtyDialog,
  AddUnitDialog,
  StockOrdersCard,
  StockOrderDialog,
  stockImageUrl,
} from "@/components/admin/StockParts"

function revokeIfBlob(url) {
  if (typeof url === "string" && url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

export default function Stock() {
  const { t } = useLang()
  usePageTitle(t("stock.title"))
  const {
    stockItems,
    lowStock,
    fetchStock,
    fetchLowStock,
    createStock,
    updateStock,
    increaseStock,
    deleteStock,
    uploadStockImage,
    isLoading,
  } = useStockStore()
  const { units, fetchUnits, createUnit, updateUnit, deleteUnit } = useUnitStore()
  const {
    stockOrders,
    fetchStockOrders,
    createStockOrder,
    updateStatus: updatePoStatus,
    isLoading: poLoading,
  } = useStockOrderStore()
  const { suppliers, fetchSuppliers } = useSupplierStore()

  const [activeTab, setActiveTab] = useState("inventory")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [catFilter, setCatFilter] = useState("All categories")
  const [lowOnly, setLowOnly] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [viewItem, setViewItem] = useState(null)
  const [addQtyItem, setAddQtyItem] = useState(null)
  const [addQty, setAddQty] = useState("")
  const [addUnitOpen, setAddUnitOpen] = useState(false)
  const [newUnitName, setNewUnitName] = useState("")
  const [form, setForm] = useState({
    item_name: "",
    quantity: "",
    unit_id: "",
    min_level: "",
    stock_type: "both",
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const [poOpen, setPoOpen] = useState(false)
  const [poForm, setPoForm] = useState({ stock_id: "", supplier_id: "", quantity: "", invoice: "" })
  const [poError, setPoError] = useState("")
  const [poSaving, setPoSaving] = useState(false)
  const [updatingPoId, setUpdatingPoId] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const previewUrlRef = useRef(null)

  const setPreviewSafe = (nextUrl) => {
    revokeIfBlob(previewUrlRef.current)
    previewUrlRef.current = nextUrl
    setImagePreview(nextUrl)
  }

  useEffect(() => {
    fetchStock().catch(() => {})
    fetchLowStock().catch(() => {})
    fetchUnits().catch(() => {})
    fetchStockOrders().catch(() => {})
    fetchSuppliers().catch(() => {})
    return () => revokeIfBlob(previewUrlRef.current)
  }, [fetchStock, fetchLowStock, fetchUnits, fetchStockOrders, fetchSuppliers])

  const lowStockIds = new Set((lowStock || []).map((i) => i.stock_id))

  const filtered = (stockItems || []).filter((i) => {
    const matchesUnit = catFilter === "All categories" || i.unit?.unit_name === catFilter
    const matchesSearch = i.item_name?.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === "all" || (i.stock_type || "both") === typeFilter
    const isLow =
      lowStockIds.has(i.stock_id) ||
      Number(i.quantity) <= 0 ||
      (i.min_level != null && Number(i.quantity) <= Number(i.min_level))
    return matchesUnit && matchesSearch && matchesType && (!lowOnly || isLow)
  })

  const lowStockCount =
    (lowStock || []).length ||
    (stockItems || []).filter(
      (i) =>
        Number(i.quantity) <= 0 ||
        (i.min_level != null && Number(i.quantity) <= Number(i.min_level))
    ).length
  const unitNames = [...new Set((stockItems || []).map((i) => i.unit?.unit_name).filter(Boolean))]
  const pendingPoCount = (stockOrders || []).filter((po) => po.status !== "Received").length

  const handleImageSelect = async (file) => {
    const compressed = await normalizeImageToJpg(file)
    setImageFile(compressed)
    setPreviewSafe(URL.createObjectURL(compressed))
  }

  const handleImageClear = () => {
    setImageFile(null)
    setPreviewSafe(null)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setErrorMsg("")
    setImageFile(null)
    setPreviewSafe(stockImageUrl(item))
    setForm({
      item_name: item.item_name,
      quantity: item.quantity,
      unit_id: item.unit_id,
      min_level: item.min_level ?? "",
      stock_type: item.stock_type || "both",
    })
  }

  const openAdd = () => {
    setForm({
      item_name: "",
      quantity: "0",
      unit_id: units[0]?.unit_id || "",
      min_level: "",
      stock_type: "both",
    })
    setImageFile(null)
    setPreviewSafe(null)
    setErrorMsg("")
    setAddOpen(true)
  }

  const handleAdd = async () => {
    if (!form.item_name?.trim() || form.quantity === "" || !form.unit_id || form.min_level === "") {
      setErrorMsg("All fields are required.")
      return
    }
    const qty = parseFloat(form.quantity)
    const min = parseFloat(form.min_level)
    if (isNaN(qty) || qty < 0 || isNaN(min) || min < 0) {
      setErrorMsg("Quantity and min level must be valid non-negative numbers.")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      const created = await createStock({
        item_name: form.item_name.trim(),
        quantity: qty,
        unit_id: parseInt(form.unit_id, 10),
        min_level: min,
        stock_type: form.stock_type,
      })
      if (imageFile && created?.stock_id) {
        await uploadStockImage(created.stock_id, imageFile)
      }
      await Promise.allSettled([fetchLowStock(), fetchStockOrders()])
      setPreviewSafe(null)
      setAddOpen(false)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to add stock item.")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!form.item_name?.trim() || form.quantity === "" || !form.unit_id || form.min_level === "") {
      setErrorMsg("All fields are required.")
      return
    }
    const qty = parseFloat(form.quantity)
    const min = parseFloat(form.min_level)
    if (isNaN(qty) || qty < 0 || isNaN(min) || min < 0) {
      setErrorMsg("Quantity and min level must be valid non-negative numbers.")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      await updateStock(editItem.stock_id, {
        item_name: form.item_name.trim(),
        quantity: qty,
        unit_id: parseInt(form.unit_id, 10),
        min_level: min,
        stock_type: form.stock_type,
      })
      if (imageFile) {
        await uploadStockImage(editItem.stock_id, imageFile)
      }
      await Promise.allSettled([fetchLowStock(), fetchStockOrders()])
      setPreviewSafe(null)
      setEditItem(null)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to update stock item.")
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (id) => {
    setDeleteError("")
    const item = stockItems.find((x) => x.stock_id === id)
    setDeleteTarget(item || { stock_id: id })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteStock(deleteTarget.stock_id)
      await Promise.allSettled([fetchLowStock(), fetchStockOrders()])
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(deleteErrorMessage(err, t))
    } finally {
      setDeleting(false)
    }
  }

  const handleAddQty = async () => {
    const amount = parseFloat(addQty)
    if (!addQty || isNaN(amount) || amount <= 0) {
      setErrorMsg("Please enter a valid positive quantity.")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      await increaseStock(addQtyItem.stock_id, amount)
      await Promise.allSettled([fetchLowStock(), fetchStockOrders()])
      setAddQtyItem(null)
      setAddQty("")
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to add quantity.")
    } finally {
      setSaving(false)
    }
  }

  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return
    setSaving(true)
    setErrorMsg("")
    try {
      await createUnit({ unit_name: newUnitName.trim() })
      setNewUnitName("")
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to add unit.")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateUnit = async (id, unit_name) => {
    const oldUnit = units.find((u) => u.unit_id === id)
    await updateUnit(id, { unit_name })
    if (oldUnit && catFilter === oldUnit.unit_name) setCatFilter(unit_name)
    await fetchStock()
  }

  const handleDeleteUnit = async (id) => {
    const oldUnit = units.find((u) => u.unit_id === id)
    await deleteUnit(id)
    if (oldUnit && catFilter === oldUnit.unit_name) setCatFilter("All categories")
  }

  const openNewPo = (preselectedStockId) => {
    setPoForm({
      stock_id: preselectedStockId || stockItems[0]?.stock_id || "",
      supplier_id: suppliers[0]?.supplier_id || "",
      quantity: "",
      invoice: "",
    })
    setPoError("")
    setPoOpen(true)
  }

  const handleCreatePo = async () => {
    const qty = parseFloat(poForm.quantity)
    if (!poForm.stock_id || !poForm.supplier_id || isNaN(qty) || qty <= 0) {
      setPoError("Stock item, supplier, and a positive quantity are required.")
      return
    }
    setPoSaving(true)
    setPoError("")
    try {
      await createStockOrder({
        stock_id: parseInt(poForm.stock_id, 10),
        supplier_id: parseInt(poForm.supplier_id, 10),
        quantity: qty,
        invoice: poForm.invoice?.trim() || undefined,
      })
      await fetchStockOrders()
      setPoOpen(false)
    } catch (err) {
      setPoError(err?.response?.data?.message || "Failed to create purchase order.")
    } finally {
      setPoSaving(false)
    }
  }

  const handleUpdatePoStatus = async (id, status) => {
    setUpdatingPoId(id)
    try {
      await updatePoStatus(id, status)
      if (status === "Received") {
        await Promise.allSettled([fetchStock(), fetchLowStock()])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingPoId(null)
    }
  }

  return (
    <div className="space-y-5">
      <SimpleHeader
        title={t("stock.title")}
        subtitle={t("stock.subtitle")}
        action={
          activeTab === "inventory" ? (
            <Button onClick={openAdd}>
              <Plus size={15} /> {t("stock.addItem")}
            </Button>
          ) : (
            <Button onClick={() => openNewPo()}>
              <Plus size={15} /> {t("stock.newPo")}
            </Button>
          )
        }
      />

      <StockStats
        stockItems={stockItems}
        lowStockCount={lowStockCount}
        unitNames={unitNames}
        stockOrdersCount={stockOrders.length}
      />

      <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
            activeTab === "inventory"
              ? "bg-[var(--color-primary)] text-white shadow-2xs"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          )}
        >
          <Package size={15} />
          <span>{t("stock.inventoryList")}</span>
          <span
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums",
              activeTab === "inventory"
                ? "bg-white/20 text-white"
                : "bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
            )}
          >
            {stockItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
            activeTab === "orders"
              ? "bg-[var(--color-primary)] text-white shadow-2xs"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          )}
        >
          <Truck size={15} />
          <span>{t("stock.poTitle")}</span>
          <span
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums",
              activeTab === "orders"
                ? "bg-white/20 text-white"
                : pendingPoCount > 0
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-warning)]"
                  : "bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
            )}
          >
            {stockOrders.length}
          </span>
        </button>
      </div>

      {activeTab === "inventory" ? (
        <StockTable
          items={filtered}
          isLoading={isLoading}
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          lowOnly={lowOnly}
          setLowOnly={setLowOnly}
          lowStockCount={lowStockCount}
          unitNames={unitNames}
          onAddUnit={() => {
            setErrorMsg("")
            setAddUnitOpen(true)
          }}
          onAddQty={(item) => {
            setErrorMsg("")
            setAddQty("")
            setAddQtyItem(item)
          }}
          onView={setViewItem}
          onEdit={openEdit}
          onDelete={requestDelete}
        />
      ) : (
        <StockOrdersCard
          stockOrders={stockOrders}
          isLoading={poLoading}
          onNewOrder={() => openNewPo()}
          onUpdateStatus={handleUpdatePoStatus}
          updatingId={updatingPoId}
        />
      )}

      <StockOrderDialog
        open={poOpen}
        onClose={() => setPoOpen(false)}
        form={poForm}
        setForm={setPoForm}
        stockItems={stockItems}
        suppliers={suppliers}
        errorMsg={poError}
        saving={poSaving}
        onSubmit={handleCreatePo}
      />

      <StockFormDialog
        open={addOpen}
        onClose={() => {
          setPreviewSafe(null)
          setAddOpen(false)
        }}
        isEdit={false}
        title={t("stock.addItem")}
        description={t("stock.subtitle")}
        form={form}
        setForm={setForm}
        units={units}
        imagePreview={imagePreview}
        onImageSelect={handleImageSelect}
        onImageClear={handleImageClear}
        errorMsg={errorMsg}
        saving={saving}
        onSubmit={handleAdd}
        submitLabel={t("stock.addItem")}
      />

      <StockFormDialog
        open={!!editItem}
        onClose={() => {
          setPreviewSafe(null)
          setEditItem(null)
        }}
        isEdit
        title={t("stock.editItem")}
        description={t("stock.subtitle")}
        form={form}
        setForm={setForm}
        units={units}
        imagePreview={imagePreview}
        onImageSelect={handleImageSelect}
        onImageClear={handleImageClear}
        errorMsg={errorMsg}
        saving={saving}
        onSubmit={handleUpdate}
        submitLabel={t("stock.updateItem")}
      />

      <StockViewDialog item={viewItem} onClose={() => setViewItem(null)} />

      <AddQtyDialog
        item={addQtyItem}
        addQty={addQty}
        setAddQty={setAddQty}
        errorMsg={errorMsg}
        saving={saving}
        onConfirm={handleAddQty}
        onClose={() => setAddQtyItem(null)}
      />

      <AddUnitDialog
        open={addUnitOpen}
        newUnitName={newUnitName}
        setNewUnitName={setNewUnitName}
        errorMsg={errorMsg}
        saving={saving}
        onConfirm={handleAddUnit}
        onClose={() => setAddUnitOpen(false)}
        units={units}
        onUpdateUnit={handleUpdateUnit}
        onDeleteUnit={handleDeleteUnit}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        danger
        title={t("stock.deleteTitle")}
        message={t("stock.deleteMsg")}
        confirmLabel={t("common.delete")}
        errorMsg={deleteError}
      />
    </div>
  )
}
