import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Clock,
  Flame,
  Wifi,
  WifiOff,
  Users,
  AlertTriangle,
  Check,
  RefreshCw,
  Loader2,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { cn, menuItemName } from "@/lib/utils"
import { useOrderItemStore } from "../../context/orderItemContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"
import { usePageTitle } from "../../hooks/usePageTitle"
import { ConnectionBadge } from "@/components/shared"
import { isAllergyNote } from "@/lib/noteTags"
import { useLang } from "@/i18n/LanguageContext"

function groupByOrder(items) {
  const map = new Map()
  for (const oi of items) {
    const orderId = oi.order?.order_id
    if (!map.has(orderId)) {
      map.set(orderId, {
        order_id: orderId,
        queue_number: oi.order?.queue_number,
        party_size: oi.order?.party_size,
        table_number: oi.order?.table?.table_number || "—",
        order_date: oi.order?.order_date,
        note: oi.order?.note,
        items: [],
      })
    }
    map.get(orderId).items.push(oi)
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.order_date) - new Date(b.order_date)
  )
}

function getWaitMinutes(dateStr, nowMs) {
  if (!dateStr) return 0
  return Math.max(0, Math.floor((nowMs - new Date(dateStr).getTime()) / 60000))
}

function formatWaitLabel(mins) {
  if (mins < 1) return "<1m"
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function StationOrders({ config }) {
  const { t, lang } = useLang()
  usePageTitle(t(config.pageTitleKey))

  const store = useOrderItemStore()
  const queue = store[config.queueKey] || []
  const fetchQueue = store[config.fetchKey]
  const { updateItemStatus, isLoading } = store

  const [filter, setFilter] = useState("all")
  const [compact, setCompact] = useState(false)
  const [newOrderIds, setNewOrderIds] = useState(new Set())
  const [busyOrderIds, setBusyOrderIds] = useState(new Set())
  const [busyItemIds, setBusyItemIds] = useState(new Set())
  const [nowMs, setNowMs] = useState(() => Date.now())

  const newTimersRef = useRef(new Map())

  const { connected } = useSocketRole(config.role)

  const flagNew = useCallback((orderId) => {
    if (!orderId) return
    setNewOrderIds((prev) => new Set(prev).add(orderId))
    const prevTimer = newTimersRef.current.get(orderId)
    if (prevTimer) clearTimeout(prevTimer)
    const timer = setTimeout(() => {
      newTimersRef.current.delete(orderId)
      setNewOrderIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }, 8000)
    newTimersRef.current.set(orderId, timer)
  }, [])

  // Queue refetching on socket events is already debounced in useStaffNotifications (Layout).
  // Here we only highlight newly arriving orders + keep a 60s safety poll and 15s wait clock.
  useSocketEvent("order:new", (order) => flagNew(order?.order_id))
  useSocketEvent("order_item:new", (item) =>
    flagNew(item?.order_id ?? item?.order?.order_id)
  )

  useEffect(() => {
    fetchQueue().catch(() => {})
    const poll = setInterval(() => fetchQueue().catch(() => {}), 60000)
    const clock = setInterval(() => setNowMs(Date.now()), 15000)
    return () => {
      clearInterval(poll)
      clearInterval(clock)
      newTimersRef.current.forEach((timer) => clearTimeout(timer))
      newTimersRef.current.clear()
    }
  }, [fetchQueue])

  const filteredQueue = useMemo(
    () => (filter === "all" ? queue : queue.filter((i) => i.status === filter)),
    [queue, filter]
  )

  const orders = useMemo(() => groupByOrder(filteredQueue), [filteredQueue])

  const stats = useMemo(
    () => ({
      all: queue.length,
      pending: queue.filter((i) => i.status === "Pending").length,
      preparing: queue.filter((i) => i.status === "Preparing").length,
    }),
    [queue]
  )

  const statusCfg = {
    Pending: {
      label: t("status.pending"),
      pill: "bg-[var(--color-accent-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/25",
      topBar: "bg-[var(--color-warning)]",
      actionLabel: t(config.labels.startActionKey),
      actionBtn:
        "bg-[var(--color-accent-muted)] hover:bg-[var(--color-warning)] text-[var(--color-warning)] hover:text-white border border-[var(--color-warning)]/30",
      nextStatus: "Preparing",
      icon: Clock,
    },
    Preparing: {
      label: t(config.labels.preparingKey),
      pill: "bg-[var(--color-flame-muted)] text-[var(--color-flame)] border border-[var(--color-flame)]/25",
      topBar: "bg-[var(--color-flame)]",
      actionLabel: t("station.markReady"),
      actionBtn:
        "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white shadow-xs",
      nextStatus: "Ready",
      icon: Flame,
    },
  }

  const orderStatus = (order) =>
    order.items.some((i) => i.status === "Pending") ? "Pending" : "Preparing"

  // Double-tap safe whole-ticket advance
  const advanceOrder = async (order) => {
    if (busyOrderIds.has(order.order_id)) return
    const current = orderStatus(order)
    const next = statusCfg[current]?.nextStatus
    if (!next) return

    const itemsToUpdate = order.items.filter((i) => i.status === current)
    if (itemsToUpdate.length === 0) return

    setBusyOrderIds((prev) => new Set(prev).add(order.order_id))
    try {
      await Promise.all(
        itemsToUpdate.map((i) => updateItemStatus(i.order_item_id, next))
      )
      await fetchQueue()
    } catch (err) {
      console.error(err)
    } finally {
      setBusyOrderIds((prev) => {
        const nextSet = new Set(prev)
        nextSet.delete(order.order_id)
        return nextSet
      })
    }
  }

  // Double-tap safe single-item bump
  const advanceItem = async (item) => {
    if (busyItemIds.has(item.order_item_id)) return
    const next =
      item.status === "Pending"
        ? "Preparing"
        : item.status === "Preparing"
          ? "Ready"
          : null
    if (!next) return

    setBusyItemIds((prev) => new Set(prev).add(item.order_item_id))
    try {
      await updateItemStatus(item.order_item_id, next)
      await fetchQueue()
    } catch (err) {
      console.error(err)
    } finally {
      setBusyItemIds((prev) => {
        const nextSet = new Set(prev)
        nextSet.delete(item.order_item_id)
        return nextSet
      })
    }
  }

  const HeaderIcon = config.icons.header
  const EmptyIcon = config.icons.empty

  const filterTabs = [
    { label: t("station.allOrders"), key: "all", count: stats.all, icon: config.icons.all },
    { label: t("status.pending"), key: "Pending", count: stats.pending, icon: Clock },
    { label: t(config.labels.statNowKey), key: "Preparing", count: stats.preparing, icon: Flame },
  ]

  return (
    <div className="space-y-4">
      {/* KDS Top Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-muted)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
            <HeaderIcon size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--color-text)] leading-tight">
              {t(config.headerKey)}
            </h1>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {t(config.subtitleKey)} · {orders.length} {t("cashier.orders")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ConnectionBadge connected={connected} WifiIcon={Wifi} WifiOffIcon={WifiOff} />

          <button
            type="button"
            onClick={() => setCompact((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/60 hover:bg-[var(--color-surface-subtle)] text-xs font-semibold text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            {compact ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            <span>
              {compact
                ? lang === "km"
                  ? "ពង្រីក"
                  : "Expand"
                : lang === "km"
                  ? "បង្រួម"
                  : "Compact"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => fetchQueue().catch(() => {})}
            disabled={isLoading}
            aria-label="Refresh queue"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/60 hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)] text-xs font-semibold text-[var(--color-text-secondary)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{t("guest.refresh")}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs with Live Item Counters */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {filterTabs.map(({ label, key, count, icon: Icon }) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer min-h-[42px]",
                active
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/40"
              )}
            >
              <Icon size={15} />
              <span>{label}</span>
              <span
                className={cn(
                  "text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums",
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

      {/* Multi-Column KDS Ticket Board */}
      {isLoading && orders.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-muted)] text-sm">
          {t("cashier.loadingOrders")}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl text-center py-20 px-4 text-[var(--color-muted)]">
          <EmptyIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{t("station.noOrders")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {orders.map((order) => {
            const status = orderStatus(order)
            const cfg = statusCfg[status]
            const StatusIcon = cfg.icon
            const isNew = newOrderIds.has(order.order_id)
            const isBusy = busyOrderIds.has(order.order_id)
            const hasAllergy = order.items.some((i) => isAllergyNote(i.note))
            const waitMins = getWaitMinutes(order.order_date, nowMs)
            const isLate = waitMins >= 20
            const isWarn = waitMins >= 10 && waitMins < 20
            const totalUnits = order.items.reduce((s, i) => s + Number(i.quantity || 0), 0)

            return (
              <article
                key={order.order_id}
                className={cn(
                  "bg-[var(--color-surface)] border rounded-2xl overflow-hidden shadow-xs flex flex-col transition-all",
                  hasAllergy
                    ? "border-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/25"
                    : isNew
                      ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30"
                      : isLate
                        ? "border-[var(--color-danger)]/60"
                        : "border-[var(--color-border)]"
                )}
              >
                {/* Status Accent Bar */}
                <div
                  className={cn(
                    "h-1.5 w-full",
                    hasAllergy ? "bg-[var(--color-danger)]" : cfg.topBar
                  )}
                />

                {/* Unmistakable Allergy Banner */}
                {hasAllergy && (
                  <div className="bg-[var(--color-danger)] text-white px-4 py-1.5 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>
                      {lang === "km"
                        ? "ប្រយ័ត្ន! មានចំណាំអាលែកហ្ស៊ី"
                        : "ALLERGY ALERT — CHECK ITEM NOTES"}
                    </span>
                  </div>
                )}

                {/* Ticket Header */}
                <div className="p-4 pb-3 border-b border-[var(--color-border)]/80 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)] text-white flex flex-col items-center justify-center shrink-0 leading-none">
                      <span className="text-[9px] uppercase opacity-75">Q</span>
                      <span className="text-sm font-extrabold tabular-nums">
                        {order.queue_number != null ? `#${order.queue_number}` : "—"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-base text-[var(--color-text)]">
                          {t("common.table")} {order.table_number}
                        </span>
                        {isNew && (
                          <span className="text-[10px] font-bold bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-muted)] flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-medium tabular-nums">
                          #{String(order.order_id).padStart(4, "0")}
                        </span>
                        <span>· {totalUnits} {t("station.items")}</span>
                        {order.party_size != null && (
                          <span className="inline-flex items-center gap-0.5">
                            · <Users size={11} /> {order.party_size}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Elapsed Wait Timer Pill */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums",
                        isLate
                          ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)]"
                          : isWarn
                            ? "bg-[var(--color-accent-muted)] text-[var(--color-warning)]"
                            : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]"
                      )}
                    >
                      <Clock size={12} />
                      {formatWaitLabel(waitMins)}
                    </span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", cfg.pill)}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Whole-Order Note */}
                {order.note && (
                  <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-[var(--color-accent-muted)] border border-[var(--color-warning)]/25 text-xs font-medium text-[var(--color-warning)]">
                    <span className="font-bold">{t("history.note")}:</span> {order.note}
                  </div>
                )}

                {/* Open Ticket Line Items */}
                {!compact && (
                  <div className="p-4 space-y-2.5 flex-1">
                    {order.items.map((item) => {
                      const allergy = isAllergyNote(item.note)
                      const itemBusy = busyItemIds.has(item.order_item_id)
                      const isPreparing = item.status === "Preparing"

                      return (
                        <div
                          key={item.order_item_id}
                          className={cn(
                            "flex items-start justify-between gap-2.5 p-2.5 rounded-xl border transition-colors",
                            allergy
                              ? "bg-[var(--color-danger-muted)]/60 border-[var(--color-danger)]/35"
                              : isPreparing
                                ? "bg-[var(--color-accent-muted)]/30 border-[var(--color-warning)]/25"
                                : "bg-[var(--color-background)]/70 border-[var(--color-border)]/80"
                          )}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="w-7 h-7 rounded-lg bg-[var(--color-primary-muted)] text-[var(--color-primary)] font-extrabold text-sm flex items-center justify-center shrink-0 tabular-nums">
                              {item.quantity}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-[var(--color-text)] leading-snug">
                                {menuItemName(item.menu_item, lang)}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                                    isPreparing
                                      ? "bg-[var(--color-flame-muted)] text-[var(--color-flame)]"
                                      : "bg-[var(--color-surface-subtle)] text-[var(--color-muted)]"
                                  )}
                                >
                                  {isPreparing
                                    ? t(config.labels.preparingKey)
                                    : t("status.pending")}
                                </span>

                                {item.note && (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md",
                                      allergy
                                        ? "bg-[var(--color-danger)] text-white"
                                        : "bg-[var(--color-accent-muted)] text-[var(--color-warning)]"
                                    )}
                                  >
                                    {allergy && <AlertTriangle size={10} />}
                                    <span>{item.note}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Individual Item Bump Button */}
                          <button
                            type="button"
                            disabled={itemBusy || isBusy}
                            onClick={() => advanceItem(item)}
                            title={
                              isPreparing
                                ? t("station.markReady")
                                : t(config.labels.startActionKey)
                            }
                            aria-label={
                              isPreparing
                                ? `Mark ${menuItemName(item.menu_item, lang)} ready`
                                : `Start ${menuItemName(item.menu_item, lang)}`
                            }
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-45",
                              isPreparing
                                ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]"
                                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-warning)] hover:bg-[var(--color-warning)] hover:text-white hover:border-[var(--color-warning)]"
                            )}
                          >
                            {itemBusy ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : isPreparing ? (
                              <Check size={15} />
                            ) : (
                              <Flame size={14} />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Ticket Primary Action Footer */}
                <div className="p-4 pt-3 mt-auto border-t border-[var(--color-border)]/70">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => advanceOrder(order)}
                    className={cn(
                      "w-full min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-55 active:scale-[0.99]",
                      cfg.actionBtn
                    )}
                  >
                    {isBusy ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <StatusIcon size={16} />
                    )}
                    <span>{cfg.actionLabel}</span>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
