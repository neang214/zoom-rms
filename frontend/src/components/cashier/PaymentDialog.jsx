import { useState, useEffect, useRef, useCallback } from "react"
import { Check, QrCode, Loader2, X, CreditCard, Printer, RefreshCw, AlertTriangle } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { cn, menuItemName } from "@/lib/utils"
import { KHR_RATE, formatUSD, formatKHR, orderTotal } from "@/lib/currency"
import { usePaymentStore } from "../../context/paymentContext"
import api from "../../services/axios"
import { useSocketEvent } from "../../services/socket"
import { printOrderReceipt } from "./orderHelpers"
import { useLang } from "@/i18n/LanguageContext"

export default function PaymentDialog({ order, paymentMethods = [], onClose, onPaid }) {
  const { t, lang } = useLang()
  const { createPayment } = usePaymentStore()

  const [payMethodId, setPayMethodId] = useState(null)
  const [paying, setPaying] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [cashGiven, setCashGiven] = useState("")
  const [cashCur, setCashCur] = useState("USD")

  const [payMode, setPayMode] = useState("normal")
  const [khqrData, setKhqrData] = useState(null)
  const [khqrGeneratedTotal, setKhqrGeneratedTotal] = useState(null)
  const [khqrCurrency, setKhqrCurrency] = useState("KHR")
  const [khqrGenerating, setKhqrGenerating] = useState(false)
  const [khqrPaid, setKhqrPaid] = useState(false)
  const [khqrError, setKhqrError] = useState(null)
  const [khqrConfirming, setKhqrConfirming] = useState(false)
  const [khqrCheckingNow, setKhqrCheckingNow] = useState(false)
  const [khqrCountdown, setKhqrCountdown] = useState(600)

  const khqrPollRef = useRef(null)
  const khqrDelayRef = useRef(null)
  const khqrCountdownRef = useRef(null)
  const khqrSessionReqRef = useRef(0)
  const handledPaidRef = useRef(false)
  const checkingInFlightRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const onPaidRef = useRef(onPaid)

  useEffect(() => {
    onCloseRef.current = onClose
    onPaidRef.current = onPaid
  }, [onClose, onPaid])

  const stopKhqrPolling = useCallback(() => {
    khqrSessionReqRef.current += 1
    if (khqrDelayRef.current) clearTimeout(khqrDelayRef.current)
    if (khqrPollRef.current) clearInterval(khqrPollRef.current)
    if (khqrCountdownRef.current) clearInterval(khqrCountdownRef.current)
    khqrDelayRef.current = null
    khqrPollRef.current = null
    khqrCountdownRef.current = null
  }, [])

  const finishKhqrPayment = useCallback(() => {
    if (handledPaidRef.current) return
    handledPaidRef.current = true
    stopKhqrPolling()
    setKhqrPaid(true)
    setKhqrError(null)
    onPaidRef.current?.()
  }, [stopKhqrPolling])

  // Reset full dialog state when opening a different order
  useEffect(() => {
    if (!order?.order_id) return
    stopKhqrPolling()
    handledPaidRef.current = false
    checkingInFlightRef.current = false
    setPayMethodId(
      paymentMethods.find((m) => !/khqr|aba|bakong/i.test(m.method_name))?.method_id ||
        paymentMethods[0]?.method_id ||
        null
    )
    setPaying(false)
    setErrorMsg("")
    setCashGiven("")
    setCashCur("USD")
    setPayMode("normal")
    setKhqrData(null)
    setKhqrGeneratedTotal(null)
    setKhqrGenerating(false)
    setKhqrPaid(false)
    setKhqrError(null)
    setKhqrConfirming(false)
    setKhqrCheckingNow(false)
  }, [order?.order_id, stopKhqrPolling])

  useEffect(() => {
    if (!payMethodId && paymentMethods.length > 0) {
      setPayMethodId(
        paymentMethods.find((m) => !/khqr|aba|bakong/i.test(m.method_name))?.method_id ||
          paymentMethods[0]?.method_id ||
          null
      )
    }
  }, [paymentMethods, payMethodId])

  // Lock body scroll and allow Escape to close when not processing
  useEffect(() => {
    if (!order?.order_id) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e) => {
      if (e.key === "Escape" && !paying && !khqrConfirming) {
        stopKhqrPolling()
        onCloseRef.current?.()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [order?.order_id, paying, khqrConfirming, stopKhqrPolling])

  useEffect(() => () => stopKhqrPolling(), [stopKhqrPolling])

  // Invalidate dynamic KHQR if the live order total changes before payment completes
  const liveTotal = order ? orderTotal(order) : 0
  useEffect(() => {
    if (
      payMode === "khqr" &&
      !khqrPaid &&
      khqrData &&
      !khqrData.is_static &&
      khqrGeneratedTotal != null &&
      Math.abs(liveTotal - khqrGeneratedTotal) > 0.001
    ) {
      stopKhqrPolling()
      setKhqrData(null)
      setKhqrError(
        lang === "km"
          ? "តម្លៃសរុបបានផ្លាស់ប្តូរ — សូមបង្កើតកូដ KHQR ថ្មីម្តងទៀត។"
          : "Order total changed — please regenerate KHQR for the updated amount."
      )
    }
  }, [liveTotal, payMode, khqrPaid, khqrData, khqrGeneratedTotal, stopKhqrPolling, lang])

  useSocketEvent("payment:completed", (data) => {
    if (order?.order_id && Number(data?.order_id) === Number(order.order_id)) {
      finishKhqrPayment()
    }
  })

  useSocketEvent("order:status_changed", (data) => {
    if (
      order?.order_id &&
      Number(data?.order_id) === Number(order.order_id) &&
      data?.status === "Paid"
    ) {
      finishKhqrPayment()
    }
  })

  if (!order) return null

  const total = liveTotal
  const totalKHR = Math.round(total * KHR_RATE)
  const itemCount =
    order.order_items?.reduce((s, oi) => s + Number(oi.quantity || 0), 0) || 0

  const khqrMethod = paymentMethods.find((m) => /khqr|aba|bakong/i.test(m.method_name))
  const normalMethods = paymentMethods.filter((m) => m.method_id !== khqrMethod?.method_id)

  const selectedMethod = paymentMethods.find((m) => m.method_id === payMethodId)
  const isCash = /cash|សាច់ប្រាក់/i.test(selectedMethod?.method_name || "")
  const cashInput = parseFloat(cashGiven) || 0
  const cashUSD = cashCur === "KHR" ? cashInput / KHR_RATE : cashInput
  const change = cashUSD - total
  const isShort = change < -0.005
  const totalInCur = cashCur === "KHR" ? totalKHR : total
  const fmt = (usd) => (cashCur === "KHR" ? formatKHR(usd) : formatUSD(usd))

  const handleClose = () => {
    stopKhqrPolling()
    onCloseRef.current?.()
  }

  const checkMd5Now = async (
    dataToCheck = khqrData,
    showFeedback = false,
    reqId = khqrSessionReqRef.current
  ) => {
    if (
      !dataToCheck?.md5 ||
      !dataToCheck?.khqr_token ||
      dataToCheck.is_static ||
      handledPaidRef.current
    ) {
      return
    }
    if (!showFeedback && checkingInFlightRef.current) return
    checkingInFlightRef.current = true
    if (showFeedback) {
      setKhqrCheckingNow(true)
      setKhqrError(null)
    }
    try {
      const check = await api.get(
        `/payments/khqr/check/${encodeURIComponent(dataToCheck.md5)}?order_id=${order.order_id}&token=${encodeURIComponent(dataToCheck.khqr_token)}`,
        { silent: !showFeedback }
      )
      if (reqId !== khqrSessionReqRef.current || handledPaidRef.current) return
      if (check.data?.paid) {
        finishKhqrPayment()
      } else if (check.data?.ip_blocked) {
        stopKhqrPolling()
        setKhqrError(
          "Auto-confirm blocked by Bakong API (403). Verify payment on your phone and click confirm."
        )
      } else if (check.data?.token_missing || check.data?.auth_error) {
        stopKhqrPolling()
        setKhqrError(check.data.reason || "Bakong token not configured or expired on server.")
      } else if (check.data?.rate_limited) {
        stopKhqrPolling()
        setKhqrError(`Bakong API: ${check.data.reason || "Daily request limit exceeded."}`)
      } else if (showFeedback) {
        setKhqrError(
          check.data?.reason
            ? `Bakong status: ${check.data.reason}`
            : lang === "km"
              ? "មិនទាន់រកឃើញការទូទាត់នៅលើ Bakong នៅឡើយទេ។ សូមព្យាយាមម្តងទៀតបន្តិចទៀត។"
              : "Payment not detected on Bakong yet. Please try again in a few seconds."
        )
      }
    } catch (err) {
      if (reqId !== khqrSessionReqRef.current || handledPaidRef.current) return
      const status = err?.response?.status
      if (status === 409 && err?.response?.data?.already_paid) {
        finishKhqrPayment()
      } else if (status === 400 || status === 403 || status === 404 || status === 409) {
        stopKhqrPolling()
        setKhqrError(
          err?.response?.data?.message || "KHQR verification stopped. Please generate a new QR code."
        )
      } else if (showFeedback) {
        setKhqrError(err?.response?.data?.message || "Could not check Bakong status.")
      }
    } finally {
      checkingInFlightRef.current = false
      if (showFeedback) setKhqrCheckingNow(false)
    }
  }

  const startKhqrSession = async (curMode = khqrCurrency) => {
    stopKhqrPolling()
    const reqId = khqrSessionReqRef.current
    setKhqrError(null)
    setKhqrPaid(false)
    setKhqrData(null)
    setKhqrGenerating(true)
    handledPaidRef.current = false
    checkingInFlightRef.current = false
    setKhqrCountdown(600)

    const snapshotTotal = total

    try {
      const res = await api.post("/payments/khqr/generate", {
        order_id: order.order_id,
        currency: curMode,
      })
      if (khqrSessionReqRef.current !== reqId || handledPaidRef.current) return

      const generated = res.data
      setKhqrData(generated)
      setKhqrGeneratedTotal(snapshotTotal)

      const remainingSec = generated.expires_at
        ? Math.max(1, Math.floor((generated.expires_at - Date.now()) / 1000))
        : 600
      setKhqrCountdown(remainingSec)

      if (!generated.is_static && curMode !== "STATIC" && generated.md5) {
        let attempts = 0
        const MAX_AUTO_CHECKS = 145

        const pollCheck = () => {
          if (handledPaidRef.current || khqrSessionReqRef.current !== reqId || document.hidden) {
            return
          }
          attempts += 1
          if (attempts > MAX_AUTO_CHECKS) {
            if (khqrPollRef.current) clearInterval(khqrPollRef.current)
            khqrPollRef.current = null
            return
          }
          checkMd5Now(generated, false, reqId)
        }

        khqrDelayRef.current = setTimeout(() => {
          pollCheck()
          khqrPollRef.current = setInterval(pollCheck, 4000)
        }, 4000)
      }

      khqrCountdownRef.current = setInterval(() => {
        setKhqrCountdown((prev) => {
          if (prev <= 1) {
            stopKhqrPolling()
            setKhqrData(null)
            setKhqrError(
              lang === "km"
                ? "កូដ QR បានផុតកំណត់ហើយ។ សូមជ្រើសរើសរូបិយប័ណ្ណខាងលើដើម្បីបង្កើតថ្មី។"
                : "QR code expired. Select a currency above to generate a new one."
            )
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      if (khqrSessionReqRef.current !== reqId) return
      if (err?.response?.status === 409 && err?.response?.data?.already_paid) {
        finishKhqrPayment()
      } else {
        setKhqrError(err?.response?.data?.message || "Failed to generate KHQR code.")
      }
    } finally {
      if (khqrSessionReqRef.current === reqId) {
        setKhqrGenerating(false)
      }
    }
  }

  const handleKhqrCurrencySwitch = (newCur) => {
    setKhqrCurrency(newCur)
    startKhqrSession(newCur)
  }

  const confirmPay = async (shouldPrint = false) => {
    if (!payMethodId) {
      setErrorMsg("Please select a payment method.")
      return
    }
    if (isCash && cashInput > 0 && isShort) {
      setErrorMsg("Cash received is less than the order total.")
      return
    }
    setPaying(true)
    setErrorMsg("")
    try {
      await createPayment({ order_id: order.order_id, method_id: payMethodId })
      if (shouldPrint) {
        printOrderReceipt({
          ...order,
          status: "Paid",
          payments: [{ method: selectedMethod || { method_name: "Cash" } }],
        })
      }
      onPaid?.()
      onClose()
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Failed to process payment.")
    } finally {
      setPaying(false)
    }
  }

  const confirmKHQRPay = async () => {
    stopKhqrPolling()
    setKhqrConfirming(true)
    setKhqrError(null)
    try {
      if (khqrMethod) {
        await createPayment({ order_id: order.order_id, method_id: khqrMethod.method_id })
      } else if (paymentMethods[0]?.method_id) {
        await createPayment({ order_id: order.order_id, method_id: paymentMethods[0].method_id })
      } else {
        await createPayment({ order_id: order.order_id, method_name: "KHQR" })
      }
      finishKhqrPayment()
    } catch (err) {
      if (err?.response?.status === 409) {
        finishKhqrPayment()
      } else {
        setKhqrError(err?.response?.data?.message || "Failed to confirm payment.")
      }
    } finally {
      setKhqrConfirming(false)
    }
  }

  const switchMode = (mode) => {
    if (mode === "normal") {
      stopKhqrPolling()
      setKhqrData(null)
      setKhqrError(null)
      setPayMode("normal")
    } else {
      setPayMode("khqr")
      startKhqrSession(khqrCurrency)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={() => !paying && !khqrConfirming && handleClose()}
    >
      <div
        className="bg-[var(--color-surface)] rounded-3xl shadow-2xl w-full max-w-md border border-[var(--color-border)] overflow-hidden flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--color-surface-subtle)]/80 border-b border-[var(--color-border)] shrink-0">
          <div>
            <div className="font-bold text-sm text-[var(--color-text)]">
              {t("common.order")} #{String(order.order_id).padStart(4, "0")}
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {t("common.table")} {order.table?.table_number || "—"} · {itemCount}{" "}
              {t("station.items")} ·{" "}
              {new Date(order.order_date).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close payment dialog"
            className="p-1.5 rounded-xl hover:bg-[var(--color-border)]/60 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Amount Showcase */}
        <div className="text-center px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-primary-muted)]/35 shrink-0">
          <div className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            {t("pay.totalToCollect")}
          </div>
          <div className="font-display text-3xl font-bold text-[var(--color-text)] mt-0.5 tabular-nums">
            {formatUSD(total)}
          </div>
          <div className="text-sm font-semibold text-[var(--color-primary)] tabular-nums">
            {formatKHR(total)}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl">
            <button
              type="button"
              onClick={() => switchMode("normal")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                payMode === "normal"
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              )}
            >
              <CreditCard size={15} /> {t("pay.cashCard")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("khqr")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                payMode === "khqr"
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              )}
            >
              <QrCode size={15} /> {t("pay.khqr")}
            </button>
          </div>

          {payMode === "normal" ? (
            <>
              <div className="rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]/70 max-h-36 overflow-y-auto">
                {order.order_items?.map((oi) => (
                  <div
                    key={oi.order_item_id}
                    className="flex items-center justify-between px-3.5 py-2 text-xs sm:text-sm"
                  >
                    <span className="text-[var(--color-text)] truncate pr-2">
                      <span className="font-bold text-[var(--color-muted)] mr-1.5">
                        {oi.quantity}×
                      </span>
                      {menuItemName(oi.menu_item, lang)}
                    </span>
                    <span className="text-[var(--color-muted)] tabular-nums shrink-0">
                      {formatUSD(Number(oi.unit_price) * oi.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">
                  {t("pay.method")}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(normalMethods.length > 0 ? normalMethods : paymentMethods).map((m) => (
                    <button
                      key={m.method_id}
                      type="button"
                      onClick={() => setPayMethodId(m.method_id)}
                      className={cn(
                        "flex items-center gap-2.5 p-3 rounded-2xl border-2 text-sm font-semibold transition-all min-h-[50px] cursor-pointer",
                        payMethodId === m.method_id
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/40"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0",
                          payMethodId === m.method_id
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-[var(--color-surface-subtle)] text-[var(--color-primary)]"
                        )}
                      >
                        {m.method_name.charAt(0)}
                      </div>
                      <span className="truncate">{m.method_name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isCash && (
                <div className="space-y-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      {t("pay.cashReceived")}
                    </div>
                    <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                      {["USD", "KHR"].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCashCur(c)
                            setCashGiven("")
                          }}
                          className={cn(
                            "px-3 py-1 text-xs font-bold transition-colors cursor-pointer",
                            cashCur === c
                              ? "bg-[var(--color-primary)] text-white"
                              : "text-[var(--color-text-secondary)]"
                          )}
                        >
                          {c === "USD" ? "$" : "៛"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] text-lg font-bold">
                      {cashCur === "USD" ? "$" : "៛"}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={cashCur === "USD" ? "0.01" : "100"}
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      placeholder={cashCur === "USD" ? "0.00" : "0"}
                      className="w-full h-12 pl-9 pr-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-lg font-bold text-[var(--color-text)] tabular-nums outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setCashGiven(cashCur === "KHR" ? String(totalInCur) : total.toFixed(2))
                      }
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] cursor-pointer"
                    >
                      {t("pay.exact")}
                    </button>
                    {(cashCur === "USD"
                      ? [1, 5, 10, 20, 50, 100].filter((v) => v >= total)
                      : [5000, 10000, 20000, 50000, 100000].filter((v) => v >= totalInCur)
                    )
                      .slice(0, 4)
                      .map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCashGiven(String(v))}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] cursor-pointer tabular-nums"
                        >
                          {cashCur === "USD" ? `$${v}` : `៛${v.toLocaleString()}`}
                        </button>
                      ))}
                  </div>

                  <div
                    className={cn(
                      "rounded-xl px-3.5 py-2.5 flex items-center justify-between",
                      cashInput === 0
                        ? "bg-[var(--color-surface)] border border-[var(--color-border)]"
                        : isShort
                          ? "bg-[var(--color-danger-muted)]"
                          : "bg-[var(--color-primary-muted)]"
                    )}
                  >
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {t("pay.change")}
                    </span>
                    {cashInput === 0 ? (
                      <span className="text-sm text-[var(--color-muted)]">—</span>
                    ) : isShort ? (
                      <span className="text-sm font-bold text-[var(--color-danger)] tabular-nums">
                        {t("pay.short")} {fmt(Math.abs(change))}
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-[var(--color-primary)] tabular-nums">
                        {fmt(Math.max(0, change))}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="text-xs font-medium text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3.5 py-2.5"
                >
                  {errorMsg}
                </div>
              )}
            </>
          ) : (
            <>
              {!khqrPaid && (
                <div className="space-y-3">
                  {/* Currency / Static Switcher */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: "KHR", label: formatKHR(total) },
                      { key: "USD", label: formatUSD(total) },
                      { key: "STATIC", label: lang === "km" ? "QR ថេរ" : "Static QR" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKhqrCurrencySwitch(key)}
                        className={cn(
                          "py-2 px-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer tabular-nums",
                          khqrCurrency === key
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/40"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {khqrGenerating && !khqrData && (
                    <div className="flex flex-col items-center justify-center py-12 text-xs text-[var(--color-muted)] gap-2">
                      <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                      <span>{t("pay.generating")}</span>
                    </div>
                  )}

                  {khqrData && (
                    <div className="text-center space-y-2.5">
                      <div className="mx-auto max-w-[244px] bg-white rounded-2xl border-2 border-[#e11d48] overflow-hidden shadow-md">
                        <div className="bg-[#e11d48] text-white py-2 px-3 font-black text-sm tracking-widest">
                          KHQR
                        </div>
                        <div className="px-4 pt-2.5 pb-1.5 text-left border-b border-dashed border-slate-200">
                          <div className="text-[11px] font-bold text-slate-600 uppercase truncate">
                            {khqrData.merchant_name || "ZOOM Garden Café & Wine"}
                          </div>
                          <div className="text-base font-black text-slate-900 tabular-nums">
                            {khqrData.is_static || khqrCurrency === "STATIC"
                              ? `${formatKHR(total)} / ${formatUSD(total)}`
                              : khqrData.currency === "USD"
                                ? formatUSD(khqrData.amount)
                                : `៛${Number(khqrData.amount).toLocaleString()}`}
                          </div>
                        </div>
                        <div className="p-3 flex justify-center bg-white">
                          <QRCodeSVG value={khqrData.qr} size={185} level="M" />
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3 text-xs text-[var(--color-muted)]">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Loader2 size={12} className="animate-spin" /> {t("pay.waiting")}{" "}
                          {Math.floor(khqrCountdown / 60)}:
                          {String(khqrCountdown % 60).padStart(2, "0")}
                        </span>
                        {!khqrData.is_static && khqrCurrency !== "STATIC" && (
                          <button
                            type="button"
                            onClick={() => checkMd5Now(khqrData, true)}
                            disabled={khqrCheckingNow}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw
                              size={12}
                              className={cn(khqrCheckingNow && "animate-spin")}
                            />
                            {lang === "km" ? "ពិនិត្យឥឡូវ" : "Check Now"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {khqrError && (
                    <div className="space-y-2 text-xs text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 font-medium">
                        <AlertTriangle size={13} className="shrink-0" />
                        <span>{khqrError}</span>
                      </div>
                      {!khqrData && (
                        <button
                          type="button"
                          onClick={() => startKhqrSession(khqrCurrency)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                        >
                          <RefreshCw size={12} /> {t("pay.generateQr")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {khqrPaid && (
                <div className="text-center space-y-3 py-6">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-muted)] flex items-center justify-center mx-auto">
                    <Check size={32} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="font-display font-bold text-xl text-[var(--color-primary)]">
                    {t("pay.confirmed")}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">{t("pay.markedPaid")}</div>
                  <div className="pt-2 flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        printOrderReceipt({
                          ...order,
                          status: "Paid",
                          payments: [{ method: khqrMethod || { method_name: "KHQR" } }],
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer"
                    >
                      <Printer size={14} /> {t("cashier.printReceipt")}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
                    >
                      {t("common.close")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!khqrPaid && (
          <div className="px-5 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
            {payMode === "normal" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={paying}
                  className="px-4 py-3 rounded-xl border border-[var(--color-border)] text-xs sm:text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => confirmPay(false)}
                  disabled={paying || (isCash && cashInput > 0 && isShort)}
                  className="flex-1 py-3 rounded-xl border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  {paying ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span className="truncate">
                    {paying ? t("pay.processing") : `${t("pay.charge")} ${formatUSD(total)}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => confirmPay(true)}
                  disabled={paying || (isCash && cashInput > 0 && isShort)}
                  className="flex-[1.15] py-3 rounded-xl bg-[var(--color-primary)] text-white text-xs sm:text-sm font-bold hover:bg-[var(--color-primary-dark)] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer shadow-xs"
                >
                  <Printer size={15} />
                  <span>{lang === "km" ? "គិត & បោះពុម្ព" : "Pay & Print"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={confirmKHQRPay}
                  disabled={khqrConfirming}
                  className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-dark)] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-xs"
                >
                  {khqrConfirming ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> {t("pay.confirming")}
                    </>
                  ) : (
                    <>
                      <Check size={16} /> {t("pay.customerPaid")}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
