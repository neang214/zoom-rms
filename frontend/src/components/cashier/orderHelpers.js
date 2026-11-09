import JsBarcode from "jsbarcode"

export const KHR_RATE = 4100

export const orderTotal = (order) =>
  order?.order_items?.reduce((sum, oi) => sum + Number(oi.unit_price) * oi.quantity, 0) || 0

export const statusConfig = {
  Pending: {
    labelKey: "status.pending",
    color: "bg-[var(--color-border)] text-[var(--color-text-secondary)]",
  },
  Preparing: {
    labelKey: "status.preparing",
    color: "bg-[var(--color-accent-muted)] text-[var(--color-warning)]",
  },
  Served: {
    labelKey: "status.served",
    color: "bg-[var(--color-primary-muted)] text-[var(--color-primary)]",
  },
  Paid: {
    labelKey: "status.paid",
    color: "bg-[var(--color-primary-muted)] text-[var(--color-primary)]",
  },
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function generateBarcodeSvg(value) {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    JsBarcode(svg, value, {
      format: "CODE128",
      width: 1.5,
      height: 36,
      displayValue: true,
      fontSize: 11,
      fontOptions: "bold",
      margin: 2,
      lineColor: "#000000",
      background: "#ffffff",
    })
    return svg.outerHTML
  } catch {
    return `<div style="font-family:monospace;font-size:12px;font-weight:bold;letter-spacing:2px;">${escapeHtml(value)}</div>`
  }
}

// ============================================================================
// Shared 80mm POS Thermal CSS (For Cashier)
// ============================================================================
const THERMAL_80MM_CSS = `
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  html, body {
    width: 80mm;
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-family: 'Roboto', 'Kantumruy Pro', 'Khmer OS Siemreap', system-ui, -apple-system, sans-serif;
    font-size: 11px;
    line-height: 1.35;
  }
  .ticket {
    width: 72mm;
    margin: 0 auto;
    padding: 3mm 1mm 5mm;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .brand-box {
    border: 1.5px solid #000;
    border-radius: 6px;
    padding: 4px 10px;
    display: inline-block;
    margin-bottom: 4px;
  }
  .brand-title {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 2px;
    line-height: 1.1;
  }
  .brand-sub {
    font-size: 10px;
    font-weight: 600;
  }
  .divider {
    border-top: 1px dashed #000;
    margin: 6px 0;
  }
  .divider-solid {
    border-top: 1.5px solid #000;
    margin: 6px 0;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    margin: 2px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding: 3px 0;
    text-align: left;
  }
  td {
    padding: 3.5px 0;
    vertical-align: top;
    font-size: 11px;
  }
  .item-km {
    font-size: 10px;
    color: #111;
  }
  .item-note {
    font-size: 9.5px;
    font-style: italic;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 13px;
    font-weight: 800;
    margin: 3px 0;
  }
  .khr-row {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    font-weight: 700;
    margin: 2px 0;
  }
  .status-badge {
    display: inline-block;
    border: 1px solid #000;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .barcode-wrap {
    margin-top: 8px;
    text-align: center;
  }
  .barcode-wrap svg {
    max-width: 68mm;
    height: auto;
  }
`

