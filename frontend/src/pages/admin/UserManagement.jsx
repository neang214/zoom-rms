import { useState, useEffect } from "react"
import { useLang } from "@/i18n/LanguageContext"
import { cn, deleteErrorMessage } from "@/lib/utils"
import { Plus, Users, Archive } from "lucide-react"
import { Button } from "@/components/ui"
import { useUserStore } from "../../context/userContext"
import { authContext } from "../../context/authContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { SimpleHeader, ConfirmModal } from "@/components/shared"
import { UserStats, UsersTable, UserFormDialog } from "@/components/admin/UserManagementParts"

export default function UserManagement() {
  const { t } = useLang()
  usePageTitle(t("nav.users"))
  const {
    users, archivedUsers, fetchUsers, fetchArchivedUsers,
    createUser, updateUser, deleteUser, restoreUser,
    isLoading, archivedLoading,
  } = useUserStore()
  const { user: currentUser } = authContext()

  const [activeTab, setActiveTab] = useState("active") // "active" | "archived"
  const [restoringId, setRestoringId] = useState(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("All Role")
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "" })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    fetchUsers()
    fetchArchivedUsers().catch(() => {})
  }, [fetchUsers, fetchArchivedUsers])

  const sourceUsers = activeTab === "archived" ? (archivedUsers || []) : (users || [])
  const filtered = sourceUsers.filter(u =>
    (roleFilter === "All Role" || u.role === roleFilter) &&
    (u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
  )

  const counts = { admin: 0, kitchen: 0, barista: 0, cashier: 0 }
  users.forEach(u => { if (counts[u.role] !== undefined) counts[u.role]++ })

  const openAdd = () => {
    setForm({ username: "", email: "", password: "", role: "" })
    setErrorMsg("")
    setAddOpen(true)
  }

  const openEdit = (u) => {
    if (u.role === "admin" && currentUser?.user_id !== u.user_id) return
    setEditUser(u)
    setErrorMsg("")
    setForm({ username: u.username, email: u.email, password: "", role: u.role })
  }

  const handleAdd = async () => {
    if (!form.username?.trim() || !form.email?.trim() || !form.password || !form.role) {
      setErrorMsg(t("users.allRequired"))
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      await createUser({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      setAddOpen(false)
    } catch (err) {
      setErrorMsg(deleteErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!form.username?.trim() || !form.email?.trim() || !form.role) {
      setErrorMsg(t("users.allRequired"))
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      const payload = { username: form.username.trim(), email: form.email.trim(), role: form.role }
      if (form.password) payload.password = form.password
      await updateUser(editUser.user_id, payload)
      setEditUser(null)
    } catch (err) {
      setErrorMsg(deleteErrorMessage(err, t))
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
    const item = users.find(x => x.user_id === id)
    setDeleteTarget(item || { user_id: id })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteUser(deleteTarget.user_id)
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
      fetchArchivedUsers().catch(() => {})
    }
  }

  const handleRestore = async (user) => {
    setRestoringId(user.user_id)
    try {
      await restoreUser(user.user_id)
    } catch (err) {
      console.error("Failed to restore user:", err)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="space-y-5">
      <SimpleHeader title={t("nav.users")}
        subtitle={t("users.manageSubtitle")}
        action={<Button onClick={openAdd} className="gap-2"><Plus size={15} /> {t("users.addUser")}</Button>} />

      <UserStats users={users} counts={counts} />

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
          <span>{t("users.activeTab")}</span>
          <span
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded-full font-bold",
              activeTab === "active"
                ? "bg-white/20 text-white"
                : "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
            )}
          >
            {(users || []).length}
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
          <span>{t("users.archivedTab")}</span>
          <span
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded-full font-bold",
              activeTab === "archived"
                ? "bg-white/20 text-white"
                : "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
            )}
          >
            {(archivedUsers || []).length}
          </span>
        </button>
      </div>

      <UsersTable
        users={filtered}
        isLoading={activeTab === "archived" ? archivedLoading : isLoading}
        search={search} setSearch={setSearch}
        roleFilter={roleFilter} setRoleFilter={setRoleFilter}
        currentUser={currentUser}
        onEdit={openEdit}
        onDelete={requestDelete}
        archivedMode={activeTab === "archived"}
        onRestore={handleRestore}
        restoringId={restoringId}
      />

      <UserFormDialog
        open={addOpen} onClose={() => setAddOpen(false)} isEdit={false}
        title={t("users.addUser")} description={t("users.subtitle")}
        form={form} setForm={setForm} errorMsg={errorMsg} saving={saving}
        onSubmit={handleAdd} submitLabel={t("users.addUser")}
      />

      <UserFormDialog
        open={!!editUser} onClose={() => setEditUser(null)} isEdit
        title={t("users.editUser")} description={t("users.editSub")}
        form={form} setForm={setForm} errorMsg={errorMsg} saving={saving}
        onSubmit={handleUpdate} submitLabel={t("users.updateUser")}
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        danger
        title={t("users.deleteTitle")}
        message={t("users.deleteMsg")}
        confirmLabel={t("common.delete")}
        errorMsg={deleteError}
      />
    </div>
  )
}
