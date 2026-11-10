import { useState, useEffect } from "react"
import { useLang } from "@/i18n/LanguageContext"
import { cn, deleteErrorMessage } from "@/lib/utils"
import { Search, Plus, Users, Archive } from "lucide-react"
import { Button, Card, Input } from "@/components/ui"
import { useSupplierStore } from "../../context/supplierContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { SimpleHeader, ConfirmModal } from "@/components/shared"
import { SupplierGrid, SupplierFormDialog } from "@/components/admin/SuppliersParts"

export default function Suppliers() {
  const { t } = useLang()
  usePageTitle(t("nav.suppliers"))
  const {
    suppliers, archivedSuppliers, fetchSuppliers, fetchArchivedSuppliers,
    createSupplier, updateSupplier, deleteSupplier, restoreSupplier,
    isLoading, archivedLoading,
  } = useSupplierStore()

  const [activeTab, setActiveTab] = useState("active") // "active" | "archived"
  const [restoringId, setRestoringId] = useState(null)
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)
  const [form, setForm] = useState({ supplier_name: "", phone: "", email: "" })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    fetchSuppliers()
    fetchArchivedSuppliers().catch(() => {})
  }, [fetchSuppliers, fetchArchivedSuppliers])

  const sourceSuppliers = activeTab === "archived" ? (archivedSuppliers || []) : (suppliers || [])
  const filtered = sourceSuppliers.filter(s =>
    s.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setForm({ supplier_name: "", phone: "", email: "" })
    setErrorMsg("")
    setAddOpen(true)
  }

  const openEdit = (sup) => {
    setEditSupplier(sup)
    setErrorMsg("")
    setForm({ supplier_name: sup.supplier_name, phone: sup.phone, email: sup.email || "" })
  }

  const handleAdd = async () => {
    if (!form.supplier_name?.trim() || !form.phone?.trim()) {
      setErrorMsg(t("users.allRequired"))
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      await createSupplier({
        supplier_name: form.supplier_name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || null,
      })
      setAddOpen(false)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || t("cashier.submitFailed"))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!form.supplier_name?.trim() || !form.phone?.trim()) {
      setErrorMsg(t("users.allRequired"))
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      await updateSupplier(editSupplier.supplier_id, {
        supplier_name: form.supplier_name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || null,
      })
      setEditSupplier(null)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || t("cashier.submitFailed"))
    } finally {
      setSaving(false)
    }
  }

  // Deleting is destructive and irreversible, so it goes through a
  // confirmation modal instead of firing immediately on click.
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const requestDelete = (id) => {
    setDeleteError("")
    const item = suppliers.find(x => x.supplier_id === id)
    setDeleteTarget(item || { supplier_id: id })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteSupplier(deleteTarget.supplier_id)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(deleteErrorMessage(err, t))
    } finally {
      setDeleting(false)
    }
  }

  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    if (tab === "archived") {
      fetchArchivedSuppliers().catch(() => {})
    }
  }

  const handleRestore = async (sup) => {
    setRestoringId(sup.supplier_id)
    try {
      await restoreSupplier(sup.supplier_id)
    } catch (err) {
      console.error("Failed to restore supplier:", err)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="space-y-5">
      <SimpleHeader title={t("suppliers.title")}
        subtitle={t("suppliers.subtitle")}
        action={<Button onClick={openAdd} className="gap-2"><Plus size={15} /> {t("suppliers.addSupplier")}</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{t("suppliers.totalSuppliers")}</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <Users size={16} className="text-[var(--color-primary)]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)] mb-1">{suppliers.length}</div>
          <div className="text-xs text-[var(--color-muted)]">{t("suppliers.activePartners")}</div>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder={t("suppliers.searchPlaceholder")} />
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] w-fit">
          <button
            type="button"
            onClick={() => handleTabSwitch("active")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
              activeTab === "active"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
            )}
          >
            <Users size={14} />
            <span>{t("suppliers.activeTab")}</span>
            <span
              className={cn(
                "text-[11px] px-1.5 py-0.5 rounded-full font-bold",
                activeTab === "active"
                  ? "bg-white/20 text-white"
                  : "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
              )}
            >
              {(suppliers || []).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch("archived")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
              activeTab === "archived"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
            )}
          >
            <Archive size={14} />
            <span>{t("suppliers.archivedTab")}</span>
            <span
              className={cn(
                "text-[11px] px-1.5 py-0.5 rounded-full font-bold",
                activeTab === "archived"
                  ? "bg-white/20 text-white"
                  : "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
              )}
            >
              {(archivedSuppliers || []).length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === "archived" && (
        <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Archive size={14} className="text-[var(--color-muted)] shrink-0" />
          <span>{t("suppliers.archivedBanner")}</span>
        </div>
      )}

      <SupplierGrid
        suppliers={filtered}
        isLoading={activeTab === "archived" ? archivedLoading : isLoading}
        onEdit={openEdit}
        onDelete={requestDelete}
        archivedMode={activeTab === "archived"}
        onRestore={handleRestore}
        restoringId={restoringId}
      />

      <SupplierFormDialog
        open={addOpen} onClose={() => setAddOpen(false)} isEdit={false}
        title={t("suppliers.addSupplier")} description={t("suppliers.addDesc")}
        form={form} setForm={setForm} errorMsg={errorMsg} saving={saving}
        onSubmit={handleAdd} submitLabel={t("suppliers.addSupplier")}
      />

      <SupplierFormDialog
        open={!!editSupplier} onClose={() => setEditSupplier(null)} isEdit
        title={t("suppliers.editSupplier")} description={t("suppliers.editDesc")}
        form={form} setForm={setForm} errorMsg={errorMsg} saving={saving}
        onSubmit={handleUpdate} submitLabel={t("suppliers.updateSupplier")}
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        danger
        title={t("suppliers.deleteTitle")}
        message={t("suppliers.deleteMsg")}
        confirmLabel={t("common.delete")}
        errorMsg={deleteError}
      />
    </div>
  )
}