// ============================================================================
// Shared A4 Portrait Executive CSS (For Admin Reports)
// ============================================================================
const A4_REPORT_CSS = `
  @page {
    size: A4 portrait;
    margin: 12mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: 'Roboto', 'Kantumruy Pro', 'Khmer OS Siemreap', system-ui, -apple-system, sans-serif;
    font-size: 12px;
    line-height: 1.45;
  }
  .a4-container {
    width: 100%;
    max-width: 186mm;
    margin: 0 auto;
  }
  .a4-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #059669;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .a4-brand {
    border: 2px solid #059669;
    border-radius: 10px;
    padding: 6px 14px;
    text-align: center;
  }
  .a4-brand-title {
    font-size: 22px;
    font-weight: 900;
    color: #059669;
    letter-spacing: 2px;
    line-height: 1;
  }
  .a4-brand-sub {
    font-size: 10px;
    color: #334155;
    font-weight: 600;
    margin-top: 2px;
  }
  .a4-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .a4-kpi-card {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px 12px;
    background: #f8fafc;
  }
  .a4-kpi-card.highlight {
    background: #ecfdf5;
    border-color: #059669;
  }
  .a4-kpi-label {
    font-size: 10px;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 700;
  }
  .a4-kpi-val {
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    margin-top: 2px;
  }
  .a4-kpi-card.highlight .a4-kpi-val {
    color: #059669;
  }
  .a4-kpi-sub {
    font-size: 10px;
    color: #64748b;
    margin-top: 2px;
  }
  .a4-section-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin: 14px 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .a4-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .a4-table th {
    background: #059669;
    color: #ffffff;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 10px;
    padding: 7px 8px;
    border: 1px solid #047857;
    text-align: left;
  }
  .a4-table td {
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
  }
  .a4-table tr:nth-child(even) td {
    background: #f8fafc;
  }
  .a4-table tfoot td {
    background: #ecfdf5;
    font-weight: 800;
    border: 1px solid #059669;
    padding: 8px;
  }
  .text-right { text-align: right !important; }
  .text-center { text-align: center !important; }
`

function printThermalReceiptHtml(title, bodyHtml) {
  const existing = document.getElementById("zoom-print-iframe")
  if (existing) existing.remove()

  const iframe = document.createElement("iframe")
  iframe.id = "zoom-print-iframe"
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "80mm"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.style.opacity = "0"
  iframe.style.pointerEvents = "none"
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>${THERMAL_80MM_CSS}</style>
        <style id="dynamic-page-size">
          @page { size: 80mm 200mm; margin: 0mm; }
        </style>
      </head>
      <body>
        <div id="receipt-ticket" class="ticket">
          ${bodyHtml}
        </div>
      </body>
    </html>
  `)
  doc.close()

  setTimeout(() => {
    try {
      const ticket = doc.getElementById("receipt-ticket")
      if (ticket) {
        const heightMm = Math.max(110, Math.ceil(ticket.offsetHeight * 0.2646) + 8)
        const pageStyle = doc.getElementById("dynamic-page-size")
        if (pageStyle) {
          pageStyle.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0mm; }`
        }
      }
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } finally {
      setTimeout(() => {
        iframe.remove()
      }, 3000)
    }
  }, 150)
}

