import { useEffect, useRef, useState, useCallback } from "react"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { QrCode, X, Loader2 } from "lucide-react"
import { useLang } from "@/i18n/LanguageContext"

const SCANNER_ELEMENT_ID = "receipt-qr-scanner"

function extractOrderId(decodedText) {
  if (!decodedText) return null
  const clean = String(decodedText).trim()

  const prefMatch = clean.match(/(?:order:?|ORD-?|#)(\d+)/i)
  if (prefMatch) return parseInt(prefMatch[1], 10)

  const urlMatch = clean.match(/[?&/]order[=_/-]?(\d+)/i)
  if (urlMatch) return parseInt(urlMatch[1], 10)

  if (/^\d+$/.test(clean)) return parseInt(clean, 10)
  return null
}

export default function ReceiptScanner({ onFound, onClose }) {
  const { t, lang } = useLang()
  const [error, setError] = useState("")
  const scannerRef = useRef(null)
  const onFoundRef = useRef(onFound)
  onFoundRef.current = onFound

  const stopScanner = useCallback(async () => {
    const qr = scannerRef.current
    if (!qr) return
    scannerRef.current = null
    try {
      await qr.stop()
    } catch {}
    try {
      await qr.clear()
    } catch {}
  }, [])

  const handleClose = useCallback(async () => {
    await stopScanner()
    onClose()
  }, [stopScanner, onClose])

  useEffect(() => {
    let cancelled = false
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKeyDown)

    const start = async () => {
      try {
        const qr = new Html5Qrcode(SCANNER_ELEMENT_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A,
          ],
          verbose: false,
        })
        scannerRef.current = qr

        await qr.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 260, height: 180 } },
          async (decodedText) => {
            if (cancelled) return
            const orderId = extractOrderId(decodedText)
            if (orderId) {
              cancelled = true
              await stopScanner()
              onFoundRef.current?.(orderId)
            } else {
              setError(
                lang === "km"
                  ? `បានស្កេន "${decodedText}" — សូមស្កេនបាកូដ ឬ QR លើវិក្កយបត្រ។`
                  : `Scanned "${decodedText}". Please scan the receipt barcode or QR code.`
              )
            }
          },
          () => {}
        )

        if (cancelled) {
          await stopScanner()
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setError(t("guest.cameraError"))
        }
      }
    }

    start()

    return () => {
      cancelled = true
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
      stopScanner()
    }
  }, [handleClose, stopScanner, t, lang])

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 max-w-2xl w-full mx-auto">
        <div className="flex items-center gap-2.5 text-white">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <QrCode size={16} />
          </div>
          <span className="text-sm font-semibold">{t("cashier.scanReceipt")}</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close scanner"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div
          id={SCANNER_ELEMENT_ID}
          className="w-full max-w-sm rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-2xl"
        />
      </div>

      <div className="p-6 text-center text-white/75 text-xs space-y-2">
        {error ? (
          <div className="text-red-300 font-medium">{error}</div>
        ) : (
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white/10">
            <Loader2 size={13} className="animate-spin text-emerald-300" />
            <span>
              {lang === "km"
                ? "តម្រង់កាមេរ៉ាទៅកាន់បាកូដ ឬ QR កូដលើវិក្កយបត្រ"
                : "Point camera at the barcode or QR code on the receipt"}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
