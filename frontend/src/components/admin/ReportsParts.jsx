import { useState, useMemo } from "react"
import {
  UtensilsCrossed, Package, TrendingUp, DollarSign, ShoppingCart, Flame,
  Calendar, ArrowRight, Search, Download, FileSpreadsheet, Printer,
  AlertTriangle, Truck, BarChart3, ChefHat, Coffee, Archive, CheckCircle2,
} from "lucide-react"
import {
  Button, Card, Badge, Input,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui"
import { cn, menuItemName, categoryDisplayName } from "@/lib/utils"
import { useLang } from "@/i18n/LanguageContext"
import { toLocalDateStr, getDateRangeForPeriod, filterOrdersByRange } from "./PaymentsParts"
import { MenuItemImage, MenuItemSalesDialog } from "./MenuParts"
import { StockImage, StockTypeBadge, stockStatus } from "./StockParts"
import { printA4DocumentHtml } from "@/components/cashier/orderHelpers"
import { KHR_RATE, escapeHtml, sanitizeCsvCell } from "@/lib/currency"

function formatDateTimeShort(val) {
  if (!val) return "—"
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
}

function isDateWithinRange(val, fromStr, toStr) {
  if (!fromStr || !toStr) return true
  if (!val) return false
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return false
  const start = new Date(`${fromStr}T00:00:00`)
  const end = new Date(`${toStr}T23:59:59.999`)
  return d >= start && d <= end
}

// ============================================================================
// MENU REPORT EXPORTS & PRINT
// ============================================================================

function exportMenuCsv(rows, periodLabel) {
  const headers = [
    "Rank", "Item Name (EN)", "Item Name (KM)", "Category", "Station",
    "Unit Price (USD)", "Orders", "Qty Sold", "Last Sold Date", "Revenue (USD)", "Revenue (KHR)", "Share (%)",
  ]
  const csvRows = rows.map((r, idx) => [
    idx + 1,
    r.item_name || "",
    r.item_name_km || "",
    r.category_name || "—",
    r.category_type === "drink" ? "Barista" : "Kitchen",
    Number(r.price || 0).toFixed(2),
    r.ordersCount,
    r.qtySold,
    formatDateTimeShort(r.lastSoldAt),
    r.revenue.toFixed(2),
    Math.round(r.revenue * KHR_RATE),
    `${r.sharePct}%`,
  ])

  const csvContent = [headers, ...csvRows]
    .map((r) => r.map(sanitizeCsvCell).join(","))
    .join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `zoom-menu-report-${periodLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportMenuExcel({ rows, periodLabel, totalRevenue, totalUnitsSold }) {
  const rowsHtml = rows.map((r, idx) => {
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc"
    return `
      <tr style="background-color:${bg};">
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">#${idx + 1}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${escapeHtml(r.displayName)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${escapeHtml(r.categoryDisplay)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${r.category_type === "drink" ? "Barista" : "Kitchen"}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right;">$${Number(r.price || 0).toFixed(2)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${r.ordersCount}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold;">${r.qtySold}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${escapeHtml(formatDateTimeShort(r.lastSoldAt))}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold; color:#059669;">$${r.revenue.toFixed(2)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right;">៛${Math.round(r.revenue * KHR_RATE).toLocaleString()}</td>
      </tr>
    `
  }).join("")

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family: 'Kantumruy Pro', 'Khmer OS Siemreap', Arial, sans-serif;">
        <table>
          <tr>
            <td colspan="10" style="font-size:18px; font-weight:bold; color:#059669; padding:10px 0;">
              ZOOM GARDEN CAFÉ &amp; WINE — MENU SALES REPORT (${escapeHtml(periodLabel)})
            </td>
          </tr>
          <thead>
            <tr style="background-color:#059669; color:#ffffff; font-weight:bold;">
              <th style="border:1px solid #047857; padding:8px;">Rank</th>
              <th style="border:1px solid #047857; padding:8px;">Menu Item</th>
              <th style="border:1px solid #047857; padding:8px;">Category</th>
              <th style="border:1px solid #047857; padding:8px;">Station</th>
              <th style="border:1px solid #047857; padding:8px;">Unit Price</th>
              <th style="border:1px solid #047857; padding:8px;">Orders</th>
              <th style="border:1px solid #047857; padding:8px;">Qty Sold</th>
              <th style="border:1px solid #047857; padding:8px;">Last Sold Date</th>
              <th style="border:1px solid #047857; padding:8px;">Revenue (USD)</th>
              <th style="border:1px solid #047857; padding:8px;">Revenue (KHR)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background-color:#ecfdf5; font-weight:bold;">
              <td colspan="6" style="border:1px solid #059669; padding:8px; text-align:right;">GRAND TOTAL:</td>
              <td style="border:1px solid #059669; padding:8px; text-align:center;">${totalUnitsSold}</td>
              <td style="border:1px solid #059669; padding:8px; text-align:center;">—</td>
              <td style="border:1px solid #059669; padding:8px; text-align:right; color:#059669;">$${totalRevenue.toFixed(2)}</td>
              <td style="border:1px solid #059669; padding:8px; text-align:right; color:#059669;">៛${Math.round(totalRevenue * KHR_RATE).toLocaleString()}</td>
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
  link.download = `zoom-menu-report-${periodLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.xls`
  link.click()
  URL.revokeObjectURL(url)
}

function printMenuA4Report({ rows, periodLabel, totalRevenue, totalUnitsSold, soldItemsCount, topItemName }) {
  const revKHR = Math.round(totalRevenue * KHR_RATE)
  const rowsHtml = rows.map((r, idx) => `
    <tr>
      <td class="center"><strong>#${idx + 1}</strong></td>
      <td>
        <strong>${escapeHtml(r.item_name)}</strong>
        ${r.item_name_km ? `<div style="font-size:10px; color:#64748b;">${escapeHtml(r.item_name_km)}</div>` : ""}
      </td>
      <td>${escapeHtml(r.categoryDisplay)}</td>
      <td class="center">${r.category_type === "drink" ? "Barista" : "Kitchen"}</td>
      <td class="right">$${Number(r.price || 0).toFixed(2)}</td>
      <td class="center">${r.ordersCount}</td>
      <td class="center"><strong>${r.qtySold}</strong></td>
      <td class="center">${escapeHtml(formatDateTimeShort(r.lastSoldAt))}</td>
      <td class="right"><strong>$${r.revenue.toFixed(2)}</strong></td>
      <td class="right">៛${Math.round(r.revenue * KHR_RATE).toLocaleString()}</td>
    </tr>
  `).join("")

  const html = `
    <div class="header">
      <div class="brand-card">
        <div class="brand-name">ZOOM</div>
        <div class="brand-sub">Garden Café &amp; Wine · Sen Sok</div>
      </div>
      <div class="right">
        <div style="font-size:18px; font-weight:800; color:#0f172a;">MENU PERFORMANCE REPORT</div>
        <div style="font-size:12px; color:#059669; font-weight:700; margin-top:2px;">Period: ${escapeHtml(periodLabel)}</div>
        <div style="font-size:10px; color:#64748b; margin-top:2px;">Generated: ${escapeHtml(new Date().toLocaleString("en-GB"))}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box primary">
        <div class="kpi-label">Menu Revenue (USD)</div>
        <div class="kpi-val">$${totalRevenue.toFixed(2)}</div>
        <div class="kpi-sub">៛${revKHR.toLocaleString()} KHR</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Total Units Sold</div>
        <div class="kpi-val">${totalUnitsSold}</div>
        <div class="kpi-sub">Across paid orders</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Active Items Sold</div>
        <div class="kpi-val">${soldItemsCount} / ${rows.length}</div>
        <div class="kpi-sub">Items ordered in period</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Best Seller</div>
        <div class="kpi-val" style="font-size:14px;">${escapeHtml(topItemName || "—")}</div>
        <div class="kpi-sub">Top item by volume</div>
      </div>
    </div>

    <h3>Menu Item Breakdown (${rows.length})</h3>
    <table>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Menu Item</th>
          <th>Category</th>
          <th class="center">Station</th>
          <th class="right">Unit Price</th>
          <th class="center">Orders</th>
          <th class="center">Qty Sold</th>
          <th class="center">Last Sold Date</th>
          <th class="right">Revenue (USD)</th>
          <th class="right">Revenue (KHR)</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="6" class="right">GRAND TOTAL:</td>
          <td class="center">${totalUnitsSold}</td>
          <td class="center">—</td>
          <td class="right">$${totalRevenue.toFixed(2)}</td>
          <td class="right">៛${revKHR.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <div>Prepared by: ___________________________</div>
      <div>Approved by (Manager): ___________________________</div>
    </div>
  `

  printA4DocumentHtml(`Menu Report - ${periodLabel}`, html)
}

// ============================================================================
// STOCK REPORT EXPORTS & PRINT
// ============================================================================

function exportStockInventoryCsv(items, stockOrders, subView, periodLabel, t) {
  if (subView === "orders") {
    const headers = ["PO #", "Invoice", "Stock Item", "Supplier", "Quantity", "Unit", "Placed By", "Date & Time", "Status"]
    const rows = stockOrders.map((po) => {
      const poDate = po.created_at || po.received_at || po.stock?.last_updated
      return [
        `PO-${String(po.stock_order_id).padStart(3, "0")}`,
        po.invoice || "—",
        po.stock?.item_name || `#${po.stock_id}`,
        po.supplier?.supplier_name || `#${po.supplier_id}`,
        Number(po.quantity || 0).toFixed(2),
        po.stock?.unit?.unit_name || "",
        po.user?.username || "—",
        formatDateTimeShort(poDate),
        po.status || "",
      ]
    })

    const csvContent = [headers, ...rows]
      .map((r) => r.map(sanitizeCsvCell).join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `zoom-purchase-orders-${periodLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    return
  }

  const headers = ["Stock ID", "Item Name", "Station", "Quantity", "Min Level", "Buffer / Shortage", "Unit", "Status", "Last Updated"]
  const rows = items.map((item) => {
    const qty = Number(item.quantity || 0)
    const min = item.min_level != null ? Number(item.min_level) : 0
    const diff = qty - min
    const st = stockStatus(item)
    const stLabel = st === "OutOfStock" ? t("stock.outOfStock") : st === "LowStock" ? t("stock.lowStock") : t("stock.inStockStatus")
    return [
      `STK-${String(item.stock_id).padStart(3, "0")}`,
      item.item_name || "",
      item.stock_type || "both",
      qty.toFixed(2),
      min.toFixed(2),
      `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`,
      item.unit?.unit_name || "",
      stLabel,
      formatDateTimeShort(item.last_updated),
    ]
  })

  const csvContent = [headers, ...rows]
    .map((r) => r.map(sanitizeCsvCell).join(","))
    .join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `zoom-stock-inventory-${periodLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportStockInventoryExcel(items, stockOrders, periodLabel, t) {
  const invRowsHtml = items.map((item, idx) => {
    const qty = Number(item.quantity || 0)
    const min = item.min_level != null ? Number(item.min_level) : 0
    const st = stockStatus(item)
    const stLabel = st === "OutOfStock" ? t("stock.outOfStock") : st === "LowStock" ? t("stock.lowStock") : t("stock.inStockStatus")
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc"
    const color = st === "InStock" ? "#059669" : "#dc2626"
    return `
      <tr style="background-color:${bg};">
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">STK-${String(item.stock_id).padStart(3, "0")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${escapeHtml(item.item_name)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${escapeHtml(item.stock_type || "both")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold;">${qty.toFixed(2)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right;">${min.toFixed(2)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${escapeHtml(item.unit?.unit_name || "—")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold; color:${color};">${escapeHtml(stLabel)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${escapeHtml(formatDateTimeShort(item.last_updated))}</td>
      </tr>
    `
  }).join("")

  const poRowsHtml = stockOrders.map((po, idx) => {
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc"
    const poDate = po.created_at || po.received_at || po.stock?.last_updated
    return `
      <tr style="background-color:${bg};">
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">PO-${String(po.stock_order_id).padStart(3, "0")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${escapeHtml(po.invoice || "—")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; font-weight:bold;">${escapeHtml(po.stock?.item_name || `#${po.stock_id}`)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${escapeHtml(po.supplier?.supplier_name || `#${po.supplier_id}`)}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold;">${Number(po.quantity || 0).toFixed(2)} ${escapeHtml(po.stock?.unit?.unit_name || "")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${escapeHtml(po.user?.username || "—")}</td>
        <td style="border:1px solid #cbd5e1; padding:6px;">${escapeHtml(formatDateTimeShort(poDate))}</td>
        <td style="border:1px solid #cbd5e1; padding:6px; text-align:center;">${escapeHtml(po.status)}</td>
      </tr>
    `
  }).join("")

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family: 'Kantumruy Pro', 'Khmer OS Siemreap', Arial, sans-serif;">
        <table>
          <tr>
            <td colspan="8" style="font-size:18px; font-weight:bold; color:#059669; padding:10px 0;">
              ZOOM GARDEN CAFÉ &amp; WINE — STOCK &amp; RESTOCKING REPORT (${escapeHtml(periodLabel)})
            </td>
          </tr>
          <thead>
            <tr style="background-color:#059669; color:#ffffff; font-weight:bold;">
              <th style="border:1px solid #047857; padding:8px;">Code</th>
              <th style="border:1px solid #047857; padding:8px;">Item Name</th>
              <th style="border:1px solid #047857; padding:8px;">Station</th>
              <th style="border:1px solid #047857; padding:8px;">Quantity</th>
              <th style="border:1px solid #047857; padding:8px;">Min Level</th>
              <th style="border:1px solid #047857; padding:8px;">Unit</th>
              <th style="border:1px solid #047857; padding:8px;">Status</th>
              <th style="border:1px solid #047857; padding:8px;">Last Updated</th>
            </tr>
          </thead>
          <tbody>${invRowsHtml}</tbody>
          <tr><td colspan="8"></td></tr>
          <tr>
            <td colspan="8" style="font-size:15px; font-weight:bold; color:#059669; padding:8px 0;">
              PURCHASE ORDERS (${stockOrders.length})
            </td>
          </tr>
          <thead>
            <tr style="background-color:#059669; color:#ffffff; font-weight:bold;">
              <th style="border:1px solid #047857; padding:8px;">PO #</th>
              <th style="border:1px solid #047857; padding:8px;">Invoice</th>
              <th style="border:1px solid #047857; padding:8px;">Stock Item</th>
              <th style="border:1px solid #047857; padding:8px;">Supplier</th>
              <th style="border:1px solid #047857; padding:8px;">Quantity</th>
              <th style="border:1px solid #047857; padding:8px;">Placed By</th>
              <th style="border:1px solid #047857; padding:8px;">Date &amp; Time</th>
              <th style="border:1px solid #047857; padding:8px;">Status</th>
            </tr>
          </thead>
          <tbody>${poRowsHtml}</tbody>
        </table>
      </body>
    </html>
  `

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `zoom-stock-report-${periodLabel.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}.xls`
  link.click()
  URL.revokeObjectURL(url)
}

function printStockA4Report({ items, stockOrders, periodLabel, lowCount, receivedPoCount, totalRestockedQty, t }) {
  const invRowsHtml = items.map((item) => {
    const qty = Number(item.quantity || 0)
    const min = item.min_level != null ? Number(item.min_level) : 0
    const st = stockStatus(item)
    const stLabel = st === "OutOfStock" ? t("stock.outOfStock") : st === "LowStock" ? t("stock.lowStock") : t("stock.inStockStatus")
    return `
      <tr>
        <td class="center"><strong>STK-${String(item.stock_id).padStart(3, "0")}</strong></td>
        <td><strong>${escapeHtml(item.item_name)}</strong></td>
        <td class="center">${escapeHtml(item.stock_type || "both")}</td>
        <td class="right"><strong>${qty.toFixed(2)} ${escapeHtml(item.unit?.unit_name || "")}</strong></td>
        <td class="right">${min.toFixed(2)} ${escapeHtml(item.unit?.unit_name || "")}</td>
        <td class="center"><strong>${escapeHtml(stLabel)}</strong></td>
        <td class="center">${escapeHtml(formatDateTimeShort(item.last_updated))}</td>
      </tr>
    `
  }).join("")

  const poRowsHtml = stockOrders.slice(0, 60).map((po) => {
    const poDate = po.created_at || po.received_at || po.stock?.last_updated
    return `
      <tr>
        <td class="center"><strong>PO-${String(po.stock_order_id).padStart(3, "0")}</strong></td>
        <td>${escapeHtml(po.invoice || "—")}</td>
        <td><strong>${escapeHtml(po.stock?.item_name || `#${po.stock_id}`)}</strong></td>
        <td>${escapeHtml(po.supplier?.supplier_name || `#${po.supplier_id}`)}</td>
        <td class="right"><strong>${Number(po.quantity || 0).toFixed(2)} ${escapeHtml(po.stock?.unit?.unit_name || "")}</strong></td>
        <td class="center">${escapeHtml(po.user?.username || "—")}</td>
        <td class="center">${escapeHtml(formatDateTimeShort(poDate))}</td>
        <td class="center"><strong>${escapeHtml(po.status)}</strong></td>
      </tr>
    `
  }).join("")

  const html = `
    <div class="header">
      <div class="brand-card">
        <div class="brand-name">ZOOM</div>
        <div class="brand-sub">Garden Café &amp; Wine · Sen Sok</div>
      </div>
      <div class="right">
        <div style="font-size:18px; font-weight:800; color:#0f172a;">STOCK &amp; INVENTORY REPORT</div>
        <div style="font-size:12px; color:#059669; font-weight:700; margin-top:2px;">Period: ${escapeHtml(periodLabel)}</div>
        <div style="font-size:10px; color:#64748b; margin-top:2px;">Generated: ${escapeHtml(new Date().toLocaleString("en-GB"))}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box primary">
        <div class="kpi-label">Total Stock Items</div>
        <div class="kpi-val">${items.length}</div>
        <div class="kpi-sub">${Math.max(0, items.length - lowCount)} healthy in stock</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Low / Out of Stock</div>
        <div class="kpi-val" style="color:${lowCount > 0 ? "#dc2626" : "#0f172a"};">${lowCount}</div>
        <div class="kpi-sub">Need restocking</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Purchase Orders</div>
        <div class="kpi-val">${receivedPoCount} / ${stockOrders.length}</div>
        <div class="kpi-sub">Received supplier orders</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Total Restocked</div>
        <div class="kpi-val">+${totalRestockedQty.toFixed(0)}</div>
        <div class="kpi-sub">Units received via PO</div>
      </div>
    </div>

    ${stockOrders.length > 0 ? `
      <h3>Stock Records &amp; Restocking Log (${stockOrders.length})</h3>
      <table>
        <thead>
          <tr>
            <th class="center">Record #</th>
            <th>Ref / Type</th>
            <th>Stock Item</th>
            <th>Source / Supplier</th>
            <th class="right">Quantity Added</th>
            <th class="center">Recorded By</th>
            <th class="center">Date &amp; Time</th>
            <th class="center">Status</th>
          </tr>
        </thead>
        <tbody>${poRowsHtml}</tbody>
      </table>
    ` : ""}

    <h3>Current Inventory Balance (${items.length})</h3>
    <table>
      <thead>
        <tr>
          <th class="center">Code</th>
          <th>Item Name</th>
          <th class="center">Station</th>
          <th class="right">Current Qty</th>
          <th class="right">Min Level</th>
          <th class="center">Status</th>
          <th class="center">Last Updated</th>
        </tr>
      </thead>
      <tbody>${invRowsHtml}</tbody>
    </table>

    <div class="footer">
      <div>Prepared by: ___________________________</div>
      <div>Approved by (Manager): ___________________________</div>
    </div>
  `

  printA4DocumentHtml(`Stock Report - ${periodLabel}`, html)
}

// ============================================================================
// 1. MENU SALES REPORT BUILDER
// ============================================================================

export function MenuReportBuilder({
  orders = [],
  menuItems = [],
  archivedMenuItems = [],
  categories = [],
  fetchItemSales,
  isLoading = false,
}) {
  const { t, lang } = useLang()
  const todayStr = toLocalDateStr()

  const [activePeriod, setActivePeriod] = useState("Monthly")
  const [customFrom, setCustomFrom] = useState(todayStr)
  const [customTo, setCustomTo] = useState(todayStr)
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("All")
  const [typeFilter, setTypeFilter] = useState("all") // "all" | "food" | "drink"
  const [salesFilter, setSalesFilter] = useState("All") // "All" | "Sold" | "Unsold"
  const [salesModalItem, setSalesModalItem] = useState(null)

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

  const rangedPaidOrders = useMemo(() => {
    const base = activePeriod === "All" || !range.from || !range.to
      ? orders
      : filterOrdersByRange(orders, range.from, range.to)
    return base.filter((o) => o.status === "Paid")
  }, [orders, activePeriod, range.from, range.to])

  const catMap = useMemo(() => {
    const m = new Map()
    for (const c of categories) {
      m.set(c.category_id, c)
    }
    return m
  }, [categories])

  const categoryName = (id) => catMap.get(id)?.category_name || "—"

  const allMenuItems = useMemo(() => {
    const map = new Map()
    for (const item of menuItems || []) {
      map.set(item.menu_item_id, item)
    }
    for (const item of archivedMenuItems || []) {
      if (!map.has(item.menu_item_id)) {
        map.set(item.menu_item_id, item)
      }
    }
    return Array.from(map.values())
  }, [menuItems, archivedMenuItems])

  const aggregatedRows = useMemo(() => {
    const statsById = new Map()

    for (const order of rangedPaidOrders) {
      const seenInOrder = new Set()
      const orderTime = order.order_date ? new Date(order.order_date).getTime() : 0
      for (const oi of order.order_items || []) {
        const id = oi.menu_item_id
        if (!id) continue
        const prev = statsById.get(id) || {
          qtySold: 0,
          revenue: 0,
          ordersCount: 0,
          lastSoldTime: 0,
          lastSoldAt: null,
        }
        const q = Number(oi.quantity || 0)
        const p = Number(oi.unit_price || 0)
        prev.qtySold += q
        prev.revenue += q * p
        if (orderTime > prev.lastSoldTime) {
          prev.lastSoldTime = orderTime
          prev.lastSoldAt = order.order_date
        }
        if (!seenInOrder.has(id)) {
          prev.ordersCount += 1
          seenInOrder.add(id)
        }
        statsById.set(id, prev)
      }
    }

    const totalRev = Array.from(statsById.values()).reduce((s, x) => s + x.revenue, 0)

    const merged = allMenuItems.map((item) => {
      const st = statsById.get(item.menu_item_id)
      const cat = catMap.get(item.category_id)
      const qtySold = st?.qtySold || 0
      const revenue = st?.revenue || 0
      const ordersCount = st?.ordersCount || 0
      const lastSoldAt = st?.lastSoldAt || null
      const sharePct = totalRev > 0 && revenue > 0 ? Math.round((revenue / totalRev) * 100) : 0
      return {
        ...item,
        displayName: menuItemName(item, lang),
        category_name: cat?.category_name || "—",
        categoryDisplay: categoryDisplayName(cat || "—", lang),
        category_type: cat?.type || "food",
        qtySold,
        revenue,
        ordersCount,
        lastSoldAt,
        sharePct,
      }
    })

    return merged.sort((a, b) => {
      if (b.qtySold !== a.qtySold) return b.qtySold - a.qtySold
      if (b.revenue !== a.revenue) return b.revenue - a.revenue
      return String(a.displayName).localeCompare(String(b.displayName))
    })
  }, [allMenuItems, rangedPaidOrders, catMap, lang])

  const totalRevenue = useMemo(
    () => aggregatedRows.reduce((s, r) => s + r.revenue, 0),
    [aggregatedRows]
  )
  const totalUnitsSold = useMemo(
    () => aggregatedRows.reduce((s, r) => s + r.qtySold, 0),
    [aggregatedRows]
  )
  const soldItemsCount = useMemo(
    () => aggregatedRows.filter((r) => r.qtySold > 0).length,
    [aggregatedRows]
  )
  const bestSeller = useMemo(
    () => aggregatedRows.find((r) => r.qtySold > 0) || null,
    [aggregatedRows]
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return aggregatedRows.filter((r) => {
      if (catFilter !== "All" && String(r.category_id) !== String(catFilter)) return false
      if (typeFilter !== "all" && r.category_type !== typeFilter) return false
      if (salesFilter === "Sold" && r.qtySold <= 0) return false
      if (salesFilter === "Unsold" && r.qtySold > 0) return false
      if (!q) return true
      return (
        String(r.item_name || "").toLowerCase().includes(q) ||
        String(r.item_name_km || "").toLowerCase().includes(q) ||
        String(r.category_name || "").toLowerCase().includes(q) ||
        String(r.categoryDisplay || "").toLowerCase().includes(q)
      )
    })
  }, [aggregatedRows, catFilter, typeFilter, salesFilter, search])

  const kpis = [
    {
      label: t("reports.menuRevenue"),
      value: `$${totalRevenue.toFixed(2)}`,
      sub: `៛${Math.round(totalRevenue * KHR_RATE).toLocaleString()} KHR`,
      icon: DollarSign,
      tint: "bg-[var(--color-primary-muted)]",
      color: "text-[var(--color-primary)]",
      accent: true,
    },
    {
      label: t("dashboard.unitsSold"),
      value: totalUnitsSold,
      sub: `${rangedPaidOrders.length} ${t("reports.paidOrders")}`,
      icon: ShoppingCart,
      tint: "bg-[var(--color-info-muted)]",
      color: "text-[var(--color-info)]",
    },
    {
      label: t("reports.activeItemsSold"),
      value: `${soldItemsCount} / ${aggregatedRows.length}`,
      sub: t("reports.itemsWithSales"),
      icon: UtensilsCrossed,
      tint: "bg-[var(--color-plum-muted)]",
      color: "text-[var(--color-plum)]",
    },
    {
      label: t("reports.bestSeller"),
      value: bestSeller ? bestSeller.displayName : "—",
      sub: bestSeller ? `${bestSeller.qtySold} ${t("dashboard.sold")} ($${bestSeller.revenue.toFixed(2)})` : t("reports.noItemSales"),
      icon: Flame,
      tint: "bg-[var(--color-flame-muted)]",
      color: "text-[var(--color-flame)]",
      smallText: true,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Period Selector Card */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <UtensilsCrossed size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--color-text)] text-base">{t("reports.menuReportTitle")}</div>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, tint, color, accent, smallText }) => (
          <Card key={label} className={cn("p-5", accent && "border-l-4 border-l-[var(--color-primary)]")}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</span>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", tint)}>
                <Icon size={16} className={color} />
              </div>
            </div>
            <div
              className={cn(
                "font-bold truncate",
                smallText ? "text-lg" : "text-2xl",
                accent ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
              )}
              title={String(value)}
            >
              {value}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">{sub}</div>
          </Card>
        ))}
      </div>

      {/* Menu Sales Breakdown Table Card */}
      <Card>
        <div className="p-5 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-[var(--color-text)]">
              {t("reports.menuSalesBreakdown")} ({filteredRows.length})
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
              disabled={filteredRows.length === 0}
              onClick={() => exportMenuCsv(filteredRows, range.label)}
            >
              <Download size={13} /> {t("reports.exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={filteredRows.length === 0}
              onClick={() =>
                exportMenuExcel({
                  rows: filteredRows,
                  periodLabel: range.label,
                  totalRevenue,
                  totalUnitsSold,
                })
              }
            >
              <FileSpreadsheet size={13} /> Export Excel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={filteredRows.length === 0}
              onClick={() =>
                printMenuA4Report({
                  rows: filteredRows,
                  periodLabel: range.label,
                  totalRevenue,
                  totalUnitsSold,
                  soldItemsCount,
                  topItemName: bestSeller?.displayName,
                })
              }
            >
              <Printer size={13} /> {t("reports.printReport")}
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-background)]/40">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("menu.searchPlaceholder")}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select value={String(catFilter)} onValueChange={(v) => setCatFilter(v)}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder={t("menu.allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">{t("menu.allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.category_id} value={String(c.category_id)}>
                    {categoryDisplayName(c, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("stock.allStations")}</SelectItem>
                <SelectItem value="food">{t("menu.foodType")}</SelectItem>
                <SelectItem value="drink">{t("menu.drinkType")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            {["All", "Sold", "Unsold"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSalesFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  salesFilter === st
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)]"
                )}
              >
                {st === "All"
                  ? t("reports.all")
                  : st === "Sold"
                    ? t("reports.soldOnly")
                    : t("reports.noSalesFilter")}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="p-2">
          {isLoading ? (
            <div className="text-center text-sm text-[var(--color-muted)] py-10">{t("common.loading")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{t("menu.itemName")}</TableHead>
                  <TableHead>{t("menu.category")}</TableHead>
                  <TableHead>{t("stock.forStation")}</TableHead>
                  <TableHead className="text-right">{t("menu.price")}</TableHead>
                  <TableHead className="text-center">{t("cashier.orders")}</TableHead>
                  <TableHead className="text-center">{t("menu.soldQty")}</TableHead>
                  <TableHead className="text-center">{t("payments.dateTime")}</TableHead>
                  <TableHead className="text-right">{t("menu.totalEarned")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row, idx) => (
                  <TableRow key={row.menu_item_id}>
                    <TableCell className="text-xs font-bold text-[var(--color-muted)]">
                      #{idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-background)] shrink-0">
                          <MenuItemImage item={row} lang={lang} iconSize={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--color-text)] flex items-center gap-1.5 flex-wrap">
                            <span>{row.displayName}</span>
                            {row.deleted_at && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                <Archive size={9} /> {t("menu.archivedBadge")}
                              </span>
                            )}
                          </div>
                          {row.item_name_km && lang === "en" && (
                            <div className="text-[11px] text-[var(--color-muted)]">{row.item_name_km}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-[var(--color-text-secondary)]">
                      {row.categoryDisplay}
                    </TableCell>
                    <TableCell>
                      {row.category_type === "drink" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-warning)]">
                          <Coffee size={11} /> {t("stock.barista")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-flame-muted)] text-[var(--color-flame)]">
                          <ChefHat size={11} /> {t("stock.kitchen")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-[var(--color-text)]">
                      ${Number(row.price || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center text-xs text-[var(--color-muted)]">
                      {row.ordersCount}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.qtySold > 0 ? "success" : "secondary"}>
                        {row.qtySold} {t("dashboard.sold")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-[var(--color-muted)]">
                      {formatDateTimeShort(row.lastSoldAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-bold text-[var(--color-primary)]">
                        ${row.revenue.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[var(--color-muted)]">
                        ៛{Math.round(row.revenue * KHR_RATE).toLocaleString()} ({row.sharePct}%)
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => setSalesModalItem(row)}
                        title={t("menu.viewSales")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                      >
                        <BarChart3 size={13} />
                        <span className="hidden sm:inline">{t("menu.monthlyBreakdown")}</span>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-[var(--color-muted)] py-10">
                      {t("menu.notFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <MenuItemSalesDialog
        key={salesModalItem?.menu_item_id || "none"}
        item={salesModalItem}
        categoryName={categoryName}
        onClose={() => setSalesModalItem(null)}
        fetchItemSales={fetchItemSales}
      />
    </div>
  )
}

// ============================================================================
// 2. STOCK & INVENTORY REPORT BUILDER
// ============================================================================

export function StockReportBuilder({
  stockItems = [],
  stockOrders = [],
  isLoading = false,
}) {
  const { t } = useLang()
  const todayStr = toLocalDateStr()

  const [activePeriod, setActivePeriod] = useState("All")
  const [customFrom, setCustomFrom] = useState(todayStr)
  const [customTo, setCustomTo] = useState(todayStr)

  const [subView, setSubView] = useState("orders") // "orders" (Stock Records) | "inventory" (Current Balance)
  const [search, setSearch] = useState("")
  const [stationFilter, setStationFilter] = useState("all")
  const [unitFilter, setUnitFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All") // "All" | "InStock" | "LowStock" | "OutOfStock"

  const [poSearch, setPoSearch] = useState("")
  const [poStatusFilter, setPoStatusFilter] = useState("All") // "All" | "Received" | "Ordered" | "Pending"

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

  const unitNames = useMemo(
    () => [...new Set((stockItems || []).map((i) => i.unit?.unit_name).filter(Boolean))],
    [stockItems]
  )

  const rangedStockItems = useMemo(() => {
    if (activePeriod === "All" || !range.from || !range.to) return stockItems || []
    return (stockItems || []).filter((item) => isDateWithinRange(item.last_updated, range.from, range.to))
  }, [stockItems, activePeriod, range.from, range.to])

  const rangedStockOrders = useMemo(() => {
    if (activePeriod === "All" || !range.from || !range.to) return stockOrders || []
    return (stockOrders || []).filter((po) => {
      const poDate = po.created_at || po.received_at || po.stock?.last_updated
      return isDateWithinRange(poDate, range.from, range.to)
    })
  }, [stockOrders, activePeriod, range.from, range.to])

  const lowOrOutItems = useMemo(
    () => rangedStockItems.filter((i) => stockStatus(i) !== "InStock"),
    [rangedStockItems]
  )

  const receivedPos = useMemo(
    () => rangedStockOrders.filter((po) => po.status === "Received"),
    [rangedStockOrders]
  )

  const totalRestockedQty = useMemo(
    () => receivedPos.reduce((s, po) => s + Number(po.quantity || 0), 0),
    [receivedPos]
  )

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rangedStockItems.filter((item) => {
      if (stationFilter !== "all" && (item.stock_type || "both") !== stationFilter) return false
      if (unitFilter !== "All" && item.unit?.unit_name !== unitFilter) return false
      const st = stockStatus(item)
      if (statusFilter !== "All" && st !== statusFilter) return false
      if (!q) return true
      return (
        String(item.item_name || "").toLowerCase().includes(q) ||
        String(item.unit?.unit_name || "").toLowerCase().includes(q) ||
        `stk-${String(item.stock_id).padStart(3, "0")}`.includes(q)
      )
    })
  }, [rangedStockItems, stationFilter, unitFilter, statusFilter, search])

  const filteredPos = useMemo(() => {
    const q = poSearch.trim().toLowerCase()
    return rangedStockOrders.filter((po) => {
      if (poStatusFilter !== "All" && po.status !== poStatusFilter) return false
      if (!q) return true
      const poCode = `po-${String(po.stock_order_id).padStart(3, "0")}`
      return (
        poCode.includes(q) ||
        String(po.invoice || "").toLowerCase().includes(q) ||
        String(po.stock?.item_name || "").toLowerCase().includes(q) ||
        String(po.supplier?.supplier_name || "").toLowerCase().includes(q) ||
        String(po.user?.username || "").toLowerCase().includes(q)
      )
    })
  }, [rangedStockOrders, poStatusFilter, poSearch])

  const kpis = [
    {
      label: t("stock.totalItem"),
      value: rangedStockItems.length,
      sub: `${Math.max(0, rangedStockItems.length - lowOrOutItems.length)} ${t("stock.inStockStatus")} · ${unitNames.length} ${t("stock.units")}`,
      icon: Package,
      tint: "bg-[var(--color-primary-muted)]",
      color: "text-[var(--color-primary)]",
      accent: true,
    },
    {
      label: t("stock.lowStock"),
      value: lowOrOutItems.length,
      sub: t("stock.lowStockSub"),
      icon: AlertTriangle,
      tint: "bg-[var(--color-accent-muted)]",
      color: "text-[var(--color-warning)]",
    },
    {
      label: t("stock.purchaseOrders"),
      value: `${receivedPos.length} / ${rangedStockOrders.length}`,
      sub: `${rangedStockOrders.length - receivedPos.length} ${t("reports.pendingOrders")}`,
      icon: Truck,
      tint: "bg-[var(--color-plum-muted)]",
      color: "text-[var(--color-plum)]",
    },
    {
      label: t("reports.totalRestocked"),
      value: `+${totalRestockedQty.toFixed(0)}`,
      sub: `${receivedPos.length} ${t("reports.receivedPos")}`,
      icon: CheckCircle2,
      tint: "bg-[var(--color-info-muted)]",
      color: "text-[var(--color-info)]",
    },
  ]

  const statusBadgeVariant = {
    InStock: "success",
    LowStock: "warning",
    OutOfStock: "danger",
  }

  const poBadgeVariant = {
    Pending: "outline",
    Ordered: "warning",
    Received: "success",
  }

  return (
    <div className="space-y-5">
      {/* Period / Date Selector Card */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <Package size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--color-text)] text-base">{t("stock.title")}</div>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, tint, color, accent }) => (
          <Card key={label} className={cn("p-5", accent && "border-l-4 border-l-[var(--color-primary)]")}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</span>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", tint)}>
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

      {/* Sub-view Bar + Global Export/Print */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] w-fit">
          <button
            type="button"
            onClick={() => setSubView("orders")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              subView === "orders"
                ? "bg-[var(--color-primary)] text-white shadow-xs"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
            )}
          >
            <Truck size={14} />
            <span>{t("stock.poTitle")} ({filteredPos.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView("inventory")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              subView === "inventory"
                ? "bg-[var(--color-primary)] text-white shadow-xs"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
            )}
          >
            <Package size={14} />
            <span>{t("stock.inventoryList")} ({filteredStock.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={subView === "inventory" ? filteredStock.length === 0 : filteredPos.length === 0}
            onClick={() => exportStockInventoryCsv(filteredStock, filteredPos, subView, range.label, t)}
          >
            <Download size={13} /> {t("reports.exportCsv")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={filteredStock.length === 0 && filteredPos.length === 0}
            onClick={() => exportStockInventoryExcel(filteredStock, filteredPos, range.label, t)}
          >
            <FileSpreadsheet size={13} /> Export Excel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={filteredStock.length === 0 && filteredPos.length === 0}
            onClick={() =>
              printStockA4Report({
                items: filteredStock,
                stockOrders: filteredPos,
                periodLabel: range.label,
                lowCount: lowOrOutItems.length,
                receivedPoCount: receivedPos.length,
                totalRestockedQty,
                t,
              })
            }
          >
            <Printer size={13} /> {t("reports.printReport")}
          </Button>
        </div>
      </Card>

      {subView === "inventory" ? (
        <Card>
          <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-background)]/40">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px] max-w-xs flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("stock.searchPlaceholder")}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Select value={stationFilter} onValueChange={setStationFilter}>
                <SelectTrigger className="w-40 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("stock.allStations")}</SelectItem>
                  <SelectItem value="kitchen">{t("stock.kitchen")}</SelectItem>
                  <SelectItem value="barista">{t("stock.barista")}</SelectItem>
                  <SelectItem value="both">{t("stock.bothShared")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger className="w-40 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t("stock.allUnits")}</SelectItem>
                  {unitNames.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "All", label: t("reports.all") },
                { id: "InStock", label: t("stock.inStockStatus") },
                { id: "LowStock", label: t("stock.lowStock") },
                { id: "OutOfStock", label: t("stock.outOfStock") },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                    statusFilter === st.id
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)]"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2">
            {isLoading ? (
              <div className="text-center text-sm text-[var(--color-muted)] py-10">{t("stock.loadingStock")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead>Code</TableHead>
                    <TableHead>{t("stock.itemName")}</TableHead>
                    <TableHead>{t("stock.forStation")}</TableHead>
                    <TableHead className="text-right">{t("stock.quantity")}</TableHead>
                    <TableHead className="text-right">{t("stock.minLevel")}</TableHead>
                    <TableHead className="text-center">{t("stock.unit")}</TableHead>
                    <TableHead className="text-center">{t("stock.status")}</TableHead>
                    <TableHead className="text-right">{t("stock.lastUpdated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStock.map((item) => {
                    const st = stockStatus(item)
                    const stLabel =
                      st === "OutOfStock"
                        ? t("stock.outOfStock")
                        : st === "LowStock"
                          ? t("stock.lowStock")
                          : t("stock.inStockStatus")
                    return (
                      <TableRow key={item.stock_id}>
                        <TableCell className="text-xs font-semibold text-[var(--color-muted)]">
                          STK-{String(item.stock_id).padStart(3, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <StockImage item={item} size={40} className="rounded-lg" />
                            <span className="font-semibold text-[var(--color-text)]">{item.item_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StockTypeBadge type={item.stock_type} />
                        </TableCell>
                        <TableCell className="text-right font-bold text-[var(--color-text)]">
                          {Number(item.quantity || 0).toFixed(2)} {item.unit?.unit_name}
                        </TableCell>
                        <TableCell className="text-right text-xs text-[var(--color-muted)]">
                          {item.min_level != null ? `${Number(item.min_level).toFixed(2)} ${item.unit?.unit_name}` : "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs text-[var(--color-muted)]">
                          {item.unit?.unit_name || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={statusBadgeVariant[st] || "secondary"}>{stLabel}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-[var(--color-muted)]">
                          {formatDateTimeShort(item.last_updated)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredStock.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-[var(--color-muted)] py-10">
                        {t("stock.noStockFound")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-background)]/40">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                placeholder={t("reports.searchPoPlaceholder")}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {["All", "Received", "Ordered", "Pending"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setPoStatusFilter(st)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                    poStatusFilter === st
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)]"
                  )}
                >
                  {st === "All" ? t("reports.all") : st}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2">
            {isLoading ? (
              <div className="text-center text-sm text-[var(--color-muted)] py-10">{t("stock.loadingPos")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead>{t("stock.poNum")}</TableHead>
                    <TableHead>{t("stock.invoice")}</TableHead>
                    <TableHead>{t("stock.stockItem")}</TableHead>
                    <TableHead>{t("stock.supplier")}</TableHead>
                    <TableHead className="text-right">{t("stock.quantity")}</TableHead>
                    <TableHead>{t("stock.placedBy")}</TableHead>
                    <TableHead className="text-center">{t("payments.dateTime")}</TableHead>
                    <TableHead className="text-center">{t("stock.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPos.map((po) => {
                    const poDate = po.created_at || po.received_at || po.stock?.last_updated
                    return (
                      <TableRow key={po.stock_order_id}>
                        <TableCell className="font-semibold">
                          PO-{String(po.stock_order_id).padStart(3, "0")}
                        </TableCell>
                        <TableCell className="text-xs text-[var(--color-muted)]">
                          {po.invoice || "—"}
                        </TableCell>
                        <TableCell className="font-medium text-[var(--color-text)]">
                          {po.stock?.item_name || `#${po.stock_id}`}
                        </TableCell>
                        <TableCell className="text-xs text-[var(--color-text-secondary)]">
                          {po.supplier?.supplier_name || `#${po.supplier_id}`}
                        </TableCell>
                        <TableCell className="text-right font-bold text-[var(--color-primary)]">
                          +{Number(po.quantity || 0).toFixed(2)} {po.stock?.unit?.unit_name || ""}
                        </TableCell>
                        <TableCell className="text-xs text-[var(--color-muted)]">
                          {po.user?.username || "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs text-[var(--color-muted)]">
                          {formatDateTimeShort(poDate)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={poBadgeVariant[po.status] || "outline"}>{po.status}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredPos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-[var(--color-muted)] py-10">
                        {t("stock.noPos")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
