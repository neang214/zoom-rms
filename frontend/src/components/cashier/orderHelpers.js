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

const THERMAL_80MM_CSS = `
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  html, body {
    margin: 0;
    padding: 0;
    font-family: 'Roboto', 'Kantumruy Pro', 'Khmer OS Siemreap', system-ui, -apple-system, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    color: #000000;
  }
  /* Screen preview styling (looks like an 80mm thermal paper roll on screen) */
  @media screen {
    body {
      background: #1e293b;
      padding: 48px 0 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .ticket {
      width: 80mm;
      background: #ffffff;
      padding: 5mm 4mm 6mm;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      border-radius: 2px;
    }
    .preview-toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      background: #0f172a;
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      color: #f8fafc;
      font-size: 12px;
      z-index: 50;
    }
    .preview-btn {
      background: #059669;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }
    .preview-btn-close {
      background: transparent;
      color: #cbd5e1;
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
    }
  }
  /* Actual Print / PDF Output: Exact 80mm Width */
  @media print {
    html, body {
      width: 80mm !important;
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .no-print {
      display: none !important;
    }
    .ticket {
      width: 72mm !important;
      margin: 0 auto !important;
      padding: 2mm 0 4mm !important;
      box-shadow: none !important;
    }
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

function openThermalPrintWindow(title, bodyHtml) {
  const win = window.open("", "_blank", "width=380,height=680")
  if (!win) {
    window.print()
    return
  }
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet" />
        <style>${THERMAL_80MM_CSS}</style>
        <style id="dynamic-page-size">
          @page { size: 80mm 200mm; margin: 0mm; }
        </style>
      </head>
      <body>
        <div class="preview-toolbar no-print">
          <span>🧾 80mm POS Thermal Receipt</span>
          <div style="display:flex; gap:6px;">
            <button class="preview-btn" onclick="window.print()">🖨️ Print</button>
            <button class="preview-btn-close" onclick="window.close()">✕</button>
          </div>
        </div>
        <div id="receipt-ticket" class="ticket">
          ${bodyHtml}
        </div>
        <script>
          function triggerThermalPrint() {
            var ticket = document.getElementById('receipt-ticket');
            if (ticket) {
              // Convert pixel height to mm (1px ≈ 0.2646mm) so @page has two valid <length> values
              var heightMm = Math.max(115, Math.ceil(ticket.offsetHeight * 0.2646) + 8);
              var pageStyle = document.getElementById('dynamic-page-size');
              if (pageStyle) {
                pageStyle.textContent = '@page { size: 80mm ' + heightMm + 'mm; margin: 0mm; }';
              }
            }
            window.focus();
            window.print();
          }
          window.onload = function() {
            setTimeout(triggerThermalPrint, 250);
          };
        </script>
      </body>
    </html>
  `)
  win.document.close()
}

// ============================================================================
// 1. 80mm Customer Receipt (Bill / Tax Invoice)
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

  openThermalPrintWindow(`Receipt ${orderCode}`, html)
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

  openThermalPrintWindow(`Daily Report - ${date}`, html)
}

// ============================================================================
// 3. 80mm Executive / Period Sales Summary Slip
// ============================================================================
export function printExecutiveReport({
  period = "Daily",
  totalRevenue = 0,
  paidOrders = [],
  avgOrderValue = 0,
  periodOrders = [],
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

  const html = `
    <div class="center">
      <div class="brand-box">
        <div class="brand-title">ZOOM</div>
        <div class="brand-sub">SALES SUMMARY REPORT</div>
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

  openThermalPrintWindow(`Sales Report - ${period}`, html)
}