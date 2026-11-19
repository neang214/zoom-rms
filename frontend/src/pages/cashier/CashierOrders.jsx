import { useState, useEffect } from "react"
import { ShoppingBag, Search, QrCode } from "lucide-react"
import { cn, menuItemMatchesSearch, menuItemName } from "@/lib/utils"
import { useOrderStore } from "../../context/orderContext"
import { usePaymentStore } from "../../context/paymentContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"
import { usePageTitle } from "../../hooks/usePageTitle"
import { useLang } from "@/i18n/LanguageContext"
import { PageHeader, StatsBar, ConfirmModal } from "@/components/shared"
import ReceiptScanner from "@/components/cashier/ReceiptScanner"
import { orderTotal } from "@/components/cashier/orderHelpers"
import ActiveOrdersTable from "@/components/cashier/ActiveOrdersTable"
import ViewOrderDialog from "@/components/cashier/ViewOrderDialog"
import PaymentDialog from "@/components/cashier/PaymentDialog"

export default function CashierOrders() {
  const { t, lang } = useLang()
  usePageTitle("Order Management")
  const { orders, fetchOrders, deleteOrder, deleteOrderItem, updateOrderItemQuantity, updateOrderItemNote, isLoading } = useOrderStore()
  const { paymentMethods, fetchPaymentMethods } = usePaymentStore()

  const [payOrder, setPayOrder] = useState(null)
  const [viewOrder, setViewOrder] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // { type: "order" | "item", order, item? }
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [search, setSearch] = useState("")
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanError, setScanError] = useState("")

  useSocketRole("cashier")

  useEffect(() => {
    fetchOrders()
    fetchPaymentMethods()
    const interval = setInterval(() => {
      fetchOrders()
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  useSocketEvent("order:new", () => fetchOrders())
  useSocketEvent("order:status_changed", () => fetchOrders())
  useSocketEvent("order:deleted", () => fetchOrders())
  useSocketEvent("order_item:new", () => fetchOrders())
  useSocketEvent("order_item:status_changed", () => fetchOrders())
  useSocketEvent("order_item:deleted", () => fetchOrders())
  useSocketEvent("order_item:updated", () => fetchOrders())
  useSocketEvent("order_item:note_changed", () => fetchOrders())
  useSocketEvent("payment:completed", () => fetchOrders())

  const activeOrders = orders.filter(o => !(o.is_paid ?? o.status === "Paid"))
  const activeViewOrder = viewOrder
    ? orders.find(o => o.order_id === viewOrder.order_id) || null
    : null

  const requestDeleteOrder = (order) => {
    setDeleteError("")
    setDeleteTarget({ type: "order", order })
  }

  const requestDeleteItem = (order, item) => {
    setDeleteError("")
    setDeleteTarget({ type: "item", order, item })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      if (deleteTarget.type === "order") {
        await deleteOrder(deleteTarget.order.order_id)
        if (viewOrder?.order_id === deleteTarget.order.order_id) {
          setViewOrder(null)
        }
      } else {
        const res = await deleteOrderItem(deleteTarget.item.order_item_id)
        if (res?.orderDeleted && viewOrder?.order_id === deleteTarget.order.order_id) {
          setViewOrder(null)
        }
      }
      await fetchOrders()
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err?.response?.data?.message || t("common.failed"))
    } finally {
      setDeleting(false)
    }
  }

  const handleReceiptFound = (orderId) => {
    setScannerOpen(false)
    const found = orders.find(o => o.order_id === orderId)
    if (!found) {
      setScanError(`Order #${String(orderId).padStart(4, "0")} not found.`)
      return
    }
    if (found.is_paid ?? found.status === "Paid") {
      setScanError(`Order #${String(orderId).padStart(4, "0")} has already been paid.`)
      return
    }
    setScanError("")
    setPayOrder(found)
  }

  const searchQuery = search.trim().toLowerCase()
  const searchDigits = searchQuery.replace(/\D/g, "")
  const searchAsNumber = searchDigits ? parseInt(searchDigits, 10) : null

  const searchedOrders = searchQuery
    ? activeOrders.filter(o => {
        const orderIdStr = String(o.order_id)
        const paddedOrderId = orderIdStr.padStart(4, "0")
        // 1. Order Number / ID match (#42, ORD-0042, 42, 0042)
        if (
          (searchAsNumber !== null && o.order_id === searchAsNumber) ||
          orderIdStr.includes(searchQuery) ||
          paddedOrderId.includes(searchQuery) ||
          `#${orderIdStr}`.includes(searchQuery) ||
          `#${paddedOrderId}`.includes(searchQuery) ||
          `ord-${paddedOrderId}`.toLowerCase().includes(searchQuery) ||
          `ord-${orderIdStr}`.toLowerCase().includes(searchQuery)
        ) {
          return true
        }

        // 2. Queue number match
        if (searchAsNumber !== null && o.queue_number === searchAsNumber) {
          return true
        }

        // 3. Table number match
        const tableNum = String(o.table?.table_number ?? "").toLowerCase()
        if (tableNum && (tableNum.includes(searchQuery) || `table ${tableNum}`.includes(searchQuery))) {
          return true
        }

        // 4. Note match
        if (o.note && o.note.toLowerCase().includes(searchQuery)) {
          return true
        }

        // 5. Item match (English or Khmer)
        if (o.order_items?.some(oi => menuItemMatchesSearch(oi.menu_item, searchQuery))) {
          return true
        }

        return false
      })
    : activeOrders

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchQuery) {
      if (searchedOrders.length === 1) {
        setPayOrder(searchedOrders[0])
      } else if (searchAsNumber !== null) {
        const exact = activeOrders.find(o => o.order_id === searchAsNumber)
        if (exact) setPayOrder(exact)
      }
    }
  }

  const stats = {
    active: activeOrders.length,
    pending: activeOrders.filter(o => o.status === "Pending").length,
    cooking: activeOrders.filter(o => o.status === "Preparing").length,
    ready: activeOrders.filter(o => o.status === "Served").length,
    total: activeOrders.reduce((s, o) => s + orderTotal(o), 0),
  }

  const grouped = {
    Served: searchedOrders.filter(o => o.status === "Served"),
    Preparing: searchedOrders.filter(o => o.status === "Preparing"),
    Pending: searchedOrders.filter(o => o.status === "Pending"),
  }

  const sectionConfig = [
    { key: "Served", label: t("cashier.readyForPayment"), sub: `${grouped.Served.length} ${t("cashier.orders")}`, accent: "text-[var(--color-primary)]", bar: "bg-[var(--color-primary)]" },
    { key: "Preparing", label: t("cashier.beingPrepared"), sub: `${grouped.Preparing.length} ${t("cashier.ordersInKitchen")}`, accent: "text-[var(--color-warning)]", bar: "bg-[var(--color-warning)]/80" },
    { key: "Pending", label: t("cashier.newOrders"), sub: `${grouped.Pending.length} ${t("cashier.ordersWaiting")}`, accent: "text-[var(--color-text-secondary)]", bar: "bg-[var(--color-muted)]" },
  ]

  return (
    <div className="space-y-4">
      <PageHeader icon={ShoppingBag} title={t("nav.orders")}
        subtitle={`• ${stats.active} ${t("cashier.statActive")}`} />

      {/* Search & Scan */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t("cashier.searchPlaceholder")}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
        <button onClick={() => { setScanError(""); setScannerOpen(true) }}
          className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors shrink-0">
          <QrCode size={15} /> {t("cashier.scanReceipt")}
        </button>
      </div>
      {scanError && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2">{scanError}</div>
      )}

      {/* Stats bar */}
      <StatsBar columns={5} stats={[
        { label: t("cashier.statActive"), value: stats.active, color: "text-[var(--color-primary)]", bg: "bg-[var(--color-primary-muted)]" },
        { label: t("status.pending"), value: stats.pending, color: "text-[var(--color-warning)]", bg: "bg-[var(--color-accent-muted)]" },
        { label: t("status.cooking"), value: stats.cooking, color: "text-[var(--color-flame)]", bg: "bg-[var(--color-flame-muted)]" },
        { label: t("status.ready"), value: stats.ready, color: "text-[var(--color-primary)]", bg: "bg-[var(--color-primary-muted)]" },
        { label: t("common.total"), value: `$${stats.total.toFixed(2)}`, color: "text-[var(--color-plum)]", bg: "bg-[var(--color-plum-muted)]" },
      ]} />

      {isLoading && activeOrders.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted)] text-sm">{t("cashier.loadingOrders")}</div>
      ) : activeOrders.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted)] text-sm">{t("cashier.noActiveOrders")}</div>
      ) : searchQuery && searchedOrders.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted)] text-sm">{t("cashier.noMatchingOrders")} "{searchQuery}".</div>
      ) : (
        sectionConfig.map(({ key, label, sub, accent, bar }) => (
          grouped[key].length > 0 && (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-1 h-5 rounded-full", bar)} />
                <div>
                  <div className={cn("font-semibold text-sm", accent)}>{label}</div>
                  <div className="text-[10px] text-[var(--color-muted)]">{sub}</div>
                </div>
              </div>
              <ActiveOrdersTable
                orders={grouped[key]}
                onPay={setPayOrder}
                onView={setViewOrder}
                onDelete={requestDeleteOrder}
              />
            </div>
          )
        ))
      )}

      <ViewOrderDialog
        order={deleteTarget ? null : activeViewOrder}
        onClose={() => setViewOrder(null)}
        onDeleteItem={requestDeleteItem}
        onUpdateItemQty={updateOrderItemQuantity}
        onUpdateItemNote={updateOrderItemNote}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        busy={deleting}
        danger
        title={
          deleteTarget?.type === "order"
            ? `Delete Order #${String(deleteTarget.order.order_id).padStart(4, "0")}?`
            : "Remove Order Item?"
        }
        message={
          deleteTarget?.type === "order"
            ? `Delete unpaid Order #${String(deleteTarget.order.order_id).padStart(4, "0")} (Table ${deleteTarget.order.table?.table_number || "—"})? This cannot be undone.`
            : deleteTarget?.item
              ? `Remove ${menuItemName(deleteTarget.item.menu_item, lang)} (x${deleteTarget.item.quantity}) from Order #${String(deleteTarget.order.order_id).padStart(4, "0")}?`
              : ""
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        errorMsg={deleteError}
      />

      <PaymentDialog
        order={payOrder}
        paymentMethods={paymentMethods}
        onClose={() => setPayOrder(null)}
        onPaid={fetchOrders}
      />

      {scannerOpen && (
        <ReceiptScanner onFound={handleReceiptFound} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  )
}