function printA4ReportHtml(title, bodyHtml) {
  const existing = document.getElementById("zoom-print-iframe")
  if (existing) existing.remove()

  const iframe = document.createElement("iframe")
  iframe.id = "zoom-print-iframe"
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "210mm"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.style.opacity = "0"
  iframe.style.pointerEvents = "none"
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>${A4_REPORT_CSS}</style>
      </head>
      <body>
        <div class="a4-container">
          ${bodyHtml}
        </div>
      </body>
    </html>
  `)
  doc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } finally {
      setTimeout(() => {
        iframe.remove()
      }, 3000)
    }
  }, 150)
}

// ============================================================================
// 1. 80mm Customer Receipt (Cashier / Admin Order Receipt)
// ============================================================================
export function printOrderReceipt(order) {
  if (!order) return

  const totalUSD = orderTotal(order)
  const totalKHR = Math.round(totalUSD * KHR_RATE)
  const orderCode = `ORD-${String(order.order_id).padStart(4, "0")}`
  const isPaid = (order.is_paid ?? order.status === "Paid") || order.payments?.length > 0
  const paymentMethod = order.payments?.[0]?.method?.method_name || (isPaid ? "Paid" : "Unpaid")
  const dateStr = order.order_date ? new Date(order.order_date).toLocaleString("en-GB") : new Date().toLocaleString("en-GB")
  const barcodeSvg = generateBarcodeSvg(orderCode)

  const itemsHtml = (order.order_items || [])
    .map((oi) => {
      const enName = oi.menu_item?.item_name || `Item #${oi.menu_item_id}`
      const kmName = oi.menu_item?.item_name_km
      const unitPrice = Number(oi.unit_price || 0)
      const lineTotal = unitPrice * Number(oi.quantity || 1)
      return `
        <tr>
          <td style="padding-right:4px;">
            <div class="bold">${escapeHtml(enName)}</div>
            ${kmName ? `<div class="item-km">${escapeHtml(kmName)}</div>` : ""}
            ${oi.note ? `<div class="item-note">* ${escapeHtml(oi.note)}</div>` : ""}
          </td>
          <td class="center" style="width:10mm;">${oi.quantity}</td>
          <td class="right" style="width:14mm;">$${unitPrice.toFixed(2)}</td>
          <td class="right bold" style="width:15mm;">$${lineTotal.toFixed(2)}</td>
        </tr>
      `
    })
    .join("")

  const html = `
    <div class="center">
      <div class="brand-box">
        <div class="brand-title">ZOOM</div>
        <div class="brand-sub">Garden Café &amp; Wine</div>
      </div>
      <div style="font-size:9.5px;">St. 2011 (#85, St. 92), Krang Thnong, Sen Sok</div>
      <div style="font-size:9.5px;">Phnom Penh · Tel: 010 770 686</div>
    </div>

    <div class="divider-solid"></div>

    <div class="meta-row">
      <span>Receipt: <strong class="bold">${escapeHtml(orderCode)}</strong></span>
      <span class="status-badge">${isPaid ? "PAID" : "BILL"}</span>
    </div>
    <div class="meta-row">
      <span>Table: <strong class="bold">${escapeHtml(order.table?.table_number || "—")}</strong></span>
      ${order.queue_number != null ? `<span>Queue: <strong class="bold">#${order.queue_number}</strong></span>` : `<span></span>`}
    </div>
    ${order.party_size != null
      ? `<div class="meta-row"><span>Guests: ${order.party_size}</span><span></span></div>`
      : ""
    }
    <div class="meta-row">
      <span>Date: ${escapeHtml(dateStr)}</span>
    </div>
    ${order.user?.username
      ? `<div class="meta-row"><span>Cashier: ${escapeHtml(order.user.username)}</span></div>`
      : ""
    }

    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th>Item / មុខទំនិញ</th>
          <th class="center" style="width:10mm;">Qty</th>
          <th class="right" style="width:14mm;">Price</th>
          <th class="right" style="width:15mm;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="divider-solid"></div>

    <div class="total-row">
      <span>TOTAL (USD)</span>
      <span>$${totalUSD.toFixed(2)}</span>
    </div>
    <div class="khr-row">
      <span>សរុបជាប្រាក់រៀល (KHR)</span>
      <span>៛${totalKHR.toLocaleString()}</span>
    </div>
    <div class="meta-row" style="margin-top:4px;">
      <span>Payment / ការទូទាត់:</span>
      <span class="bold">${escapeHtml(paymentMethod)}</span>
    </div>
    <div class="meta-row">
      <span>Exchange Rate:</span>
      <span>$1 = ៛${KHR_RATE.toLocaleString()}</span>
    </div>

    ${order.note ? `<div class="divider"></div><div style="font-size:10px;">Note: ${escapeHtml(order.note)}</div>` : ""}

    <div class="divider"></div>

    <div class="barcode-wrap">
      ${barcodeSvg}
    </div>

    <div class="center" style="margin-top:6px; font-size:9.5px;">
      <div class="bold">សូមអរគុណ! Thank You &amp; See You Again!</div>
      <div>Powered by ZOOM RMS</div>
    </div>
  `

  printThermalReceiptHtml(`Receipt ${orderCode}`, html)
}

// ============================================================================
// 2. 80mm Cashier Daily Closing Slip (Z-Report on Thermal Roll)
// ============================================================================
export function printDailyReport({ date, displayDate, tableLabel, data }) {
  if (!data) return
  const orders = data.orders || []
  const totalOrders = data.summary?.total_orders ?? orders.length
  const paidOrdersCount = data.summary?.paid_orders ?? orders.filter((o) => o.status === "Paid").length
  const totalRevenueUSD = Number(
    data.summary?.total_revenue ??
    orders.filter((o) => o.status === "Paid").reduce((s, o) => s + orderTotal(o), 0)
  )
  const totalRevenueKHR = Math.round(totalRevenueUSD * KHR_RATE)

  const methodMap = new Map()
  for (const o of orders.filter((x) => x.status === "Paid")) {
    const mName = o.payments?.[0]?.method?.method_name || "Cash / Other"
    const prev = methodMap.get(mName) || { count: 0, total: 0 }
    prev.count += 1
    prev.total += orderTotal(o)
    methodMap.set(mName, prev)
  }

  const methodsHtml = Array.from(methodMap.entries())
    .map(
      ([name, info]) => `
      <div class="meta-row">
        <span>${escapeHtml(name)} (${info.count})</span>
        <span class="bold">$${info.total.toFixed(2)}</span>
      </div>
    `
    )
    .join("")

  const orderRowsHtml = orders
    .map((o) => {
      const t = orderTotal(o)
      const time = new Date(o.order_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      return `
        <tr>
          <td>#${String(o.order_id).padStart(4, "0")}</td>
          <td class="center">${escapeHtml(o.table?.table_number || "—")}</td>
          <td class="center">${escapeHtml(time)}</td>
          <td class="right bold">$${t.toFixed(2)}</td>
        </tr>
      `
    })
    .join("")

  const html = `
    <div class="center">
      <div class="brand-box">
        <div class="brand-title">ZOOM</div>
        <div class="brand-sub">DAILY CLOSING SLIP (Z-REPORT)</div>
      </div>
      <div style="font-size:10px;" class="bold">${escapeHtml(displayDate || date)}</div>
      ${tableLabel ? `<div style="font-size:10px;">Table: ${escapeHtml(tableLabel)}</div>` : ""}
    </div>

    <div class="divider-solid"></div>

    <div class="meta-row">
      <span>Total Orders:</span>
      <span class="bold">${totalOrders}</span>
    </div>
    <div class="meta-row">
      <span>Paid Orders:</span>
      <span class="bold">${paidOrdersCount}</span>
    </div>
    <div class="meta-row">
      <span>Unpaid / Open:</span>
      <span class="bold">${totalOrders - paidOrdersCount}</span>
    </div>

    ${methodsHtml
      ? `<div class="divider"></div>
           <div class="bold" style="font-size:10px; margin-bottom:2px;">BY PAYMENT METHOD:</div>
           ${methodsHtml}`
      : ""
    }

    <div class="divider-solid"></div>

    <div class="total-row">
      <span>REVENUE (USD)</span>
      <span>$${totalRevenueUSD.toFixed(2)}</span>
    </div>
    <div class="khr-row">
      <span>ចំណូលសរុប (KHR)</span>
      <span>៛${totalRevenueKHR.toLocaleString()}</span>
    </div>

    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th class="center">Tbl</th>
          <th class="center">Time</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${orderRowsHtml}
      </tbody>
    </table>

    <div class="divider-solid"></div>

    <div style="margin-top:12px; font-size:10px;">
      <div>Cashier Sign: _______________________</div>
      <div style="margin-top:4px; font-size:9px;">Printed: ${escapeHtml(new Date().toLocaleString("en-GB"))}</div>
    </div>
  `

  printThermalReceiptHtml(`Daily Report - ${date}`, html)
}

// ============================================================================
// 3. Sales Report:
//    - format === "thermal" (Cashier) -> 80mm Thermal Roll
//    - format === "a4"      (Admin)   -> Full A4 Portrait Executive Report
// ============================================================================
export function printExecutiveReport({
  period = "Daily",
  totalRevenue = 0,
  paidOrders = [],
  avgOrderValue = 0,
  periodOrders = [],
  format = "a4",
}) {
  const revUSD = Number(totalRevenue || 0)
  const revKHR = Math.round(revUSD * KHR_RATE)

  const methodMap = new Map()
  for (const o of paidOrders) {
    const mName = o.payments?.[0]?.method?.method_name || "Cash / Other"
    const prev = methodMap.get(mName) || { count: 0, total: 0 }
    prev.count += 1
    prev.total += orderTotal(o)
    methodMap.set(mName, prev)
  }

  // Cashier 80mm Thermal Summary Slip
  if (format === "thermal") {
    const methodsHtml = Array.from(methodMap.entries())
      .map(
        ([name, info]) => `
        <div class="meta-row">
          <span>${escapeHtml(name)} (${info.count})</span>
          <span class="bold">$${info.total.toFixed(2)}</span>
        </div>
      `
      )
      .join("")

    const orderRowsHtml = periodOrders
      .slice(0, 60)
      .map((o) => {
        const t = orderTotal(o)
        return `
          <tr>
            <td>#${String(o.order_id).padStart(4, "0")}</td>
            <td class="center">${escapeHtml(o.table?.table_number || "—")}</td>
            <td class="center">${escapeHtml(o.status)}</td>
            <td class="right bold">$${t.toFixed(2)}</td>
          </tr>
        `
      })
      .join("")

    const thermalHtml = `
      <div class="center">
        <div class="brand-box">
          <div class="brand-title">ZOOM</div>
          <div class="brand-sub">CASHIER SALES REPORT</div>
        </div>
        <div style="font-size:10px;" class="bold">${escapeHtml(period)}</div>
      </div>

      <div class="divider-solid"></div>

      <div class="meta-row">
        <span>Total Orders:</span>
        <span class="bold">${periodOrders.length}</span>
      </div>
      <div class="meta-row">
        <span>Paid Orders:</span>
        <span class="bold">${paidOrders.length}</span>
      </div>
      <div class="meta-row">
        <span>Avg Ticket:</span>
        <span class="bold">$${Number(avgOrderValue || 0).toFixed(2)}</span>
      </div>

      ${methodsHtml
        ? `<div class="divider"></div>
             <div class="bold" style="font-size:10px; margin-bottom:2px;">BY PAYMENT METHOD:</div>
             ${methodsHtml}`
        : ""
      }

      <div class="divider-solid"></div>

      <div class="total-row">
        <span>TOTAL (USD)</span>
        <span>$${revUSD.toFixed(2)}</span>
      </div>
      <div class="khr-row">
        <span>សរុប (KHR)</span>
        <span>៛${revKHR.toLocaleString()}</span>
      </div>

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th class="center">Tbl</th>
            <th class="center">Status</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${orderRowsHtml}
        </tbody>
      </table>

      <div class="divider-solid"></div>
      <div class="center" style="font-size:9px; margin-top:4px;">
        Printed: ${escapeHtml(new Date().toLocaleString("en-GB"))}
      </div>
    `

    printThermalReceiptHtml(`Cashier Report - ${period}`, thermalHtml)
    return
  }

  // Admin Full A4 Portrait Executive Report
  const itemsSold = paidOrders.reduce(
    (sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0),
    0
  )

  const a4MethodRows = Array.from(methodMap.entries())
    .map(
      ([name, info]) => `
      <tr>
        <td><strong>${escapeHtml(name)}</strong></td>
        <td class="text-center">${info.count}</td>
        <td class="text-right"><strong>$${info.total.toFixed(2)}</strong></td>
        <td class="text-right">៛${Math.round(info.total * KHR_RATE).toLocaleString()}</td>
      </tr>
    `
    )
    .join("")

  const a4OrderRows = periodOrders
    .map((o) => {
      const t = orderTotal(o)
      const count = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
      const method = o.payments?.[0]?.method?.method_name || (o.status === "Paid" ? "Paid" : "Unpaid")
      return `
        <tr>
          <td><strong>ORD-${String(o.order_id).padStart(4, "0")}</strong></td>
          <td class="text-center">${escapeHtml(o.table?.table_number || "—")}</td>
          <td>${escapeHtml(new Date(o.order_date).toLocaleString("en-GB"))}</td>
          <td class="text-center">${count}</td>
          <td>${escapeHtml(method)}</td>
          <td class="text-center">${escapeHtml(o.status)}</td>
          <td class="text-right"><strong>$${t.toFixed(2)}</strong></td>
          <td class="text-right">៛${Math.round(t * KHR_RATE).toLocaleString()}</td>
        </tr>
      `
    })
    .join("")

  const a4Html = `
    <div class="a4-header">
      <div class="a4-brand">
        <div class="a4-brand-title">ZOOM</div>
        <div class="a4-brand-sub">Garden Café &amp; Wine · Sen Sok</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px; font-weight:800; color:#0f172a;">EXECUTIVE SALES REPORT</div>
        <div style="font-size:12px; font-weight:600; color:#059669; margin-top:2px;">Period: ${escapeHtml(period)}</div>
        <div style="font-size:10px; color:#64748b; margin-top:2px;">Generated: ${escapeHtml(new Date().toLocaleString("en-GB"))}</div>
      </div>
    </div>

    <div class="a4-kpi-grid">
      <div class="a4-kpi-card highlight">
        <div class="a4-kpi-label">Paid Revenue (USD)</div>
        <div class="a4-kpi-val">$${revUSD.toFixed(2)}</div>
        <div class="a4-kpi-sub">៛${revKHR.toLocaleString()} KHR</div>
      </div>
      <div class="a4-kpi-card">
        <div class="a4-kpi-label">Paid Orders</div>
        <div class="a4-kpi-val">${paidOrders.length}</div>
        <div class="a4-kpi-sub">of ${periodOrders.length} total orders</div>
      </div>
      <div class="a4-kpi-card">
        <div class="a4-kpi-label">Average Ticket</div>
        <div class="a4-kpi-val">$${Number(avgOrderValue || 0).toFixed(2)}</div>
        <div class="a4-kpi-sub">៛${Math.round(Number(avgOrderValue || 0) * KHR_RATE).toLocaleString()} KHR</div>
      </div>
      <div class="a4-kpi-card">
        <div class="a4-kpi-label">Items Sold</div>
        <div class="a4-kpi-val">${itemsSold}</div>
        <div class="a4-kpi-sub">Across paid orders</div>
      </div>
    </div>

    ${a4MethodRows
      ? `
      <div class="a4-section-title">Revenue by Payment Method</div>
      <table class="a4-table" style="margin-bottom:16px;">
        <thead>
          <tr>
            <th>Payment Method</th>
            <th class="text-center">Orders</th>
            <th class="text-right">Total (USD)</th>
            <th class="text-right">Total (KHR)</th>
          </tr>
        </thead>
        <tbody>${a4MethodRows}</tbody>
      </table>
    `
      : ""
    }

    <div class="a4-section-title">Order Transactions (${periodOrders.length})</div>
    <table class="a4-table">
      <thead>
        <tr>
          <th>Order #</th>
          <th class="text-center">Table</th>
          <th>Date &amp; Time</th>
          <th class="text-center">Items</th>
          <th>Payment</th>
          <th class="text-center">Status</th>
          <th class="text-right">Total (USD)</th>
          <th class="text-right">Total (KHR)</th>
        </tr>
      </thead>
      <tbody>
        ${a4OrderRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6" class="text-right">GRAND TOTAL (PAID REVENUE):</td>
          <td class="text-right" style="color:#059669;">$${revUSD.toFixed(2)}</td>
          <td class="text-right" style="color:#059669;">៛${revKHR.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  `

  printA4ReportHtml(`Executive Report - ${period}`, a4Html)
}