import { useState, useMemo } from "react"
import {
  ShoppingCart, TrendingUp, Receipt, Printer, DollarSign, Calendar, Download,
  CreditCard, Flame, CheckCircle2, Search, ArrowRight, BarChart3, Eye, FileSpreadsheet,
} from "lucide-react"
import {
  Button, Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Input,
} from "@/components/ui"
import { cn, menuItemName } from "@/lib/utils"
import { printExecutiveReport, printThermalReport, printOrderReceipt } from "@/components/cashier/orderHelpers"
import ViewOrderDialog from "@/components/cashier/ViewOrderDialog"
import { useLang } from "@/i18n/LanguageContext"

const KHR_RATE = 4100

export const periods = ["Daily", "Yesterday", "Weekly", "Monthly", "Custom"]

export const orderTotal = (order) =>
  order?.order_items?.reduce((sum, oi) => sum + Number(oi.unit_price) * oi.quantity, 0) || 0

export function toLocalDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

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
  const headers = ["Order ID", "Table", "Date", "Status", "Payment Method", "Items Count", "Total (USD)", "Total (KHR)"]
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
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
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
  const rowsHtml = orders.map((o, idx) => {
    const total = orderTotal(o)
    const itemCount = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
    const method = o.payments?.[0]?.method?.method_name || (o.status === "Paid" ? "Paid" : "Unpaid")
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc"
    return `
      <tr style="background-color:${bg};">
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">ORD-${String(o.order_id).padStart(4, "0")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${o.table?.table_number || "—"}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${new Date(o.order_date).toLocaleString()}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${o.status}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${method}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${itemCount}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold; color:#059669;">$${total.toFixed(2)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right;">៛${Math.round(total * KHR_RATE).toLocaleString()}</td>
      </tr>
    `
  }).join("")

  const totalItems = orders.reduce((sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0), 0)
  const grandTotalUSD = orders.reduce((sum, o) => sum + orderTotal(o), 0)
  const grandTotalKHR = Math.round(grandTotalUSD * KHR_RATE)

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family: 'Kantumruy Pro', 'Khmer OS Siemreap', Arial, sans-serif;">
        <table>
          <tr>
            <td colspan="8" style="font-size:18px; font-weight:bold; color:#059669; padding:10px 0;">
              ZOOM GARDEN CAFÉ &amp; WINE — SALES REPORT (${periodLabel})
            </td>
          </tr>
          <tr>
            <td colspan="2" style="background:#ecfdf5; border:1px solid #059669; padding:8px; font-weight:bold;">
              Paid Revenue: $${totalRevenue.toFixed(2)} (៛${Math.round(totalRevenue * KHR_RATE).toLocaleString()})
            </td>
            <td colspan="2" style="background:#f8fafc; border:1px solid #cbd5e1; padding:8px; font-weight:bold;">
              Paid Orders: ${paidOrdersCount} / ${orders.length}
            </td>
            <td colspan="2" style="background:#f8fafc; border:1px solid #cbd5e1; padding:8px; font-weight:bold;">
              Avg Ticket: $${avgOrderValue.toFixed(2)}
            </td>
            <td colspan="2" style="background:#f8fafc; border:1px solid #cbd5e1; padding:8px; font-weight:bold;">
              Exported: ${new Date().toLocaleString()}
            </td>
          </tr>
          <tr><td colspan="8"></td></tr>
          <thead>
            <tr style="background-color:#059669; color:#ffffff; font-weight:bold;">
              <th style="border:1px solid #047857; padding:8px;">Order ID</th>
              <th style="border:1px solid #047857; padding:8px;">Table</th>
              <th style="border:1px solid #047857; padding:8px;">Date &amp; Time</th>
              <th style="border:1px solid #047857; padding:8px;">Status</th>
              <th style="border:1px solid #047857; padding:8px;">Payment Method</th>
              <th style="border:1px solid #047857; padding:8px;">Items</th>
              <th style="border:1px solid #047857; padding:8px;">Total (USD)</th>
              <th style="border:1px solid #047857; padding:8px;">Total (KHR)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background-color:#ecfdf5; font-weight:bold;">
              <td colspan="5" style="border:1px solid #059669; padding:8px; text-align:right;">GRAND TOTAL (${orders.length} Orders):</td>
              <td style="border:1px solid #059669; padding:8px; text-align:center;">${totalItems}</td>
              <td style="border:1px solid #059669; padding:8px; text-align:right; color:#059669;">$${grandTotalUSD.toFixed(2)}</td>
              <td style="border:1px solid #059669; padding:8px; text-align:right; color:#059669;">៛${grandTotalKHR.toLocaleString()}</td>
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
  const rowsHtml = payments.map((p, idx) => {
    const amt = Number(p.amount || 0)
    const ordId = p.order_id || p.order?.order_id
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc"
    return `
      <tr style="background-color:${bg};">
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">PAY-${String(p.payment_id).padStart(4, "0")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${ordId ? `ORD-${String(ordId).padStart(4, "0")}` : "—"}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${p.order?.table?.table_number || "—"}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${p.method?.method_name || "—"}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${p.external_ref || "—"}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${p.user?.username || "—"}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${p.payment_date ? new Date(p.payment_date).toLocaleString() : "—"}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${p.status}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold; color:#059669;">$${amt.toFixed(2)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right;">៛${Math.round(amt * KHR_RATE).toLocaleString()}</td>
      </tr>
    `
  }).join("")

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
            <td colspan="10" style="font-size:18px; font-weight:bold; color:#059669; padding:10px 0;">
              ZOOM GARDEN CAFÉ &amp; WINE — PAYMENTS LOG (${periodLabel})
            </td>
          </tr>
          <thead>
            <tr style="background-color:#059669; color:#ffffff; font-weight:bold;">
              <th style="border:1px solid #047857; padding:8px;">Payment ID</th>
              <th style="border:1px solid #047857; padding:8px;">Order ID</th>
              <th style="border:1px solid #047857; padding:8px;">Table</th>
              <th style="border:1px solid #047857; padding:8px;">Method</th>
              <th style="border:1px solid #047857; padding:8px;">Bakong Ref / MD5</th>
              <th style="border:1px solid #047857; padding:8px;">Cashier</th>
              <th style="border:1px solid #047857; padding:8px;">Date &amp; Time</th>
              <th style="border:1px solid #047857; padding:8px;">Status</th>
              <th style="border:1px solid #047857; padding:8px;">Amount (USD)</th>
              <th style="border:1px solid #047857; padding:8px;">Amount (KHR)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background-color:#ecfdf5; font-weight:bold;">
              <td colspan="8" style="border:1px solid #059669; padding:8px; text-align:right;">TOTAL COMPLETED (${payments.length} Payments):</td>
              <td style="border:1px solid #059669; padding:8px; text-align:right; color:#059669;">$${grandTotalUSD.toFixed(2)}</td>
              <td style="border:1px solid #059669; padding:8px; text-align:right; color:#059669;">៛${grandTotalKHR.toLocaleString()}</td>
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
  const { t } = useLang()

  const todaysCash = todaysPayments
    .filter((p) => /cash|សាច់ប្រាក់/i.test(p.method?.method_name || ""))
    .reduce((s, p) => s + Number(p.amount || 0), 0)

  const todaysDigital = Math.max(0, todaysRevenue - todaysCash)

  const allTimeRevenue = orders
    .filter((o) => o.status === "Paid")
    .reduce((s, o) => s + orderTotal(o), 0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        {
          label: t("reports.todaysRevenue"),
          value: `$${todaysRevenue.toFixed(2)}`,
          sub: `៛${Math.round(todaysRevenue * KHR_RATE).toLocaleString()} · ${todaysPayments.length} ${t("reports.ordersPaidToday")}`,
          icon: TrendingUp,
          color: "text-[var(--color-primary)]",
        },
        {
          label: "Cash in Drawer (Today)",
          value: `$${todaysCash.toFixed(2)}`,
          sub: `៛${Math.round(todaysCash * KHR_RATE).toLocaleString()}`,
          icon: DollarSign,
          color: "text-[var(--color-warning)]",
        },
        {
          label: "KHQR / Digital (Today)",
          value: `$${todaysDigital.toFixed(2)}`,
          sub: `៛${Math.round(todaysDigital * KHR_RATE).toLocaleString()}`,
          icon: CreditCard,
          color: "text-[var(--color-info)]",
        },
        {
          label: t("reports.totalRevenueAllTime"),
          value: `$${allTimeRevenue.toFixed(2)}`,
          sub: `៛${Math.round(allTimeRevenue * KHR_RATE).toLocaleString()} (${orders.length} ${t("cashier.orders")})`,
          icon: ShoppingCart,
          color: "text-[var(--color-plum)]",
        },
      ].map(({ label, value, sub, icon: Icon, color }) => (
        <Card key={label} className="p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <Icon size={16} className={color} />
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)] mb-1">{value}</div>
          <div className="text-xs text-[var(--color-muted)]">{sub}</div>
        </Card>
      ))}
    </div>
  )
}

