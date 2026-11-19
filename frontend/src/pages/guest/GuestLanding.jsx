import { useState, useRef, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Html5Qrcode } from "html5-qrcode"
import { usePageTitle } from "../../hooks/usePageTitle"
import { LandingContent, ScannerOverlay } from "@/components/guest/GuestLandingParts"
import { useLang } from "@/i18n/LanguageContext"

const SCANNER_ELEMENT_ID = "qr-scanner-viewport"

function extractToken(decodedText) {
  try {
    const url = new URL(decodedText)
    return url.searchParams.get("t")
  } catch {
    const match = decodedText.match(/t=([a-f0-9_-]+)/i)
    return match ? match[1] : decodedText.trim()
  }
}

export default function GuestLanding() {
  usePageTitle("Welcome")
  const navigate = useNavigate()
  const { t } = useLang()

  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState("")
  const [lastToken, setLastToken] = useState(null)
  const scannerRef = useRef(null)

  useEffect(() => {
    setLastToken(localStorage.getItem("zoom_last_table_token"))
  }, [])

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

  useEffect(() => {
    if (!scanning) return
    let cancelled = false

    const start = async () => {
      try {
        const qr = new Html5Qrcode(SCANNER_ELEMENT_ID)
        scannerRef.current = qr

        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText) => {
            if (cancelled) return
            cancelled = true
            const token = extractToken(decodedText)
            await stopScanner()
            setScanning(false)
            if (token) {
              navigate(`/order?t=${encodeURIComponent(token)}`)
            } else {
              setError(t("guest.qrUnreadable"))
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
          setScanning(false)
        }
      }
    }

    start()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [scanning, navigate, stopScanner, t])

  const handleStartScan = () => {
    setError("")
    setScanning(true)
  }

  const handleClose = async () => {
    setScanning(false)
    await stopScanner()
  }

  return (
    <div className="min-h-dvh w-full flex flex-col bg-[var(--color-background)] relative overflow-hidden">
      <LandingContent
        onScan={handleStartScan}
        lastToken={lastToken}
        error={error}
        navigate={navigate}
      />
      <ScannerOverlay
        scanning={scanning}
        elementId={SCANNER_ELEMENT_ID}
        onClose={handleClose}
      />
    </div>
  )
}
