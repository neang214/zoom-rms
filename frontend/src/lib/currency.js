export const KHR_RATE = 4100

export function formatUSD(amount) {
  const n = Number(amount) || 0
  return `$${n.toFixed(2)}`
}

export function formatKHR(amountUSD) {
  const n = Number(amountUSD) || 0
  return `៛${Math.round(n * KHR_RATE).toLocaleString()}`
}

export function orderTotal(order) {
  return (
    order?.order_items?.reduce(
      (sum, oi) => sum + Number(oi.unit_price || 0) * Number(oi.quantity || 0),
      0
    ) || 0
  )
}

export function toLocalDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Neutralizes spreadsheet formula injection (cells starting with =, +, -, @, tab, CR)
 * before quoting for CSV export.
 */
export function sanitizeCsvCell(val) {
  let s = String(val ?? "")
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`
  }
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * Resizes and normalizes uploaded photos to JPEG so phone photos don't bloat uploads.
 */
export function normalizeImageToJpg(file, maxWidth = 800, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const cleanName = (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg"
          resolve(new File([blob], cleanName, { type: "image/jpeg" }))
        },
        "image/jpeg",
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}