export function PaymentsTable({ payments = [], orders = [], isLoading = false }) {
  const { t } = useLang()
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
    if (activePeriod === "All") {
      return { from: null, to: null, label: "All Time" }
    }
    return getDateRangeForPeriod(activePeriod, customFrom, customTo)
  }, [activePeriod, customFrom, customTo])

  const methodNames = useMemo(() => {
    const set = new Set(payments.map((p) => p.method?.method_name).filter(Boolean))
    return ["All", ...Array.from(set)]
  }, [payments])

  const orderMap = useMemo(() => {
    const map = new Map()
    for (const o of orders) {
      map.set(o.order_id, o)
    }
    return map
  }, [orders])

  const resolveOrder = (payment) => {
    const ordId = payment.order_id || payment.order?.order_id
    const fullOrder = orderMap.get(ordId)
    if (fullOrder) return fullOrder
    if (payment.order) return payment.order
    return null
  }

  const rangedPayments = useMemo(() => {
    if (activePeriod === "All" || !range.from || !range.to) return payments
    return filterPaymentsByRange(payments, range.from, range.to)
  }, [payments, activePeriod, range.from, range.to])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rangedPayments.filter((p) => {
      if (methodFilter !== "All" && p.method?.method_name !== methodFilter) {
        return false
      }
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
    () => filtered.filter((p) => p.status === "Completed").reduce((s, p) => s + Number(p.amount || 0), 0),
    [filtered]
  )

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <Receipt size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--color-text)] text-base">{t("payments.history")}</div>
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
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
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
              className="text-xs font-medium text-[var(--color-primary)] hover:underline px-2 py-1"
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
              <div className="font-semibold text-[var(--color-primary)]">
                {t("payments.history")} ({filtered.length})
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">
                {t("common.total")}:{" "}
                <span className="font-bold text-[var(--color-primary)]">${filteredTotal.toFixed(2)}</span>{" "}
                (៛{Math.round(filteredTotal * KHR_RATE).toLocaleString()})
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
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
                <FileSpreadsheet size={14} /> Export Excel
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
                  "px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                  methodFilter === m
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)]"
                )}
              >
                {m === "All" ? t("common.all") : m}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2">
          {isLoading ? (
            <div className="text-center text-sm text-[var(--color-muted)] py-10">{t("common.loading")}</div>
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
                      <TableCell className="text-[var(--color-muted)] text-xs">
                        PAY-{String(p.payment_id).padStart(4, "0")}
                      </TableCell>
                      <TableCell className="font-semibold">
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
                        <Badge variant={p.status === "Completed" ? "success" : p.status === "Failed" ? "danger" : "warning"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-[var(--color-primary)]">${amt.toFixed(2)}</div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          ៛{Math.round(amt * KHR_RATE).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {linkedOrder?.order_items && (
                            <>
                              <button
                                onClick={() => printOrderReceipt(linkedOrder)}
                                title={t("cashier.printReceipt")}
                                className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                onClick={() => setViewOrder(linkedOrder)}
                                title={t("cashier.viewDetails")}
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
    () => paidOrders.reduce((sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0), 0),
    [paidOrders]
  )

  const methodBreakdown = useMemo(() => {
    const map = new Map()
    for (const o of paidOrders) {
      const name = o.payments?.[0]?.method?.method_name || "Cash / Other"
      const prev = map.get(name) || { name, count: 0, total: 0 }
      prev.count += 1
      prev.total += orderTotal(o)
      map.set(name, prev)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [paidOrders])

  const topItemsInPeriod = useMemo(() => {
    const map = new Map()
    for (const o of paidOrders) {
      for (const oi of o.order_items || []) {
        const key = oi.menu_item_id || oi.menu_item?.item_name || `item-${oi.order_item_id}`
        const name = oi.menu_item ? menuItemName(oi.menu_item, lang) : `Item #${oi.menu_item_id}`
        const prev = map.get(key) || { name, qty: 0, revenue: 0 }
        prev.name = name
        prev.qty += Number(oi.quantity || 0)
        prev.revenue += Number(oi.unit_price || 0) * Number(oi.quantity || 0)
        map.set(key, prev)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [paidOrders, lang])

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
      value: `$${totalRevenue.toFixed(2)}`,
      sub: `៛${Math.round(totalRevenue * KHR_RATE).toLocaleString()} KHR`,
      icon: DollarSign,
      tint: "bg-[var(--color-primary-muted)]",
      color: "text-[var(--color-primary)]",
      accent: true,
    },
    {
      label: t("reports.paidOrders"),
      value: paidOrders.length,
      sub: `${paidOrders.length} / ${rangedOrders.length} ${t("cashier.orders")}`,
      icon: CheckCircle2,
      tint: "bg-[var(--color-info-muted)]",
      color: "text-[var(--color-info)]",
    },
    {
      label: t("reports.avgOrderValue"),
      value: `$${avgOrderValue.toFixed(2)}`,
      sub: `៛${Math.round(avgOrderValue * KHR_RATE).toLocaleString()}`,
      icon: TrendingUp,
      tint: "bg-[var(--color-plum-muted)]",
      color: "text-[var(--color-plum)]",
    },
    {
      label: t("reports.itemsSold"),
      value: itemsSold,
      sub: `${paidOrders.length} ${t("reports.paidOrders")}`,
      icon: ShoppingCart,
      tint: "bg-[var(--color-flame-muted)]",
      color: "text-[var(--color-flame)]",
    },
  ]

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <BarChart3 size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--color-text)] text-base">{t("report.salesReport")}</div>
              <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
            </div>
          </div>

          {periodOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {periodOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                    currentPeriod === p
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
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
              className="text-xs font-medium text-[var(--color-primary)] hover:underline px-2 py-1"
            >
              {t("reports.resetToday")}
            </button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, tint, color, accent }) => (
          <Card key={label} className={cn("p-5", accent && "border-l-4 border-l-[var(--color-primary)]")}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</span>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", tint)}>
                <Icon size={16} className={color} />
              </div>
            </div>
            <div className={cn("text-2xl font-bold", accent ? "text-[var(--color-primary)]" : "text-[var(--color-text)]")}>
              {value}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">{sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-[var(--color-primary)]" />
            <div>
              <div className="font-semibold text-sm text-[var(--color-text)]">{t("reports.revenueByMethod")}</div>
              <div className="text-xs text-[var(--color-muted)]">{t("reports.distributionCompleted")}</div>
            </div>
          </div>

          {methodBreakdown.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--color-muted)]">{t("reports.noPaidOrdersPeriod")}</div>
          ) : (
            <div className="space-y-3">
              {methodBreakdown.map((m) => {
                const pct = totalRevenue > 0 ? Math.round((m.total / totalRevenue) * 100) : 0
                return (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--color-text)]">
                        {m.name}{" "}
                        <span className="text-[var(--color-muted)] font-normal">
                          ({m.count} {t("cashier.orders")})
                        </span>
                      </span>
                      <span className="font-bold text-[var(--color-primary)]">
                        ${m.total.toFixed(2)} <span className="text-[var(--color-muted)] font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--color-primary-muted)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={16} className="text-[var(--color-flame)]" />
            <div>
              <div className="font-semibold text-sm text-[var(--color-text)]">{t("reports.topItemsPeriod")}</div>
              <div className="text-xs text-[var(--color-muted)]">
                {t("reports.mostOrderedPeriod")} {range.label}
              </div>
            </div>
          </div>

          {topItemsInPeriod.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--color-muted)]">{t("reports.noItemSales")}</div>
          ) : (
            <div className="space-y-2.5">
              {topItemsInPeriod.map((item, idx) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/60 last:border-0 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-[var(--color-text)] truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary">
                      {item.qty} {t("dashboard.sold")}
                    </Badge>
                    <span className="font-semibold text-[var(--color-text)] w-16 text-right">
                      ${item.revenue.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
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
              <FileSpreadsheet size={13} /> Export Excel
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

        <div className="px-5 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-background)]/40">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
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
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  statusFilter === st
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)]"
                )}
              >
                {st === "All" ? t("reports.all") : st === "Paid" ? t("reports.paid") : t("reports.unpaid")}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2">
          {ordersLoading ? (
            <div className="text-center text-sm text-[var(--color-muted)] py-10">{t("cashier.loadingOrders")}</div>
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
                      <TableCell className="font-semibold">ORD-{String(o.order_id).padStart(4, "0")}</TableCell>
                      <TableCell className="text-[var(--color-muted)]">{o.table?.table_number || "—"}</TableCell>
                      <TableCell className="text-[var(--color-muted)] text-xs">
                        {new Date(o.order_date).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[var(--color-muted)]">
                        {itemCount} {t("station.items")}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-text-secondary)]">{method}</TableCell>
                      <TableCell>
                        <Badge variant={o.status === "Paid" ? "success" : "warning"}>{o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-[var(--color-primary)]">${total.toFixed(2)}</div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          ៛{Math.round(total * KHR_RATE).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => printOrderReceipt(o)}
                            title={t("cashier.printReceipt")}
                            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => setViewOrder(o)}
                            title={t("cashier.viewDetails")}
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