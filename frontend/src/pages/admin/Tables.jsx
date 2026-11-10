import { useState, useEffect } from "react"
import { useLang } from "@/i18n/LanguageContext"
import { deleteErrorMessage } from "@/lib/utils"
import { ConfirmModal } from "@/components/shared"
import { Plus, QrCode, Wifi, WifiOff, TableIcon, Archive } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"
import { useTableStore } from "../../context/tableContext"
import { useOrderStore } from "../../context/orderContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"
import { usePageTitle } from "../../hooks/usePageTitle"
import {
  printElement, TablesList, TableFormDialog, TableViewDialog, SingleQrDialog, PrintAllQrDialog,
} from "@/components/admin/TablesParts"

export default function Tables() {
  const { t } = useLang()
  usePageTitle(t("tables.title"))
  const {
    tables, archivedTables, fetchTablesWithTokens, fetchArchivedTables,
    createTable, updateTable, deleteTable, restoreTable, regenerateQrToken,
    isLoading, archivedLoading,
  } = useTableStore()
  const { getActiveOrderByTable } = useOrderStore()

  const [activeTab, setActiveTab] = useState("active") // "active" | "archived"
  const [restoringId, setRestoringId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [viewTable, setViewTable] = useState(null)
  const [qrTable, setQrTable] = useState(null)
  const [printAllOpen, setPrintAllOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [viewOrder, setViewOrder] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [editTable, setEditTable] = useState(null)
  const [form, setForm] = useState({ table_number: "", capacity: "", is_available: true })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    fetchTablesWithTokens()
    fetchArchivedTables()
  }, [])

  // Real-time: table availability changes (a guest/cashier starts or pays
  // off an order) reflect here immediately instead of waiting on a poll.
  const { connected } = useSocketRole("admin")
  useSocketEvent("table:created", () => fetchTablesWithTokens())
  useSocketEvent("table:updated", () => fetchTablesWithTokens())
  useSocketEvent("table:deleted", () => fetchTablesWithTokens())

  const openAdd = () => {
    setForm({ table_number: "", capacity: "", is_available: true })
    setErrorMsg("")
    setAddOpen(true)
  }

  const openEdit = (t) => {
    setEditTable(t)
    setErrorMsg("")
    setForm({ table_number: t.table_number, capacity: t.capacity, is_available: t.is_available })
  }

  const openView = async (t) => {
    setViewTable(t)
    setViewOrder(null)
    setViewLoading(true)
    try {
      const order = await getActiveOrderByTable(t.table_id)
      setViewOrder(order)
    } catch (err) {
      console.error(err)
    } finally {
      setViewLoading(false)
    }
  }

  const handleAdd = async () => {
    const cap = parseInt(form.capacity)
    if (!form.table_number?.trim() || isNaN(cap) || cap <= 0) {
      setErrorMsg("Table number and a valid positive capacity are required.")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      await createTable({ table_number: form.table_number.trim(), capacity: cap, is_available: true })
      setAddOpen(false)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to add table.")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    const cap = parseInt(form.capacity)
    if (!form.table_number?.trim() || isNaN(cap) || cap <= 0) {
      setErrorMsg("Table number and a valid positive capacity are required.")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      await updateTable(editTable.table_id, {
        table_number: form.table_number.trim(),
        capacity: cap,
        is_available: form.is_available,
      })
      setEditTable(null)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to update table.")
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
    const item = tables.find(x => x.table_id === id)
    setDeleteTarget(item || { table_id: id })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteTable(deleteTarget.table_id)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(deleteErrorMessage(err, t))
    } finally {
      setDeleting(false)
    }
  }

  // Issues a fresh qr_token, invalidating the old printed QR; updates qrTable
  // in place so the open dialog shows the new code.
  const handleRegenerateQr = async (id) => {
    setRegenerating(true)
    try {
      const updated = await regenerateQrToken(id)
      setQrTable(updated)
    } catch (err) {
      console.error(err)
    } finally {
      setRegenerating(false)
    }
  }

  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    if (tab === "archived") {
      fetchArchivedTables().catch(() => {})
    }
  }

  const handleRestore = async (table) => {
    setRestoringId(table.table_id)
    try {
      await restoreTable(table.table_id)
    } catch (err) {
      console.error("Failed to restore table:", err)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-[var(--color-text)]">{t("tables.management")}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn("flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-full", connected ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)]" : "bg-[var(--color-danger-muted)] text-[var(--color-danger)]")}>
            {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {connected ? t("tables.live") : t("tables.reconnecting")}
          </div>
          <Button variant="outline" onClick={() => setPrintAllOpen(true)} className="gap-2"><QrCode size={15} /> {t("tables.qrCodes")}</Button>
          <Button onClick={openAdd} className="gap-2"><Plus size={15} /> {t("tables.newTable")}</Button>
        </div>
      </div>

      {/* Active / Archived Tab Switcher */}
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
          <TableIcon size={14} />
          <span>{t("tables.activeTab")}</span>
          <span
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded-full font-bold",
              activeTab === "active"
                ? "bg-white/20 text-white"
                : "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
            )}
          >
            {(tables || []).length}
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
          <span>{t("tables.archivedTab")}</span>
          <span
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded-full font-bold",
              activeTab === "archived"
                ? "bg-white/20 text-white"
                : "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
            )}
          >
            {(archivedTables || []).length}
          </span>
        </button>
      </div>

      <TablesList
        tables={activeTab === "archived" ? archivedTables : tables}
        isLoading={activeTab === "archived" ? archivedLoading : isLoading}
        onQr={setQrTable}
        onView={openView}
        onEdit={openEdit}
        onDelete={requestDelete}
        archivedMode={activeTab === "archived"}
        onRestore={handleRestore}
        restoringId={restoringId}
      />

      <TableFormDialog
        open={addOpen} onClose={() => setAddOpen(false)}
        title={t("tables.addTitle")} description={t("tables.addSub")}
        form={form} setForm={setForm} showStatus={false}
        errorMsg={errorMsg} saving={saving} onSubmit={handleAdd} submitLabel={t("tables.addTitle")}
      />

      <TableFormDialog
        open={!!editTable} onClose={() => setEditTable(null)}
        title={t("tables.editTitle")} description={null}
        form={form} setForm={setForm} showStatus
        errorMsg={errorMsg} saving={saving} onSubmit={handleUpdate} submitLabel={t("tables.updateTable")}
      />

      <TableViewDialog table={viewTable} order={viewOrder} loading={viewLoading} onClose={() => setViewTable(null)} />

      <SingleQrDialog table={qrTable} onClose={() => setQrTable(null)}
        onRegenerate={handleRegenerateQr} regenerating={regenerating} onPrint={printElement} />

      <PrintAllQrDialog open={printAllOpen} onClose={() => setPrintAllOpen(false)} tables={tables} onPrint={printElement} />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        danger
        title={t("tables.deleteTitle")}
        message={t("tables.deleteConfirmMsg").replace("{name}", deleteTarget?.table_number || "")}
        confirmLabel={t("common.delete")}
        errorMsg={deleteError}
      />
    </div>
  )
}
