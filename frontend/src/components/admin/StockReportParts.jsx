import { useEffect, useMemo, useState } from "react"
import {
  Package, TrendingDown, TrendingUp, Truck, AlertTriangle,
  Calendar, ArrowRight, Download, Printer, Search, Loader2, BarChart3,
} from "lucide-react"
import {
  Button, Card, Badge, Input,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { useLang } from "@/i18n/LanguageContext"
import { useStockStore } from "../../context/stockContext"
import { periods, toLocalDateStr, getDateRangeForPeriod } from "./PaymentsParts"
import { StockTypeBadge } from "./StockParts"

const KHR_RATE = 4100

const MOVEMENT_META = {
  INITIAL: { labelKey: "stock.typeInitial", variant: "info" },
  RESTOCK: { labelKey: "stock.typeRestock", variant: "success" },
  USAGE: { labelKey: "stock.typeUsage", variant: "danger" },
  PO_RECEIVED: { labelKey: "stock.typePoReceived", variant: "success" },
  ADJUSTMENT: { labelKey: "stock.typeAdjustment", variant: "warning" },
}

const STATION_LABELS = {
  kitchen: "stock.kitchen",
  barista: "stock.barista",
  both: "stock.bothShared",
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatQtyChange(val, unitName) {
  const num = Number(val || 0)
  const sign = num > 0 ? "+" : ""
  return `${sign}${num.toFixed(2)}${unitName ? ` ${unitName}` : ""}`
}

function exportStockCsv(report, rangeLabel) {
  const movements = report?.movements || []
  const headers = ["Date & Time", "Item", "Station", "Type", "Change", "Balance After", "Unit", "Staff", "Role", "Supplier", "Note"]
  const rows = movements.map((m) => [
    m.created_at ? new Date(m.created_at).toLocaleString() : "",
    m.stock?.item_name || "",
    m.stock?.stock_type || "",
    m.type || "",
    Number(m.quantity_change || 0).toFixed(2),
    Number(m.balance_after || 0).toFixed(2),
    m.stock?.unit?.unit_name || "",
    m.user?.username || "",
    m.user?.role || "",
    m.stock_order?.supplier?.supplier_name || "",
    m.note || "",
  ])

  const csvContent = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `zoom-stock-report-${rangeLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function printStockReport(report, rangeLabel) {
  const win = window.open("", "_blank", "width=920,height=700")
  if (!win) {
    window.print()
    return
  }

  const summary = report?.summary || {}
  const byItem = report?.by_item || []
  const bySupplier = report?.by_supplier || []
  const movements = (report?.movements || []).slice(0, 100)

  const itemRows = byItem.map((i) => `
    <tr>
      <td>${escapeHtml(i.item_name)}</td>
      <td>${escapeHtml(i.stock_type)}</td>
      <td style="text-align:right;">-${Number(i.used_qty).toFixed(2)} ${escapeHtml(i.unit_name)}</td>
      <td style="text-align:right;">+${Number(i.restocked_qty).toFixed(2)} ${escapeHtml(i.unit_name)}</td>
      <td style="text-align:right;">${Number(i.current_qty).toFixed(2)} ${escapeHtml(i.unit_name)}</td>
    </tr>
  `).join("")

  const supplierRows = bySupplier.map((s) => `
    <tr>
      <td>${escapeHtml(s.supplier_name)}</td>
      <td style="text-align:center;">${s.received_count} / ${s.orders_count}</td>
      <td style="text-align:right;">${Number(s.total_qty).toFixed(2)}</td>
      <td style="text-align:right;">$${Number(s.total_cost).toFixed(2)}</td>
    </tr>
  `).join("")

  const movementRows = movements.map((m) => `
    <tr>
      <td>${m.created_at ? escapeHtml(new Date(m.created_at).toLocaleString()) : "—"}</td>
      <td>${escapeHtml(m.stock?.item_name)}</td>
      <td>${escapeHtml(m.type)}</td>
      <td style="text-align:right;">${escapeHtml(formatQtyChange(m.quantity_change, m.stock?.unit?.unit_name))}</td>
      <td style="text-align:right;">${Number(m.balance_after || 0).toFixed(2)}</td>
      <td>${escapeHtml(m.user?.username || "—")}</td>
      <td>${escapeHtml(m.note || "—")}</td>
    </tr>
  `).join("")

  win.document.write(`
    <html>
      <head>
        <title>Stock Report - ${escapeHtml(rangeLabel)}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 28px; color: #111827; font-size: 12px; }
          h1 { margin: 0 0 4px; font-size: 20px; color: #065f46; }
          .sub { color: #6b7280; margin-bottom: 18px; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .kpi { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; }
          .kpi-label { font-size: 10px; text-transform: uppercase; color: #6b7280; }
          .kpi-val { font-size: 18px; font-weight: 700; margin-top: 4px; }
          h2 { font-size: 14px; margin: 18px 0 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>Zoom Garden Café — Stock Report</h1>
        <div class="sub">${escapeHtml(rangeLabel)}</div>
        <div class="kpis">
          <div class="kpi"><div class="kpi-label">Used Out</div><div class="kpi-val">${Number(summary.total_used || 0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Restocked In</div><div class="kpi-val">${Number(summary.total_restocked || 0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">PO Spend</div><div class="kpi-val">$${Number(summary.po_spend || 0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Low Stock Items</div><div class="kpi-val">${summary.low_stock_count || 0} / ${summary.total_items || 0}</div></div>
        </div>
        <h2>Item Summary</h2>
        <table>
          <thead><tr><th>Item</th><th>Station</th><th>Used Out</th><th>Restocked In</th><th>Current</th></tr></thead>
          <tbody>${itemRows || "<tr><td colspan='5'>No item movements</td></tr>"}</tbody>
        </table>
        <h2>Supplier Purchase Orders</h2>
        <table>
          <thead><tr><th>Supplier</th><th>Received / Total POs</th><th>Quantity</th><th>Total Cost</th></tr></thead>
          <tbody>${supplierRows || "<tr><td colspan='4'>No supplier purchase orders</td></tr>"}</tbody>
        </table>
        <h2>Recent Movements</h2>
        <table>
          <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Change</th><th>Balance</th><th>Staff</th><th>Note</th></tr></thead>
          <tbody>${movementRows || "<tr><td colspan='7'>No movements</td></tr>"}</tbody>
        </table>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 300)
}

export function StockReportBuilder() {
  const { t } = useLang()
  const { stockReport, reportLoading, fetchStockReports } = useStockStore()

  const todayStr = toLocalDateStr()
  const [period, setPeriod] = useState("Monthly")
  const [fromDate, setFromDate] = useState(todayStr)
  const [toDate, setToDate] = useState(todayStr)
  const [stationFilter, setStationFilter] = useState("all")
  const [movementFilter, setMovementFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const range = useMemo(
    () => getDateRangeForPeriod(period, fromDate, toDate),
    [period, fromDate, toDate]
  )

  useEffect(() => {
    let active = true
    fetchStockReports({ from: range.from, to: range.to, stock_type: stationFilter })
      .then(() => {
        if (active) setErrorMsg("")
      })
      .catch((err) => {
        if (active) setErrorMsg(err?.response?.data?.message || err?.message || "Failed to load stock report")
      })
    return () => { active = false }
  }, [range.from, range.to, stationFilter, fetchStockReports])

  const summary = stockReport?.summary || {}
  const byItem = stockReport?.by_item || []
  const byStation = useMemo(() => stockReport?.by_station || [], [stockReport?.by_station])
  const bySupplier = stockReport?.by_supplier || []
  const lowStockItems = stockReport?.low_stock_items || []
  const movements = useMemo(() => stockReport?.movements || [], [stockReport?.movements])

  const maxStationUsed = useMemo(
    () => Math.max(0, ...byStation.map((s) => Number(s.used_qty || 0))),
    [byStation]
  )

  const visibleMovements = useMemo(() => {
    const q = search.trim().toLowerCase()
    return movements.filter((m) => {
      if (movementFilter === "Usage" && m.type !== "USAGE") return false
      if (movementFilter === "Restock" && !["RESTOCK", "PO_RECEIVED", "INITIAL"].includes(m.type)) return false
      if (movementFilter === "Adjust" && m.type !== "ADJUSTMENT") return false
      if (!q) return true
      const hay = [
        m.stock?.item_name,
        m.user?.username,
        m.stock_order?.supplier?.supplier_name,
        m.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [movements, movementFilter, search])

  const periodLabelKey = {
    Daily: "reports.daily",
    Yesterday: "reports.yesterday",
    Weekly: "reports.weekly",
    Monthly: "reports.monthly",
    Custom: "reports.custom",
  }

  const kpis = [
    {
      label: t("stock.reportTotalUsed"),
      value: Number(summary.total_used || 0).toFixed(2),
      sub: `${summary.usage_events || 0} ${t("stock.eventsLabel")}`,
      icon: TrendingDown,
      tint: "bg-[var(--color-danger-muted)]",
      color: "text-[var(--color-danger)]",
    },
    {
      label: t("stock.reportTotalRestocked"),
      value: Number(summary.total_restocked || 0).toFixed(2),
      sub: `${summary.restock_events || 0} ${t("stock.eventsLabel")}`,
      icon: TrendingUp,
      tint: "bg-[var(--color-primary-muted)]",
      color: "text-[var(--color-primary)]",
    },
    {
      label: t("stock.reportPoSpend"),
      value: `$${Number(summary.po_spend || 0).toFixed(2)}`,
      sub: `៛${Math.round(Number(summary.po_spend || 0) * KHR_RATE).toLocaleString()} · ${summary.po_received || 0}/${summary.po_total || 0}`,
      icon: Truck,
      tint: "bg-[var(--color-plum-muted)]",
      color: "text-[var(--color-plum)]",
    },
    {
      label: t("stock.reportLowStock"),
      value: summary.low_stock_count || 0,
      sub: `${summary.low_stock_count || 0} / ${summary.total_items || 0} ${t("stock.totalItem")}`,
      icon: AlertTriangle,
      tint: "bg-[var(--color-accent-muted)]",
      color: "text-[var(--color-warning)]",
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
              <div className="font-semibold text-[var(--color-text)] text-base">{t("reports.stockReport")}</div>
              <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {periods.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                  period === p
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

        <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: t("stock.allStations") },
              { id: "kitchen", label: t("stock.kitchen") },
              { id: "barista", label: t("stock.barista") },
              { id: "both", label: t("stock.bothShared") },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStationFilter(st.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                  stationFilter === st.id
                    ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)] border-[var(--color-primary)]/40 font-semibold"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          {period === "Custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-1.5">
                <span className="text-xs text-[var(--color-muted)]">{t("reports.from")}</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || todayStr}
                  onChange={(e) => e.target.value && setFromDate(e.target.value)}
                  className="text-xs font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
                />
              </div>
              <ArrowRight size={14} className="text-[var(--color-muted)]" />
              <div className="flex items-center gap-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-1.5">
                <span className="text-xs text-[var(--color-muted)]">{t("reports.to")}</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={todayStr}
                  onChange={(e) => e.target.value && setToDate(e.target.value)}
                  className="text-xs font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={movements.length === 0}
              onClick={() => exportStockCsv(stockReport, range.label)}
            >
              <Download size={13} /> {t("reports.exportCsv")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!stockReport}
              onClick={() => printStockReport(stockReport, range.label)}
            >
              <Printer size={13} /> {t("reports.printReport")}
            </Button>
          </div>
        </div>
      </Card>

      {errorMsg && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-4 py-3">
          {errorMsg}
        </div>
      )}

      {reportLoading && !stockReport ? (
        <div className="flex items-center justify-center py-16 text-[var(--color-muted)] gap-2 text-sm">
          <Loader2 size={16} className="animate-spin" />
          <span>{t("stock.loadingStock")}</span>
        </div>
      ) : (
        <div className={cn("space-y-5 transition-opacity", reportLoading && "opacity-60")}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(({ label, value, sub, icon: Icon, tint, color }) => (
              <Card key={label} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</span>
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", tint)}>
                    <Icon size={16} className={color} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text)] tabular-nums">{value}</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">{sub}</div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package size={16} className="text-[var(--color-primary)]" />
                <div>
                  <div className="font-semibold text-sm text-[var(--color-text)]">{t("stock.stationUsage")}</div>
                  <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
                </div>
              </div>
              <div className="space-y-3">
                {byStation.map((st) => {
                  const pct = maxStationUsed > 0 && st.used_qty > 0
                    ? Math.max(4, Math.round((st.used_qty / maxStationUsed) * 100))
                    : 0
                  return (
                    <div key={st.station} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--color-text)]">{t(STATION_LABELS[st.station] || st.station)}</span>
                        <span className="text-[var(--color-muted)] tabular-nums">
                          {t("stock.usedQty")}: <strong className="text-[var(--color-danger)]">{Number(st.used_qty).toFixed(2)}</strong>
                          {" · "}
                          {t("stock.restockedQty")}: <strong className="text-[var(--color-primary)]">+{Number(st.restocked_qty).toFixed(2)}</strong>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--color-background)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Truck size={16} className="text-[var(--color-plum)]" />
                <div>
                  <div className="font-semibold text-sm text-[var(--color-text)]">{t("stock.supplierSummary")}</div>
                  <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
                </div>
              </div>
              {bySupplier.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--color-muted)]">{t("stock.noSuppliersPeriod")}</div>
              ) : (
                <div className="space-y-2.5">
                  {bySupplier.map((sup) => (
                    <div key={sup.supplier_id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/60 last:border-0 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--color-text)] truncate">{sup.supplier_name}</div>
                        <div className="text-[11px] text-[var(--color-muted)]">
                          {sup.received_count} {t("stock.receivedOf")} {sup.orders_count} PO
                        </div>
                      </div>
                      <div className="text-right tabular-nums shrink-0">
                        <div className="font-bold text-[var(--color-primary)]">${Number(sup.total_cost || 0).toFixed(2)}</div>
                        <div className="text-[11px] text-[var(--color-muted)]">{Number(sup.total_qty).toFixed(2)} qty</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {lowStockItems.length > 0 && (
            <Card className="p-5 border-[var(--color-warning)]/40 bg-[var(--color-accent-muted)]/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-[var(--color-warning)]" />
                <div className="font-semibold text-sm text-[var(--color-text)]">
                  {t("stock.lowStockAlerts")} ({lowStockItems.length})
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {lowStockItems.map((item) => (
                  <div key={item.stock_id} className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--color-text)] truncate">{item.item_name}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">
                        {Number(item.quantity).toFixed(2)} / {Number(item.min_level).toFixed(2)} {item.unit_name}
                      </div>
                    </div>
                    <Badge variant="danger">-{Number(item.shortage).toFixed(2)} {item.unit_name}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div className="p-5 border-b border-[var(--color-border)]">
              <div className="font-semibold text-[var(--color-text)]">
                {t("stock.itemSummary")} ({byItem.length})
              </div>
              <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
            </div>
            <div className="p-2">
              {byItem.length === 0 ? (
                <div className="text-center text-xs text-[var(--color-muted)] py-8">{t("stock.noItemActivityPeriod")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead>{t("stock.itemName")}</TableHead>
                      <TableHead>{t("stock.forStation")}</TableHead>
                      <TableHead className="text-right">{t("stock.reportTotalUsed")}</TableHead>
                      <TableHead className="text-right">{t("stock.reportTotalRestocked")}</TableHead>
                      <TableHead className="text-right">{t("stock.netChange")}</TableHead>
                      <TableHead className="text-right">{t("stock.current")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byItem.map((it) => {
                      const isLow = it.min_level != null && Number(it.current_qty) < Number(it.min_level)
                      return (
                        <TableRow key={it.stock_id}>
                          <TableCell className="font-semibold">{it.item_name}</TableCell>
                          <TableCell><StockTypeBadge type={it.stock_type} /></TableCell>
                          <TableCell className="text-right text-[var(--color-danger)] font-medium tabular-nums">
                            {it.used_qty > 0 ? `-${Number(it.used_qty).toFixed(2)} ${it.unit_name}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-[var(--color-primary)] font-medium tabular-nums">
                            {it.restocked_qty > 0 ? `+${Number(it.restocked_qty).toFixed(2)} ${it.unit_name}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatQtyChange(it.net_change, it.unit_name)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={cn("font-semibold", isLow && "text-[var(--color-danger)]")}>
                              {Number(it.current_qty).toFixed(2)} {it.unit_name}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-5 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--color-text)]">
                  {t("stock.movementLog")} ({visibleMovements.length})
                </div>
                <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("stock.searchMovementPlaceholder")}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { id: "All", label: t("stock.filterAll") },
                    { id: "Usage", label: t("stock.filterUsage") },
                    { id: "Restock", label: t("stock.filterRestock") },
                    { id: "Adjust", label: t("stock.filterAdjust") },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setMovementFilter(f.id)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        movementFilter === f.id
                          ? "bg-[var(--color-primary)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)]"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-2">
              {visibleMovements.length === 0 ? (
                <div className="text-center text-sm text-[var(--color-muted)] py-10">{t("stock.noMovementsPeriod")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead>{t("payments.dateTime")}</TableHead>
                      <TableHead>{t("stock.itemName")}</TableHead>
                      <TableHead>{t("menu.type")}</TableHead>
                      <TableHead className="text-right">{t("stock.quantity")}</TableHead>
                      <TableHead className="text-right">{t("stock.balanceAfter")}</TableHead>
                      <TableHead>{t("stock.byUser")}</TableHead>
                      <TableHead>{t("stock.noteRef")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleMovements.slice(0, 100).map((m) => {
                      const meta = MOVEMENT_META[m.type] || { labelKey: "", variant: "outline" }
                      const delta = Number(m.quantity_change || 0)
                      return (
                        <TableRow key={m.movement_id}>
                          <TableCell className="text-xs text-[var(--color-muted)]">
                            {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="font-medium">{m.stock?.item_name || `#${m.stock_id}`}</TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.labelKey ? t(meta.labelKey) : m.type}</Badge>
                          </TableCell>
                          <TableCell className={cn("text-right font-semibold tabular-nums", delta < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-primary)]")}>
                            {formatQtyChange(delta, m.stock?.unit?.unit_name)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-[var(--color-muted)] tabular-nums">
                            {Number(m.balance_after || 0).toFixed(2)} {m.stock?.unit?.unit_name || ""}
                          </TableCell>
                          <TableCell className="text-xs text-[var(--color-muted)]">
                            {m.user?.username ? `${m.user.username} (${m.user.role})` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-[var(--color-muted)]">
                            {m.stock_order?.supplier?.supplier_name
                              ? `${m.stock_order.supplier.supplier_name}${m.note ? ` · ${m.note}` : ""}`
                              : (m.note || "—")}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
