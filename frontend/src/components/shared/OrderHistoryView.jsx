import { useState, useEffect, useMemo } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Receipt,
  ChevronDown,
  ChevronUp,
  Clock,
  Package,
  Printer,
  Users,
  AlertTriangle,
  Search,
  X,
} from "lucide-react"
import { cn, menuItemName, menuItemMatchesSearch } from "@/lib/utils"
import { formatUSD, formatKHR, orderTotal, toLocalDateStr } from "@/lib/currency"
import { isAllergyNote } from "@/lib/noteTags"
import { useOrderStore } from "../../context/orderContext"
import { useTableStore } from "../../context/tableContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { useLang } from "@/i18n/LanguageContext"
import { LoadingState, EmptyState } from "@/components/shared"
import { printOrderReceipt, printDailyReport } from "@/components/cashier/orderHelpers"

const statusCfg = {
  Pending: {
    labelKey: "status.pending",
    color: "text-[var(--color-text-secondary)]",
    bg: "bg-[var(--color-surface-subtle)]",
  },
  Preparing: {
    labelKey: "status.preparing",
    color: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-accent-muted)]",
  },
  Served: {
    labelKey: "status.served",
    color: "text-[var(--color-info)]",
    bg: "bg-[var(--color-info-muted)]",
  },
  Paid: {
    labelKey: "status.paid",
    color: "text-[var(--color-primary)]",
    bg: "bg-[var(--color-primary-muted)]",
  },
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function OrderRow({ order, canPrint }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const cfg = statusCfg[order.status] || statusCfg.Pending
  const total = orderTotal(order)
  const payment = order.payments?.[0]
  const hasAllergy = order.order_items?.some((oi) => isAllergyNote(oi.note))

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-surface-subtle)]/60 transition-colors text-left cursor-pointer"
      >
        <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center shrink-0">
          <Receipt size={15} className="text-[var(--color-primary)]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[var(--color-text)] tabular-nums">
              #{String(order.order_id).padStart(4, "0")}
            </span>
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t("common.table")} {order.table?.table_number || "—"}
            </span>
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}>
              {t(cfg.labelKey)}
            </span>
            {hasAllergy && (
              <AlertTriangle size={12} className="text-[var(--color-danger)] shrink-0" />
            )}
          </div>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">
            {formatTime(order.order_date)} · {order.order_items?.length || 0} {t("station.items")}
            {order.user && ` · ${order.user.username}`}
          </div>
        </div>

        <div className="text-right shrink-0 tabular-nums">
          <div className="text-sm font-bold text-[var(--color-text)]">{formatUSD(total)}</div>
          {payment && (
            <div className="text-[11px] text-[var(--color-muted)]">
              {payment.method?.method_name}
            </div>
          )}
        </div>

        {open ? (
          <ChevronUp size={15} className="text-[var(--color-muted)] shrink-0" />
        ) : (
          <ChevronDown size={15} className="text-[var(--color-muted)] shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-background)]/40 px-4 py-3.5 space-y-3">
          <div className="space-y-2">
            {order.order_items?.map((oi) => {
              const allergy = isAllergyNote(oi.note)
              return (
                <div key={oi.order_item_id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)] text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {oi.quantity}
                      </span>
                      <span className="text-[var(--color-text)] truncate">
                        {menuItemName(oi.menu_item, lang)}
                      </span>
                      {oi.menu_item?.category?.type && (
                        <span className="text-[11px] text-[var(--color-muted)] capitalize">
                          ({oi.menu_item.category.type})
                        </span>
                      )}
                    </div>
                    <span className="text-[var(--color-text)] font-semibold tabular-nums shrink-0">
                      {formatUSD(Number(oi.unit_price) * oi.quantity)}
                    </span>
                  </div>

                  {oi.note && (
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium mt-1 ml-7 px-2 py-0.5 rounded-full",
                        allergy
                          ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)]"
                          : "bg-[var(--color-accent-muted)] text-[var(--color-warning)]"
                      )}
                    >
                      {allergy && <AlertTriangle size={10} />}
                      <span>{oi.note}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="border-t border-[var(--color-border)] pt-2.5 flex justify-between items-center gap-2 flex-wrap">
            <div className="text-xs text-[var(--color-muted)]">
              {payment ? (
                <span>
                  {t("history.paidVia")} {payment.method?.method_name} {t("history.at")}{" "}
                  {formatTime(payment.payment_date)}
                </span>
              ) : (
                <span className="text-[var(--color-warning)] font-medium">
                  {t("history.notPaid")}
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-[var(--color-primary)] tabular-nums">
              {formatUSD(total)}
              <span className="text-xs font-normal text-[var(--color-muted)] ml-1.5">
                {formatKHR(total)}
              </span>
            </div>
          </div>

          {(order.party_size != null || order.note) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {order.party_size != null && (
                <span className="inline-flex items-center gap-1 text-[var(--color-muted)]">
                  <Users size={12} /> {order.party_size}{" "}
                  {order.party_size !== 1 ? t("history.guests") : t("history.guest")}
                </span>
              )}
              {order.note && (
                <span className="text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1">
                  {t("history.note")}: {order.note}
                </span>
              )}
            </div>
          )}

          {canPrint && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => printOrderReceipt(order)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-all cursor-pointer"
              >
                <Printer size={13} /> {t("cashier.printReceipt")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function OrderHistoryView({ canPrint = false }) {
  const { t, lang } = useLang()
  usePageTitle(t("nav.history"))
  const { fetchOrderHistory } = useOrderStore()
  const { tables, fetchTables } = useTableStore()

  const todayStr = toLocalDateStr()
  const [date, setDate] = useState(todayStr)
  const [tableId, setTableId] = useState("")
  const [search, setSearch] = useState("")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchTables().catch(() => {})
  }, [fetchTables])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchOrderHistory(date, tableId || undefined)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setError(t("cashier.submitFailed"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date, tableId, fetchOrderHistory, t])

  const prevDay = () => {
    const d = new Date(`${date}T12:00:00`)
    d.setDate(d.getDate() - 1)
    setDate(toLocalDateStr(d))
  }

  const nextDay = () => {
    const d = new Date(`${date}T12:00:00`)
    d.setDate(d.getDate() + 1)
    const nextStr = toLocalDateStr(d)
    if (nextStr <= todayStr) setDate(nextStr)
  }

  const isToday = date === todayStr

  const displayDate = new Date(`${date}T12:00:00`).toLocaleDateString(
    lang === "km" ? "km-KH" : undefined,
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  )

  const tableLabel = tableId
    ? tables.find((tb) => String(tb.table_id) === String(tableId))?.table_number
    : null

  const searchQuery = search.trim().toLowerCase()
  const searchDigits = searchQuery.replace(/\D/g, "")
  const searchAsNumber = searchDigits ? parseInt(searchDigits, 10) : null

  const filteredOrders = useMemo(() => {
    const list = data?.orders || []
    if (!searchQuery) return list
    return list.filter((o) => {
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
      if (String(o.table?.table_number ?? "").toLowerCase().includes(searchQuery)) return true
      if (o.note && o.note.toLowerCase().includes(searchQuery)) return true
      if (o.order_items?.some((oi) => menuItemMatchesSearch(oi.menu_item, searchQuery))) return true
      if (o.payments?.some((p) => p.method?.method_name?.toLowerCase().includes(searchQuery))) {
        return true
      }
      return false
    })
  }, [data?.orders, searchQuery, searchAsNumber])

  const canPrintDaily = canPrint && !loading && data && data.orders?.length > 0

  return (
    <div className="space-y-4">
      {/* Header + Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text)] flex items-center gap-2.5">
            <Clock size={21} className="text-[var(--color-primary)]" />
            <span>{t("nav.history")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-0.5">
            {t("history.dailySubtitle")}
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-2.5 py-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={prevDay}
            aria-label="Previous day"
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface-subtle)] text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
          >
            <ChevronLeft size={15} />
          </button>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="text-xs sm:text-sm font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
          />
          <button
            type="button"
            onClick={nextDay}
            disabled={isToday}
            aria-label="Next day"
            className={cn(
              "p-1.5 rounded-lg text-[var(--color-muted)] disabled:opacity-35",
              !isToday && "hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)] cursor-pointer"
            )}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("cashier.searchPlaceholder")}
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

          <select
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            aria-label={t("common.table")}
            className="h-10 text-xs sm:text-sm font-semibold text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 outline-none focus:border-[var(--color-primary)] cursor-pointer"
          >
            <option value="">{t("tables.allTables")}</option>
            {tables.map((tb) => (
              <option key={tb.table_id} value={tb.table_id}>
                {tb.table_number}
              </option>
            ))}
          </select>
        </div>

        {canPrint && (
          <button
            type="button"
            onClick={() =>
              canPrintDaily &&
              printDailyReport({ date, displayDate, tableLabel, data })
            }
            disabled={!canPrintDaily}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-4 h-10 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-all disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <Printer size={15} /> {t("history.printDailyReport")}
          </button>
        )}
      </div>

      {/* Summary Strip */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("history.totalOrders"), value: data.summary.total_orders },
            { label: t("history.paidOrders"), value: data.summary.paid_orders, primary: true },
            {
              label: t("history.revenue"),
              value: formatUSD(data.summary.total_revenue),
              sub: formatKHR(data.summary.total_revenue),
              primary: true,
            },
          ].map(({ label, value, sub, primary }) => (
            <div
              key={label}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 text-center shadow-2xs"
            >
              <div
                className={cn(
                  "text-lg sm:text-xl font-bold tabular-nums",
                  primary ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
                )}
              >
                {value}
              </div>
              {sub && <div className="text-[11px] text-[var(--color-muted)] tabular-nums">{sub}</div>}
              <div className="text-[11px] font-medium text-[var(--color-muted)] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <LoadingState text={t("cashier.loadingOrders")} />
      ) : error ? (
        <div className="text-center py-16 text-[var(--color-danger)] text-sm">{error}</div>
      ) : !data || data.orders.length === 0 ? (
        <EmptyState
          icon={Package}
          text={`${t("history.noOrdersOn")} ${displayDate}${
            tableLabel ? ` ${t("history.forTable")} ${tableLabel}` : ""
          }`}
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState icon={Package} text={`${t("history.noOrdersMatching")} "${search}"`} />
      ) : (
        <div className="space-y-2.5">
          <div className="text-xs text-[var(--color-muted)] px-1">
            {displayDate}
            {tableLabel ? ` · ${t("common.table")} ${tableLabel}` : ""}
            {search ? ` · ${filteredOrders.length} ${t("history.matching")} "${search}"` : ""}
          </div>
          {filteredOrders.map((order) => (
            <OrderRow key={order.order_id} order={order} canPrint={canPrint} />
          ))}
        </div>
      )}
    </div>
  )
}
