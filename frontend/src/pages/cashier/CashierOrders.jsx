import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Search, QrCode, X, ShoppingBag } from "lucide-react"
import { cn, menuItemMatchesSearch, menuItemName } from "@/lib/utils"
import { formatUSD, orderTotal } from "@/lib/currency"
import { useOrderStore } from "../../context/orderContext"
import { usePaymentStore } from "../../context/paymentContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"
import { usePageTitle } from "../../hooks/usePageTitle"
import { useLang } from "@/i18n/LanguageContext"
import { ConfirmModal, EmptyState, LoadingState } from "@/components/shared"
import ReceiptScanner from "@/components/cashier/ReceiptScanner"
import ActiveOrdersTable from "@/components/cashier/ActiveOrdersTable"
import ViewOrderDialog from "@/components/cashier/ViewOrderDialog"
import PaymentDialog from "@/components/cashier/PaymentDialog"

export default function CashierOrders() {
  const { t, lang } = useLang()
  usePageTitle("Order Management")
  const {
    orders,
    fetchOrders,
    deleteOrder,
    deleteOrderItem,
    updateOrderItemQuantity,
    updateOrderItemNote,
    isLoading,
  } = useOrderStore()
  const { paymentMethods, fetchPaymentMethods } = usePaymentStore()

  const [payOrderId, setPayOrderId] = useState(null)
  const [viewOrderId, setViewOrderId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [search, setSearch] = useState("")
  const [statusTab, setStatusTab] = useState("all") // "all" | "Served" | "Preparing" | "Pending"
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanError, setScanError] = useState("")
  const [nowMs, setNowMs] = useState(() => Date.now())

  const refetchTimerRef = useRef(null)

  useSocketRole("cashier")

  // Debounce bursts of order_item events into a single refresh
  const scheduleFetchOrders = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null
      fetchOrders().catch(() => {})
    }, 280)
  }, [fetchOrders])

  useEffect(() => {
    fetchOrders().catch(() => {})
    fetchPaymentMethods().catch(() => {})
    const poll = setInterval(() => fetchOrders().catch(() => {}), 60000)
    const clock = setInterval(() => setNowMs(Date.now()), 30000)
    return () => {
      clearInterval(poll)
      clearInterval(clock)
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    }
  }, [fetchOrders, fetchPaymentMethods])

  useSocketEvent("order:new", scheduleFetchOrders)
  useSocketEvent("order:status_changed", scheduleFetchOrders)
  useSocketEvent("order:deleted", scheduleFetchOrders)
  useSocketEvent("order_item:new", scheduleFetchOrders)
  useSocketEvent("order_item:status_changed", scheduleFetchOrders)
  useSocketEvent("order_item:deleted", scheduleFetchOrders)
  useSocketEvent("order_item:updated", scheduleFetchOrders)
  useSocketEvent("order_item:note_changed", scheduleFetchOrders)
  useSocketEvent("payment:completed", scheduleFetchOrders)

  const activeOrders = useMemo(
    () => (orders || []).filter((o) => !(o.is_paid ?? o.status === "Paid")),
    [orders]
  )

  // Always derive both modal orders from live store so totals/items are never stale
  const activeViewOrder = useMemo(
    () => (viewOrderId ? orders.find((o) => o.order_id === viewOrderId) || null : null),
    [orders, viewOrderId]
  )
  const activePayOrder = useMemo(
    () => (payOrderId ? orders.find((o) => o.order_id === payOrderId) || null : null),
    [orders, payOrderId]
  )

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
        if (viewOrderId === deleteTarget.order.order_id) setViewOrderId(null)
        if (payOrderId === deleteTarget.order.order_id) setPayOrderId(null)
      } else {
        const res = await deleteOrderItem(deleteTarget.item.order_item_id)
        if (res?.orderDeleted) {
          if (viewOrderId === deleteTarget.order.order_id) setViewOrderId(null)
          if (payOrderId === deleteTarget.order.order_id) setPayOrderId(null)
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
    const code = `#${String(orderId).padStart(4, "0")}`
    const found = orders.find((o) => o.order_id === orderId)
    if (!found) {
      setScanError(
        lang === "km" ? `រកមិនឃើញការកុម្ម៉ង់ ${code} ទេ។` : `Order ${code} not found.`
      )
      return
    }
    if (found.is_paid ?? found.status === "Paid") {
      setScanError(
        lang === "km"
          ? `ការកុម្ម៉ង់ ${code} ត្រូវបានទូទាត់ប្រាក់រួចហើយ។`
          : `Order ${code} has already been paid.`
      )
      return
    }
    setScanError("")
    setPayOrderId(found.order_id)
  }

  const searchQuery = search.trim().toLowerCase()
  const searchDigits = searchQuery.replace(/\D/g, "")
  const searchAsNumber = searchDigits ? parseInt(searchDigits, 10) : null

  const searchedOrders = useMemo(() => {
    if (!searchQuery) return activeOrders
    return activeOrders.filter((o) => {
      const orderIdStr = String(o.order_id)
      const padded = orderIdStr.padStart(4, "0")
      if (
        (searchAsNumber !== null && o.order_id === searchAsNumber) ||
        orderIdStr.includes(searchQuery) ||
        padded.includes(searchQuery) ||
        `#${orderIdStr}`.includes(searchQuery) ||
        `#${padded}`.includes(searchQuery) ||
        `ord-${padded}`.includes(searchQuery) ||
        `ord-${orderIdStr}`.includes(searchQuery)
      ) {
        return true
      }
      if (searchAsNumber !== null && o.queue_number === searchAsNumber) return true
      const tableNum = String(o.table?.table_number ?? "").toLowerCase()
      if (tableNum && (tableNum.includes(searchQuery) || `table ${tableNum}`.includes(searchQuery))) {
        return true
      }
      if (o.note && o.note.toLowerCase().includes(searchQuery)) return true
      if (o.order_items?.some((oi) => menuItemMatchesSearch(oi.menu_item, searchQuery))) return true
      return false
    })
  }, [activeOrders, searchQuery, searchAsNumber])

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchQuery) {
      if (searchedOrders.length === 1) {
        setPayOrderId(searchedOrders[0].order_id)
      } else if (searchAsNumber !== null) {
        const exact = activeOrders.find((o) => o.order_id === searchAsNumber)
        if (exact) setPayOrderId(exact.order_id)
      }
    }
  }

  const stats = useMemo(
    () => ({
      active: activeOrders.length,
      pending: activeOrders.filter((o) => o.status === "Pending").length,
      cooking: activeOrders.filter((o) => o.status === "Preparing").length,
      ready: activeOrders.filter((o) => o.status === "Served").length,
      total: activeOrders.reduce((s, o) => s + orderTotal(o), 0),
    }),
    [activeOrders]
  )

  const grouped = useMemo(
    () => ({
      Served: searchedOrders.filter((o) => o.status === "Served"),
      Preparing: searchedOrders.filter((o) => o.status === "Preparing"),
      Pending: searchedOrders.filter((o) => o.status === "Pending"),
    }),
    [searchedOrders]
  )

  const sectionConfig = [
    {
      key: "Served",
      label: t("cashier.readyForPayment"),
      sub: `${grouped.Served.length} ${t("cashier.orders")}`,
      accent: "text-[var(--color-primary)]",
      dot: "bg-[var(--color-primary)]",
    },
    {
      key: "Preparing",
      label: t("cashier.beingPrepared"),
      sub: `${grouped.Preparing.length} ${t("cashier.ordersInKitchen")}`,
      accent: "text-[var(--color-warning)]",
      dot: "bg-[var(--color-warning)]",
    },
    {
      key: "Pending",
      label: t("cashier.newOrders"),
      sub: `${grouped.Pending.length} ${t("cashier.ordersWaiting")}`,
      accent: "text-[var(--color-text-secondary)]",
      dot: "bg-[var(--color-muted)]",
    },
  ].filter((sec) => statusTab === "all" || sec.key === statusTab)

  const visibleCount = sectionConfig.reduce((s, sec) => s + grouped[sec.key].length, 0)

  const deleteCode = deleteTarget?.order
    ? `#${String(deleteTarget.order.order_id).padStart(4, "0")}`
    : ""

  return (
    <div className="space-y-5">
      {/* Top Toolbar: Search + Scan + Live Unpaid Total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("cashier.searchPlaceholder")}
              className="w-full h-10 pl-10 pr-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/75 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)] transition-all"
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

          <button
            type="button"
            onClick={() => {
              setScanError("")
              setScannerOpen(true)
            }}
            className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs sm:text-sm font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors shrink-0 cursor-pointer"
          >
            <QrCode size={15} />
            <span className="hidden sm:inline">{t("cashier.scanReceipt")}</span>
          </button>
        </div>

        {/* Calm Unpaid Summary Pill */}
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] self-start sm:self-auto">
          <span className="text-xs text-[var(--color-muted)]">
            {stats.active} {t("cashier.statActive")}
          </span>
          <span className="h-4 w-px bg-[var(--color-border)]" />
          <span className="text-sm font-bold text-[var(--color-primary)] tabular-nums">
            {formatUSD(stats.total)}
          </span>
        </div>
      </div>

      {scanError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 text-xs sm:text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-4 py-2.5"
        >
          <span>{scanError}</span>
          <button
            type="button"
            onClick={() => setScanError("")}
            aria-label="Dismiss scan error"
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Clean Interactive Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: "all", label: t("common.all"), count: stats.active },
          { key: "Served", label: t("status.ready"), count: stats.ready, dot: "bg-[var(--color-primary)]" },
          { key: "Preparing", label: t("status.cooking"), count: stats.cooking, dot: "bg-[var(--color-warning)]" },
          { key: "Pending", label: t("status.pending"), count: stats.pending, dot: "bg-[var(--color-muted)]" },
        ].map(({ key, label, count, dot }) => {
          const active = statusTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusTab(key)}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                active
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-2xs"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
              )}
            >
              {dot && !active && <span className={cn("w-2 h-2 rounded-full", dot)} />}
              <span>{label}</span>
              <span
                className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded-full font-bold tabular-nums",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Orders Grid Sections */}
      {isLoading && activeOrders.length === 0 ? (
        <LoadingState text={t("cashier.loadingOrders")} />
      ) : activeOrders.length === 0 ? (
        <EmptyState icon={ShoppingBag} text={t("cashier.noActiveOrders")} />
      ) : visibleCount === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          text={
            searchQuery
              ? `${t("cashier.noMatchingOrders")} "${searchQuery}".`
              : t("cashier.noActiveOrders")
          }
        />
      ) : (
        <div className="space-y-6">
          {sectionConfig.map(
            ({ key, label, sub, accent, dot }) =>
              grouped[key].length > 0 && (
                <section key={key} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", dot)} />
                    <h2 className={cn("font-semibold text-sm", accent)}>{label}</h2>
                    <span className="text-xs text-[var(--color-muted)]">· {sub}</span>
                  </div>
                  <ActiveOrdersTable
                    orders={grouped[key]}
                    nowMs={nowMs}
                    onPay={(ord) => setPayOrderId(ord.order_id)}
                    onView={(ord) => setViewOrderId(ord.order_id)}
                    onDelete={requestDeleteOrder}
                  />
                </section>
              )
          )}
        </div>
      )}

      <ViewOrderDialog
        order={deleteTarget ? null : activeViewOrder}
        onClose={() => setViewOrderId(null)}
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
            ? lang === "km"
              ? `លុបការកុម្ម៉ង់ ${deleteCode}?`
              : `Delete Order ${deleteCode}?`
            : lang === "km"
              ? "ដកមុខម្ហូបចេញពីការកុម្ម៉ង់?"
              : "Remove Order Item?"
        }
        message={
          deleteTarget?.type === "order"
            ? lang === "km"
              ? `លុបការកុម្ម៉ង់មិនទាន់ទូទាត់ ${deleteCode} (តុ ${deleteTarget.order.table?.table_number || "—"})? មិនអាចត្រឡប់វិញបានទេ។`
              : `Delete unpaid Order ${deleteCode} (Table ${deleteTarget.order.table?.table_number || "—"})? This cannot be undone.`
            : deleteTarget?.item
              ? lang === "km"
                ? `ដក ${menuItemName(deleteTarget.item.menu_item, lang)} (×${deleteTarget.item.quantity}) ចេញពីការកុម្ម៉ង់ ${deleteCode}?`
                : `Remove ${menuItemName(deleteTarget.item.menu_item, lang)} (×${deleteTarget.item.quantity}) from Order ${deleteCode}?`
              : ""
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        errorMsg={deleteError}
      />

      <PaymentDialog
        order={activePayOrder}
        paymentMethods={paymentMethods}
        onClose={() => setPayOrderId(null)}
        onPaid={fetchOrders}
      />

      {scannerOpen && (
        <ReceiptScanner
          onFound={handleReceiptFound}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  )
}
