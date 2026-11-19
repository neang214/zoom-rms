import { useState, useMemo } from "react"
import {
  ShoppingCart,
  TrendingUp,
  Receipt,
  Printer,
  DollarSign,
  Calendar,
  Download,
  CreditCard,
  CheckCircle2,
  Search,
  ArrowRight,
  BarChart3,
  Eye,
  FileSpreadsheet,
} from "lucide-react"
import {
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Input,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import {
  KHR_RATE,
  formatUSD,
  formatKHR,
  orderTotal,
  toLocalDateStr,
  escapeHtml,
  sanitizeCsvCell,
} from "@/lib/currency"
import {
  printExecutiveReport,
  printThermalReport,
  printOrderReceipt,
} from "@/components/cashier/orderHelpers"
import ViewOrderDialog from "@/components/cashier/ViewOrderDialog"
import { useLang } from "@/i18n/LanguageContext"

export { orderTotal, toLocalDateStr }
export const periods = ["Daily", "Yesterday", "Weekly", "Monthly", "Custom"]

export function getDateRangeForPeriod(period, customFrom, customTo) {
  const now = new Date()
  const todayStr = toLocalDateStr(now)

  if (period === "Daily") {
    return { from: todayStr, to: todayStr, label: `Daily (${todayStr})` }
  }
  if (period === "Yesterday") {
    const yest = new Date(now)
    yest.setDate(now.getDate() - 1)
    const yestStr = toLocalDateStr(yest)
    return { from: yestStr, to: yestStr, label: `Yesterday (${yestStr})` }
  }
  if (period === "Weekly") {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    const fromStr = toLocalDateStr(start)
    return { from: fromStr, to: todayStr, label: `Last 7 Days (${fromStr} → ${todayStr})` }
  }
  if (period === "Monthly") {
    const fromStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
    return { from: fromStr, to: todayStr, label: `This Month (${fromStr} → ${todayStr})` }
  }
  const from = customFrom || todayStr
  const to = customTo || todayStr
  return {
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    label: from === to ? `Custom (${from})` : `Custom (${from} → ${to})`,
  }
}

export function filterOrdersByRange(orders = [], fromStr, toStr) {
  const start = new Date(`${fromStr}T00:00:00`)
  const end = new Date(`${toStr}T23:59:59.999`)
  return orders.filter((o) => {
    const d = new Date(o.order_date)
    return d >= start && d <= end
  })
}

export function filterPaymentsByRange(payments = [], fromStr, toStr) {
  const start = new Date(`${fromStr}T00:00:00`)
  const end = new Date(`${toStr}T23:59:59.999`)
  return payments.filter((p) => {
    if (!p.payment_date) return false
    const d = new Date(p.payment_date)
    return d >= start && d <= end
  })
}

function exportOrdersCsv(orders, periodLabel) {
  const headers = [
    "Order ID",
    "Table",
    "Date",
    "Status",
    "Payment Method",
    "Items Count",
    "Total (USD)",
    "Total (KHR)",
  ]
  const rows = orders.map((o) => {
    const total = orderTotal(o)
    const itemCount = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
    const method = o.payments?.[0]?.method?.method_name || (o.status === "Paid" ? "Paid" : "Unpaid")
    return [
      `ORD-${String(o.order_id).padStart(4, "0")}`,
      o.table?.table_number || "—",
      new Date(o.order_date).toLocaleString(),
      o.status,
      method,
      itemCount,
      total.toFixed(2),
      Math.round(total * KHR_RATE),
    ]
  })

  const csvContent = [headers, ...rows]
    .map((r) => r.map(sanitizeCsvCell).join(","))
    .join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `zoom-report-${periodLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportOrdersExcel({ orders, periodLabel, totalRevenue, paidOrdersCount, avgOrderValue }) {
  const rowsHtml = orders
    .map((o, idx) => {
      const total = orderTotal(o)
      const itemCount = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
      const method =
        o.payments?.[0]?.method?.method_name || (o.status === "Paid" ? "Paid" : "Unpaid")
      const bg = idx % 2 === 0 ? "#ffffff" : "#f6f6f3"
      return `
      <tr style="background-color:${bg};">
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:center;">ORD-${String(o.order_id).padStart(4, "0")}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:center;">${escapeHtml(o.table?.table_number || "—")}</td>
        <td style="border:1px solid #cdd3cb; padding:6px;">${escapeHtml(new Date(o.order_date).toLocaleString())}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:center;">${escapeHtml(o.status)}</td>
        <td style="border:1px solid #cdd3cb; padding:6px;">${escapeHtml(method)}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:center;">${itemCount}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:right; font-weight:bold; color:#1b4d3e;">$${total.toFixed(2)}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:right;">៛${Math.round(total * KHR_RATE).toLocaleString()}</td>
      </tr>
    `
    })
    .join("")

  const totalItems = orders.reduce(
    (sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0),
    0
  )
  const grandTotalUSD = orders.reduce((sum, o) => sum + orderTotal(o), 0)
  const grandTotalKHR = Math.round(grandTotalUSD * KHR_RATE)

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family: 'Kantumruy Pro', 'Khmer OS Siemreap', Arial, sans-serif;">
        <table>
          <tr>
            <td colspan="8" style="font-size:18px; font-weight:bold; color:#1b4d3e; padding:10px 0;">
              ZOOM GARDEN CAFÉ &amp; WINE — SALES REPORT (${escapeHtml(periodLabel)})
            </td>
          </tr>
          <tr>
            <td colspan="2" style="background:#ebf3ef; border:1px solid #1b4d3e; padding:8px; font-weight:bold;">
              Paid Revenue: $${totalRevenue.toFixed(2)} (៛${Math.round(totalRevenue * KHR_RATE).toLocaleString()})
            </td>
            <td colspan="2" style="background:#f6f6f3; border:1px solid #cdd3cb; padding:8px; font-weight:bold;">
              Paid Orders: ${paidOrdersCount} / ${orders.length}
            </td>
            <td colspan="2" style="background:#f6f6f3; border:1px solid #cdd3cb; padding:8px; font-weight:bold;">
              Avg Ticket: $${avgOrderValue.toFixed(2)}
            </td>
            <td colspan="2" style="background:#f6f6f3; border:1px solid #cdd3cb; padding:8px; font-weight:bold;">
              Exported: ${escapeHtml(new Date().toLocaleString())}
            </td>
          </tr>
          <tr><td colspan="8"></td></tr>
          <thead>
            <tr style="background-color:#1b4d3e; color:#ffffff; font-weight:bold;">
              <th style="border:1px solid #13382d; padding:8px;">Order ID</th>
              <th style="border:1px solid #13382d; padding:8px;">Table</th>
              <th style="border:1px solid #13382d; padding:8px;">Date &amp; Time</th>
              <th style="border:1px solid #13382d; padding:8px;">Status</th>
              <th style="border:1px solid #13382d; padding:8px;">Payment Method</th>
              <th style="border:1px solid #13382d; padding:8px;">Items</th>
              <th style="border:1px solid #13382d; padding:8px;">Total (USD)</th>
              <th style="border:1px solid #13382d; padding:8px;">Total (KHR)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background-color:#ebf3ef; font-weight:bold;">
              <td colspan="5" style="border:1px solid #1b4d3e; padding:8px; text-align:right;">GRAND TOTAL (${orders.length} Orders):</td>
              <td style="border:1px solid #1b4d3e; padding:8px; text-align:center;">${totalItems}</td>
              <td style="border:1px solid #1b4d3e; padding:8px; text-align:right; color:#1b4d3e;">$${grandTotalUSD.toFixed(2)}</td>
              <td style="border:1px solid #1b4d3e; padding:8px; text-align:right; color:#1b4d3e;">៛${grandTotalKHR.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `zoom-report-${periodLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.xls`
  link.click()
  URL.revokeObjectURL(url)
}

function exportPaymentsExcel(payments = [], periodLabel = "All") {
  const rowsHtml = payments
    .map((p, idx) => {
      const amt = Number(p.amount || 0)
      const ordId = p.order_id || p.order?.order_id
      const bg = idx % 2 === 0 ? "#ffffff" : "#f6f6f3"
      return `
      <tr style="background-color:${bg};">
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:center;">PAY-${String(p.payment_id).padStart(4, "0")}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:center;">${ordId ? `ORD-${String(ordId).padStart(4, "0")}` : "—"}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:center;">${escapeHtml(p.order?.table?.table_number || "—")}</td>
        <td style="border:1px solid #cdd3cb; padding:6px;">${escapeHtml(p.method?.method_name || "—")}</td>
        <td style="border:1px solid #cdd3cb; padding:6px;">${escapeHtml(p.external_ref || "—")}</td>
        <td style="border:1px solid #cdd3cb; padding:6px;">${escapeHtml(p.user?.username || "—")}</td>
        <td style="border:1px solid #cdd3cb; padding:6px;">${escapeHtml(p.payment_date ? new Date(p.payment_date).toLocaleString() : "—")}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:center;">${escapeHtml(p.status)}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:right; font-weight:bold; color:#1b4d3e;">$${amt.toFixed(2)}</td>
        <td style="border:1px solid #cdd3cb; padding:6px; text-align:right;">៛${Math.round(amt * KHR_RATE).toLocaleString()}</td>
      </tr>
    `
    })
    .join("")

  const grandTotalUSD = payments
    .filter((p) => p.status === "Completed")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const grandTotalKHR = Math.round(grandTotalUSD * KHR_RATE)

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family: 'Kantumruy Pro', 'Khmer OS Siemreap', Arial, sans-serif;">
        <table>
          <tr>
            <td colspan="10" style="font-size:18px; font-weight:bold; color:#1b4d3e; padding:10px 0;">
              ZOOM GARDEN CAFÉ &amp; WINE — PAYMENTS LOG (${escapeHtml(periodLabel)})
            </td>
          </tr>
          <thead>
            <tr style="background-color:#1b4d3e; color:#ffffff; font-weight:bold;">
              <th style="border:1px solid #13382d; padding:8px;">Payment ID</th>
              <th style="border:1px solid #13382d; padding:8px;">Order ID</th>
              <th style="border:1px solid #13382d; padding:8px;">Table</th>
              <th style="border:1px solid #13382d; padding:8px;">Method</th>
              <th style="border:1px solid #13382d; padding:8px;">Bakong Ref / MD5</th>
              <th style="border:1px solid #13382d; padding:8px;">Cashier</th>
              <th style="border:1px solid #13382d; padding:8px;">Date &amp; Time</th>
              <th style="border:1px solid #13382d; padding:8px;">Status</th>
              <th style="border:1px solid #13382d; padding:8px;">Amount (USD)</th>
              <th style="border:1px solid #13382d; padding:8px;">Amount (KHR)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background-color:#ebf3ef; font-weight:bold;">
              <td colspan="8" style="border:1px solid #1b4d3e; padding:8px; text-align:right;">TOTAL COMPLETED (${payments.length} Payments):</td>
              <td style="border:1px solid #1b4d3e; padding:8px; text-align:right; color:#1b4d3e;">$${grandTotalUSD.toFixed(2)}</td>
              <td style="border:1px solid #1b4d3e; padding:8px; text-align:right; color:#1b4d3e;">៛${grandTotalKHR.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `zoom-payments-${periodLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.xls`
  link.click()
  URL.revokeObjectURL(url)
}

export function PaymentStats({ orders = [], todaysPayments = [], todaysRevenue = 0 }) {
  const { t, lang } = useLang()

  const todaysCash = todaysPayments
    .filter((p) => /cash|សាច់ប្រាក់/i.test(p.method?.method_name || ""))
    .reduce((s, p) => s + Number(p.amount || 0), 0)

  const todaysDigital = Math.max(0, todaysRevenue - todaysCash)

  const allTimeRevenue = orders
    .filter((o) => o.status === "Paid")
    .reduce((s, o) => s + orderTotal(o), 0)

  const cards = [
    {
      label: t("reports.todaysRevenue"),
      value: formatUSD(todaysRevenue),
      sub: `${formatKHR(todaysRevenue)} · ${todaysPayments.length} ${t("reports.ordersPaidToday")}`,
      icon: TrendingUp,
      featured: true,
    },
    {
      label: lang === "km" ? "សាច់ប្រាក់ថ្ងៃនេះ" : "Cash Today",
      value: formatUSD(todaysCash),
      sub: formatKHR(todaysCash),
      icon: DollarSign,
    },
    {
      label: lang === "km" ? "KHQR / ឌីជីថលថ្ងៃនេះ" : "KHQR / Digital Today",
      value: formatUSD(todaysDigital),
      sub: formatKHR(todaysDigital),
      icon: CreditCard,
    },
    {
      label: t("reports.totalRevenueAllTime"),
      value: formatUSD(allTimeRevenue),
      sub: `${formatKHR(allTimeRevenue)} (${orders.length} ${t("cashier.orders")})`,
      icon: ShoppingCart,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, sub, icon: Icon, featured }) => (
        <Card
          key={label}
          className={cn(
            "p-5 hover:shadow-md transition-shadow",
            featured && "border-[var(--color-primary)]/35 bg-[var(--color-primary-muted)]/35"
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              {label}
            </span>
            <div
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                featured
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-subtle)] text-[var(--color-primary)]"
              )}
            >
              <Icon size={15} />
            </div>
          </div>
          <div
            className={cn(
              "font-display text-2xl font-bold mb-1 tabular-nums",
              featured ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
            )}
          >
            {value}
          </div>
          <div className="text-xs text-[var(--color-muted)] truncate">{sub}</div>
        </Card>
      ))}
    </div>
  )
}

export function PaymentsTable({ payments = [], orders = [], isLoading = false }) {
  const { t, lang } = useLang()
  const todayStr = toLocalDateStr()

  const [activePeriod, setActivePeriod] = useState("Daily")
  const [customFrom, setCustomFrom] = useState(todayStr)
  const [customTo, setCustomTo] = useState(todayStr)
  const [methodFilter, setMethodFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [viewOrder, setViewOrder] = useState(null)

  const periodOptions = ["All", "Daily", "Yesterday", "Weekly", "Monthly", "Custom"]
  const periodLabelKey = {
    All: "common.all",
    Daily: "reports.daily",
    Yesterday: "reports.yesterday",
    Weekly: "reports.weekly",
    Monthly: "reports.monthly",
    Custom: "reports.custom",
  }

  const range = useMemo(() => {
    if (activePeriod === "All") return { from: null, to: null, label: "All Time" }
    return getDateRangeForPeriod(activePeriod, customFrom, customTo)
  }, [activePeriod, customFrom, customTo])

  const methodNames = useMemo(() => {
    const set = new Set(payments.map((p) => p.method?.method_name).filter(Boolean))
    return ["All", ...Array.from(set)]
  }, [payments])

  const orderMap = useMemo(() => {
    const map = new Map()
    for (const o of orders) map.set(o.order_id, o)
    return map
  }, [orders])

  const resolveOrder = (payment) => {
    const ordId = payment.order_id || payment.order?.order_id
    return orderMap.get(ordId) || payment.order || null
  }

  const rangedPayments = useMemo(() => {
    if (activePeriod === "All" || !range.from || !range.to) return payments
    return filterPaymentsByRange(payments, range.from, range.to)
  }, [payments, activePeriod, range.from, range.to])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rangedPayments.filter((p) => {
      if (methodFilter !== "All" && p.method?.method_name !== methodFilter) return false
      if (!q) return true
      const payId = String(p.payment_id)
      const ordId = String(p.order_id || p.order?.order_id || "")
      const ordPadded = ordId.padStart(4, "0")
      const tbl = String(p.order?.table?.table_number || "").toLowerCase()
      const method = String(p.method?.method_name || "").toLowerCase()
      const cashier = String(p.user?.username || "").toLowerCase()
      const ref = String(p.external_ref || "").toLowerCase()
      return (
        payId.includes(q) ||
        ordId.includes(q) ||
        ordPadded.includes(q) ||
        `ord-${ordPadded}`.includes(q) ||
        `pay-${payId.padStart(4, "0")}`.includes(q) ||
        tbl.includes(q) ||
        method.includes(q) ||
        cashier.includes(q) ||
        ref.includes(q)
      )
    })
  }, [rangedPayments, search, methodFilter])

  const filteredTotal = useMemo(
    () =>
      filtered
        .filter((p) => p.status === "Completed")
        .reduce((s, p) => s + Number(p.amount || 0), 0),
    [filtered]
  )

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <Receipt size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--color-text)] text-base">
                {t("payments.history")}
              </div>
              <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {periodOptions.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setActivePeriod(p)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                  activePeriod === p
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-2xs"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                )}
              >
                {p === "Custom" ? <Calendar size={13} /> : <TrendingUp size={13} />}
                {periodLabelKey[p] ? t(periodLabelKey[p]) : p}
              </button>
            ))}
          </div>
        </div>

        {activePeriod === "Custom" && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-[var(--color-primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--color-muted)]">{t("reports.from")}</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || todayStr}
                onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
                className="text-xs font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
              />
            </div>

            <ArrowRight size={14} className="text-[var(--color-muted)] hidden sm:block" />

            <div className="flex items-center gap-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-[var(--color-primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--color-muted)]">{t("reports.to")}</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr}
                onChange={(e) => e.target.value && setCustomTo(e.target.value)}
                className="text-xs font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setCustomFrom(todayStr)
                setCustomTo(todayStr)
              }}
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline px-2 py-1 cursor-pointer"
            >
              {t("reports.resetToday")}
            </button>
          </div>
        )}
      </Card>

      <Card>
        <div className="p-5 pb-4 border-b border-[var(--color-border)] flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[var(--color-text)]">
                {t("payments.history")} ({filtered.length})
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5 tabular-nums">
                {t("common.total")}:{" "}
                <span className="font-bold text-[var(--color-primary)]">
                  {formatUSD(filteredTotal)}
                </span>{" "}
                ({formatKHR(filteredTotal)})
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("payments.searchPlaceholder")}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                disabled={filtered.length === 0}
                onClick={() => exportPaymentsExcel(filtered, range.label)}
              >
                <FileSpreadsheet size={14} /> {lang === "km" ? "នាំចេញ Excel" : "Export Excel"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {methodNames.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
                  methodFilter === m
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                )}
              >
                {m === "All" ? t("common.all") : m}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2">
          {isLoading ? (
            <div className="text-center text-sm text-[var(--color-muted)] py-10">
              {t("common.loading")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead>#</TableHead>
                  <TableHead>{t("report.orderNum")}</TableHead>
                  <TableHead>{t("common.table")}</TableHead>
                  <TableHead>{t("pay.method")}</TableHead>
                  <TableHead>{t("payments.cashier")}</TableHead>
                  <TableHead>{t("payments.dateTime")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("payments.amount")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const amt = Number(p.amount || 0)
                  const ordId = p.order_id || p.order?.order_id
                  const linkedOrder = resolveOrder(p)
                  return (
                    <TableRow key={p.payment_id}>
                      <TableCell className="text-[var(--color-muted)] text-xs tabular-nums">
                        PAY-{String(p.payment_id).padStart(4, "0")}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {ordId ? `ORD-${String(ordId).padStart(4, "0")}` : "—"}
                      </TableCell>
                      <TableCell className="text-[var(--color-muted)]">
                        {linkedOrder?.table?.table_number || p.order?.table?.table_number || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-[var(--color-text-secondary)]">
                          {p.method?.method_name || "—"}
                        </div>
                        {p.external_ref && (
                          <div
                            className="text-[10px] font-mono text-[var(--color-muted)]"
                            title={`Bakong MD5: ${p.external_ref}`}
                          >
                            MD5: {p.external_ref.slice(0, 10)}...
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-muted)]">
                        {p.user?.username || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-muted)]">
                        {p.payment_date ? new Date(p.payment_date).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "Completed"
                              ? "success"
                              : p.status === "Failed"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-bold text-[var(--color-primary)]">{formatUSD(amt)}</div>
                        <div className="text-[10px] text-[var(--color-muted)]">{formatKHR(amt)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {linkedOrder?.order_items && (
                            <>
                              <button
                                type="button"
                                onClick={() => printOrderReceipt(linkedOrder)}
                                title={t("cashier.printReceipt")}
                                aria-label={t("cashier.printReceipt")}
                                className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewOrder(linkedOrder)}
                                title={t("cashier.viewDetails")}
                                aria-label={t("cashier.viewDetails")}
                                className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                              >
                                <Eye size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-[var(--color-muted)] py-10">
                      {t("payments.noPayments")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <ViewOrderDialog order={viewOrder} onClose={() => setViewOrder(null)} />
      </Card>
    </div>
  )
}

export function ReportBuilder({
  activePeriod = "Daily",
  setActivePeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  orders = [],
  ordersLoading = false,
  periods: periodsProp,
  printFormat = "a4",
}) {
  const { t, lang } = useLang()
  const periodOptions = periodsProp || periods
  const periodLabelKey = {
    Daily: "reports.daily",
    Yesterday: "reports.yesterday",
    Weekly: "reports.weekly",
    Monthly: "reports.monthly",
    Custom: "reports.custom",
  }
  const todayStr = toLocalDateStr()

  const [localPeriod, setLocalPeriod] = useState(activePeriod)
  const [localFrom, setLocalFrom] = useState(todayStr)
  const [localTo, setLocalTo] = useState(todayStr)
  const [statusFilter, setStatusFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [viewOrder, setViewOrder] = useState(null)

  const currentPeriod = setActivePeriod ? activePeriod : localPeriod
  const handlePeriodChange = setActivePeriod || setLocalPeriod
  const fromDate = customFrom !== undefined ? customFrom : localFrom
  const toDate = customTo !== undefined ? customTo : localTo
  const handleFromChange = setCustomFrom || setLocalFrom
  const handleToChange = setCustomTo || setLocalTo

  const range = useMemo(
    () => getDateRangeForPeriod(currentPeriod, fromDate, toDate),
    [currentPeriod, fromDate, toDate]
  )

  const rangedOrders = useMemo(
    () => filterOrdersByRange(orders, range.from, range.to),
    [orders, range.from, range.to]
  )
  const paidOrders = useMemo(() => rangedOrders.filter((o) => o.status === "Paid"), [rangedOrders])
  const totalRevenue = useMemo(() => paidOrders.reduce((s, o) => s + orderTotal(o), 0), [paidOrders])
  const avgOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0
  const itemsSold = useMemo(
    () =>
      paidOrders.reduce(
        (sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0),
        0
      ),
    [paidOrders]
  )

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rangedOrders.filter((o) => {
      if (statusFilter === "Paid" && o.status !== "Paid") return false
      if (statusFilter === "Unpaid" && o.status === "Paid") return false
      if (!q) return true
      const idStr = String(o.order_id)
      const padded = idStr.padStart(4, "0")
      const tbl = String(o.table?.table_number || "").toLowerCase()
      return idStr.includes(q) || padded.includes(q) || `ord-${padded}`.includes(q) || tbl.includes(q)
    })
  }, [rangedOrders, statusFilter, search])

  const kpis = [
    {
      label: t("reports.periodRevenue"),
      value: formatUSD(totalRevenue),
      sub: `${formatKHR(totalRevenue)} KHR`,
      icon: DollarSign,
      featured: true,
    },
    {
      label: t("reports.paidOrders"),
      value: paidOrders.length,
      sub: `${paidOrders.length} / ${rangedOrders.length} ${t("cashier.orders")}`,
      icon: CheckCircle2,
    },
    {
      label: t("reports.avgOrderValue"),
      value: formatUSD(avgOrderValue),
      sub: formatKHR(avgOrderValue),
      icon: TrendingUp,
    },
    {
      label: t("reports.itemsSold"),
      value: itemsSold,
      sub: `${paidOrders.length} ${t("reports.paidOrders")}`,
      icon: ShoppingCart,
    },
  ]

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <BarChart3 size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--color-text)] text-base">
                {t("report.salesReport")}
              </div>
              <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
            </div>
          </div>

          {periodOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {periodOptions.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                    currentPeriod === p
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-2xs"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                  )}
                >
                  {p === "Custom" ? <Calendar size={13} /> : <TrendingUp size={13} />}
                  {periodLabelKey[p] ? t(periodLabelKey[p]) : p}
                </button>
              ))}
            </div>
          )}
        </div>

        {currentPeriod === "Custom" && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-[var(--color-primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--color-muted)]">{t("reports.from")}</span>
              <input
                type="date"
                value={fromDate}
                max={toDate || todayStr}
                onChange={(e) => e.target.value && handleFromChange(e.target.value)}
                className="text-xs font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
              />
            </div>

            <ArrowRight size={14} className="text-[var(--color-muted)] hidden sm:block" />

            <div className="flex items-center gap-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-[var(--color-primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--color-muted)]">{t("reports.to")}</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={todayStr}
                onChange={(e) => e.target.value && handleToChange(e.target.value)}
                className="text-xs font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                handleFromChange(todayStr)
                handleToChange(todayStr)
              }}
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline px-2 py-1 cursor-pointer"
            >
              {t("reports.resetToday")}
            </button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, featured }) => (
          <Card
            key={label}
            className={cn(
              "p-5",
              featured && "border-[var(--color-primary)]/35 bg-[var(--color-primary-muted)]/35"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                {label}
              </span>
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center",
                  featured
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-primary)]"
                )}
              >
                <Icon size={15} />
              </div>
            </div>
            <div
              className={cn(
                "font-display text-2xl font-bold tabular-nums",
                featured ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
              )}
            >
              {value}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">{sub}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="p-5 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-[var(--color-text)]">
              {t("reports.orderTransactions")} ({visibleOrders.length})
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {t("reports.detailedBreakdown")} {range.label}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={visibleOrders.length === 0}
              onClick={() => exportOrdersCsv(visibleOrders, range.label)}
            >
              <Download size={13} /> {t("reports.exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={visibleOrders.length === 0}
              onClick={() =>
                exportOrdersExcel({
                  orders: visibleOrders,
                  periodLabel: range.label,
                  totalRevenue,
                  paidOrdersCount: paidOrders.length,
                  avgOrderValue,
                })
              }
            >
              <FileSpreadsheet size={13} /> {lang === "km" ? "នាំចេញ Excel" : "Export Excel"}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={rangedOrders.length === 0}
              onClick={() => {
                const fn = printFormat === "thermal" ? printThermalReport : printExecutiveReport
                fn({
                  period: range.label,
                  totalRevenue,
                  paidOrders,
                  avgOrderValue,
                  periodOrders: rangedOrders,
                })
              }}
            >
              <Printer size={13} /> {t("reports.printReport")}
            </Button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-background)]/45">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("reports.searchOrderOrTable")}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {["All", "Paid", "Unpaid"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                  statusFilter === st
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                )}
              >
                {st === "All"
                  ? t("reports.all")
                  : st === "Paid"
                    ? t("reports.paid")
                    : t("reports.unpaid")}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2">
          {ordersLoading ? (
            <div className="text-center text-sm text-[var(--color-muted)] py-10">
              {t("cashier.loadingOrders")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead>{t("report.orderNum")}</TableHead>
                  <TableHead>{t("common.table")}</TableHead>
                  <TableHead>{t("payments.dateTime")}</TableHead>
                  <TableHead>{t("common.items")}</TableHead>
                  <TableHead>{t("report.payment")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.total")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrders.slice(0, 100).map((o) => {
                  const total = orderTotal(o)
                  const itemCount = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
                  const method = o.payments?.[0]?.method?.method_name || "—"
                  return (
                    <TableRow key={o.order_id}>
                      <TableCell className="font-semibold tabular-nums">
                        ORD-{String(o.order_id).padStart(4, "0")}
                      </TableCell>
                      <TableCell className="text-[var(--color-muted)]">
                        {o.table?.table_number || "—"}
                      </TableCell>
                      <TableCell className="text-[var(--color-muted)] text-xs">
                        {new Date(o.order_date).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[var(--color-muted)]">
                        {itemCount} {t("station.items")}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-text-secondary)]">
                        {method}
                      </TableCell>
                      <TableCell>
                        <Badge variant={o.status === "Paid" ? "success" : "warning"}>
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-bold text-[var(--color-primary)]">
                          {formatUSD(total)}
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          {formatKHR(total)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => printOrderReceipt(o)}
                            title={t("cashier.printReceipt")}
                            aria-label={t("cashier.printReceipt")}
                            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewOrder(o)}
                            title={t("cashier.viewDetails")}
                            aria-label={t("cashier.viewDetails")}
                            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {visibleOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-[var(--color-muted)] py-10">
                      {t("reports.noOrdersRange")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
        {visibleOrders.length > 100 && (
          <div className="px-5 pb-4 text-xs text-[var(--color-muted)]">
            {t("reports.showingFirst100")} {visibleOrders.length} {t("reports.exportCsvHint")}
          </div>
        )}
      </Card>

      <ViewOrderDialog order={viewOrder} onClose={() => setViewOrder(null)} />
    </div>
  )
}
