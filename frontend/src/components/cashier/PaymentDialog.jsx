import { useState, useEffect, useRef, useCallback } from "react"
import { Check, QrCode, Loader2, X, CreditCard, Printer, RefreshCw } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { cn, menuItemName } from "@/lib/utils"
import { usePaymentStore } from "../../context/paymentContext"
import api from "../../services/axios"
import { useSocketEvent } from "../../services/socket"
import { orderTotal, KHR_RATE, printOrderReceipt } from "./orderHelpers"
import { useLang } from "@/i18n/LanguageContext"

// Builds KHQR strictly from the backend API so MD5 and order/amount binding stay verified server-side

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
  const [khqrCurrency, setKhqrCurrency] = useState("KHR") // "KHR" | "USD" | "STATIC"
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

  useEffect(() => {
    if (!order?.order_id) return
    stopKhqrPolling()
    handledPaidRef.current = false
    setPayMethodId(paymentMethods.find(m => !/khqr|aba|bakong/i.test(m.method_name))?.method_id || paymentMethods[0]?.method_id || null)
    setErrorMsg("")
    setCashGiven("")
    setCashCur("USD")
    setPayMode("normal")
    setKhqrData(null)
    setKhqrGenerating(false)
    setKhqrPaid(false)
    setKhqrError(null)
  }, [order?.order_id, stopKhqrPolling])

  useEffect(() => {
    if (!payMethodId && paymentMethods.length > 0) {
      setPayMethodId(paymentMethods.find(m => !/khqr|aba|bakong/i.test(m.method_name))?.method_id || paymentMethods[0]?.method_id || null)
    }
  }, [paymentMethods, payMethodId])

  useEffect(() => {
    return () => {
      stopKhqrPolling()
    }
  }, [stopKhqrPolling])

  useSocketEvent("payment:completed", (data) => {
    if (order?.order_id && Number(data?.order_id) === Number(order.order_id)) {
      finishKhqrPayment()
    }
  })

  useSocketEvent("order:status_changed", (data) => {
    if (order?.order_id && Number(data?.order_id) === Number(order.order_id) && data?.status === "Paid") {
      finishKhqrPayment()
    }
  })

  if (!order) return null

  const total = orderTotal(order)
  const totalKHR = Math.round(total * KHR_RATE)
  const itemCount = order.order_items?.reduce((s, oi) => s + Number(oi.quantity || 0), 0) || 0

  const khqrMethod = paymentMethods.find(m => /khqr|aba|bakong/i.test(m.method_name))
  const normalMethods = paymentMethods.filter(m => m.method_id !== khqrMethod?.method_id)

  const selectedMethod = paymentMethods.find(m => m.method_id === payMethodId)
  const isCash = /cash|សាច់ប្រាក់/i.test(selectedMethod?.method_name || "")
  const cashInput = parseFloat(cashGiven) || 0
  const cashUSD = cashCur === "KHR" ? cashInput / KHR_RATE : cashInput
  const change = cashUSD - total
  const isShort = change < -0.005
  const totalInCur = cashCur === "KHR" ? Math.round(total * KHR_RATE) : total
  const fmt = (usd) => cashCur === "KHR"
    ? `៛${Math.round(usd * KHR_RATE).toLocaleString()}`
    : `$${usd.toFixed(2)}`

  const handleClose = () => {
    stopKhqrPolling()
    onCloseRef.current?.()
  }

  const checkMd5Now = async (dataToCheck = khqrData, showFeedback = false, reqId = khqrSessionReqRef.current) => {
    if (!dataToCheck?.md5 || !dataToCheck?.khqr_token || dataToCheck.is_static || handledPaidRef.current) return
    if (!showFeedback && checkingInFlightRef.current) return
    checkingInFlightRef.current = true
    if (showFeedback) {
      setKhqrCheckingNow(true)
      setKhqrError(null)
    }
    try {
      const check = await api.get(
        `/payments/khqr/check/${encodeURIComponent(dataToCheck.md5)}?order_id=${order.order_id}&token=${encodeURIComponent(dataToCheck.khqr_token)}`
      )
      if (reqId !== khqrSessionReqRef.current || handledPaidRef.current) return
      if (check.data?.paid) {
        finishKhqrPayment()
      } else if (check.data?.ip_blocked) {
        stopKhqrPolling()
        setKhqrError(
          "Auto-confirm blocked: Bakong API blocks Render's overseas server IP (403). Verify payment on your phone and click \"Customer paid — confirm\"."
        )
      } else if (check.data?.token_missing || check.data?.auth_error) {
        stopKhqrPolling()
        setKhqrError(check.data.reason || "Bakong token not configured or expired on server.")
      } else if (check.data?.rate_limited) {
        stopKhqrPolling()
        setKhqrError(`Bakong API: ${check.data.reason || "Daily request limit (100/day) exceeded."}`)
      } else if (showFeedback) {
        setKhqrError(
          check.data?.reason
            ? `Bakong status: ${check.data.reason}`
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
        setKhqrError(err?.response?.data?.message || "KHQR verification stopped. Please generate a new QR code.")
      } else if (showFeedback) {
        setKhqrError(err?.response?.data?.message || "Could not check Bakong status. Please try again.")
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

    try {
      const res = await api.post("/payments/khqr/generate", {
        order_id: order.order_id,
        currency: curMode,
      })
      if (khqrSessionReqRef.current !== reqId || handledPaidRef.current) return

      const generated = res.data
      setKhqrData(generated)

      const remainingSec = generated.expires_at
        ? Math.max(1, Math.floor((generated.expires_at - Date.now()) / 1000))
        : 600
      setKhqrCountdown(remainingSec)

      // Static QR does not have a per-order MD5 in Bakong
      if (!generated.is_static && curMode !== "STATIC" && generated.md5) {
        let attempts = 0
        const MAX_AUTO_CHECKS = 145

        const pollCheck = () => {
          if (handledPaidRef.current || khqrSessionReqRef.current !== reqId || document.hidden) return
          attempts += 1
          if (attempts > MAX_AUTO_CHECKS) {
            if (khqrPollRef.current) clearInterval(khqrPollRef.current)
            khqrPollRef.current = null
            return
          }
          checkMd5Now(generated, false, reqId)
        }

        // Start checking after 4s, then every 4s throughout the 10-minute QR window
        khqrDelayRef.current = setTimeout(() => {
          pollCheck()
          khqrPollRef.current = setInterval(pollCheck, 4000)
        }, 4000)
      }

      khqrCountdownRef.current = setInterval(() => {
        setKhqrCountdown(prev => {
          if (prev <= 1) {
            stopKhqrPolling()
            setKhqrData(null)
            setKhqrError("QR code expired. Click a currency above to generate a new one.")
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
      const status = err?.response?.status
      if (status === 409 || status === 400) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--color-surface)] rounded-3xl shadow-2xl w-full max-w-md border border-[var(--color-border)] overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--color-primary-muted)] shrink-0">
          <div>
            <div className="font-semibold text-sm text-[var(--color-text)]">Order #{String(order.order_id).padStart(4, "0")}</div>
            <div className="text-[11px] text-[var(--color-muted)]">
              Table {order.table?.table_number} · {itemCount} {t("common.items")} · {new Date(order.order_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-black/5 text-[var(--color-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="text-center px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="text-[11px] text-[var(--color-muted)] uppercase tracking-wide">{t("pay.totalToCollect")}</div>
          <div className="text-3xl font-bold text-[var(--color-text)] mt-0.5">${total.toFixed(2)}</div>
          <div className="text-sm text-[var(--color-muted)]">៛{totalKHR.toLocaleString()}</div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--color-primary-muted)]/60 rounded-2xl">
            <button
              type="button"
              onClick={() => switchMode("normal")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                payMode === "normal" ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-secondary)]"
              )}
            >
              <CreditCard size={15} /> {t("pay.cashCard")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("khqr")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                payMode === "khqr" ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-secondary)]"
              )}
            >
              <QrCode size={15} /> {t("pay.khqr")}
            </button>
          </div>

          {payMode === "normal" ? (
            <>
              <div className="rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-40 overflow-y-auto">
                {order.order_items?.map((oi) => (
                  <div key={oi.order_item_id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-[var(--color-text)] truncate pr-2">
                      <span className="text-[var(--color-muted)] mr-1.5">{oi.quantity}×</span>{menuItemName(oi.menu_item, lang)}
                    </span>
                    <span className="text-[var(--color-muted)] shrink-0">${(Number(oi.unit_price) * oi.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-sm font-semibold text-[var(--color-text)] mb-2">{t("pay.method")}</div>
                <div className="grid grid-cols-2 gap-2">
                  {(normalMethods.length > 0 ? normalMethods : paymentMethods).map(m => (
                    <button
                      key={m.method_id}
                      type="button"
                      onClick={() => setPayMethodId(m.method_id)}
                      className={cn(
                        "flex items-center gap-2.5 p-3 rounded-2xl border-2 text-sm font-medium transition-all min-h-[52px] cursor-pointer",
                        payMethodId === m.method_id
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0",
                        payMethodId === m.method_id ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                      )}>
                        {m.method_name.charAt(0)}
                      </div>
                      {m.method_name}
                    </button>
                  ))}
                </div>
              </div>

              {isCash && (
                <div className="space-y-2 rounded-2xl border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--color-text)]">{t("pay.cashReceived")}</div>
                    <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
                      {["USD", "KHR"].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setCashCur(c); setCashGiven("") }}
                          className={cn(
                            "px-3 py-1 text-xs font-bold transition-colors cursor-pointer",
                            cashCur === c ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"
                          )}
                        >
                          {c === "USD" ? "$" : "៛"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] text-lg font-bold">{cashCur === "USD" ? "$" : "៛"}</span>
                    <input
                      type="number" inputMode="decimal" min="0" step={cashCur === "USD" ? "0.01" : "100"}
                      value={cashGiven}
                      onChange={e => setCashGiven(e.target.value)}
                      placeholder={cashCur === "USD" ? "0.00" : "0"}
                      className="w-full h-12 pl-8 pr-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-lg font-bold text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCashGiven(cashCur === "KHR" ? String(totalInCur) : total.toFixed(2))}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] cursor-pointer"
                    >
                      {t("pay.exact")}
                    </button>
                    {(cashCur === "USD"
                      ? [1, 5, 10, 20, 50, 100].filter(v => v >= total)
                      : [5000, 10000, 20000, 50000, 100000].filter(v => v >= totalInCur)
                    ).slice(0, 4).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCashGiven(String(v))}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] cursor-pointer"
                      >
                        {cashCur === "USD" ? `$${v}` : `៛${v.toLocaleString()}`}
                      </button>
                    ))}
                  </div>

                  <div className={cn(
                    "rounded-xl px-3 py-2.5 flex items-center justify-between",
                    cashInput === 0 ? "bg-[var(--color-primary-muted)]/40" : isShort ? "bg-[var(--color-danger-muted)]" : "bg-[var(--color-primary-muted)]"
                  )}>
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">{t("pay.change")}</span>
                    {cashInput === 0 ? (
                      <span className="text-sm text-[var(--color-muted)]">—</span>
                    ) : isShort ? (
                      <span className="text-sm font-bold text-[var(--color-danger)]">{t("pay.short")} {fmt(Math.abs(change))}</span>
                    ) : (
                      <span className="text-lg font-bold text-[var(--color-primary)]">{fmt(Math.max(0, change))}</span>
                    )}
                  </div>
                </div>
              )}

              {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2">{errorMsg}</div>}
            </>
          ) : (
            <>
              {!khqrPaid && (
                <div className="space-y-3">
                  {/* Live Currency / Mode Switcher */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: "KHR", label: `៛ ${totalKHR.toLocaleString()}` },
                      { key: "USD", label: `$ ${total.toFixed(2)}` },
                      { key: "STATIC", label: "Static QR" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKhqrCurrencySwitch(key)}
                        className={cn(
                          "py-2 px-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer",
                          khqrCurrency === key
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {khqrGenerating && !khqrData && (
                    <div className="flex flex-col items-center justify-center py-12 text-xs text-[var(--color-muted)] gap-2">
                      <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                      <span>Generating KHQR...</span>
                    </div>
                  )}

                  {khqrData && (
                    <div className="text-center space-y-2">
                      <div className="mx-auto max-w-[240px] bg-white rounded-2xl border-2 border-[#e11d48] overflow-hidden shadow-md">
                        <div className="bg-[#e11d48] text-white py-2 px-3 font-black text-sm tracking-widest">
                          KHQR
                        </div>
                        <div className="px-4 pt-2.5 pb-1 text-left border-b border-dashed border-slate-200">
                          <div className="text-[11px] font-bold text-slate-600 uppercase">
                            {khqrData.merchant_name || "Merchant"}
                          </div>
                          <div className="text-base font-black text-slate-900">
                            {khqrData.is_static || khqrCurrency === "STATIC"
                              ? `៛${totalKHR.toLocaleString()} / $${total.toFixed(2)}`
                              : khqrData.currency === "USD"
                                ? `$${Number(khqrData.amount).toFixed(2)}`
                                : `៛${Number(khqrData.amount).toLocaleString()}`}
                          </div>
                        </div>
                        <div className="p-3 flex justify-center bg-white">
                          <QRCodeSVG value={khqrData.qr} size={185} level="M" />
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3 text-xs text-[var(--color-muted)] pt-1">
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 size={12} className="animate-spin" /> {t("pay.waiting")} {Math.floor(khqrCountdown / 60)}:{String(khqrCountdown % 60).padStart(2, "0")}
                        </span>
                        {!khqrData.is_static && khqrCurrency !== "STATIC" && (
                          <button
                            type="button"
                            onClick={() => checkMd5Now(khqrData, true)}
                            disabled={khqrCheckingNow}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw size={12} className={cn(khqrCheckingNow && "animate-spin")} />
                            Check Now
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {khqrError && (
                    <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 text-center">
                      {khqrError}
                    </div>
                  )}
                </div>
              )}

              {khqrPaid && (
                <div className="text-center space-y-3 py-6">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-primary-muted)] flex items-center justify-center mx-auto">
                    <Check size={32} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="font-bold text-lg text-[var(--color-primary)]">{t("pay.confirmed")}</div>
                  <div className="text-xs text-[var(--color-muted)]">{t("pay.markedPaid")}</div>
                  <div className="pt-2 flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => printOrderReceipt({ ...order, status: "Paid", payments: [{ method: khqrMethod || { method_name: "KHQR" } }] })}
                      className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer"
                    >
                      <Printer size={14} /> {t("cashier.printReceipt")}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                    >
                      {t("common.close")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!khqrPaid && (
          <div className="px-5 py-3.5 border-t border-[var(--color-border)] shrink-0">
            {payMode === "normal" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={paying}
                  className="flex-1 py-3 rounded-2xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] transition-colors disabled:opacity-60 min-h-[48px] cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => confirmPay(false)}
                  disabled={paying || (isCash && cashInput > 0 && isShort)}
                  className="flex-[1.2] py-3 rounded-2xl border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] text-sm font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 min-h-[48px] cursor-pointer"
                >
                  {paying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {paying ? t("pay.processing") : `${t("pay.charge")} $${total.toFixed(2)}`}
                </button>
                <button
                  type="button"
                  onClick={() => confirmPay(true)}
                  disabled={paying || (isCash && cashInput > 0 && isShort)}
                  className="flex-[1.3] py-3 rounded-2xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-dark)] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 min-h-[48px] cursor-pointer"
                >
                  <Printer size={15} /> Pay &amp; Print
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={confirmKHQRPay}
                  disabled={khqrConfirming}
                  className="w-full py-3 rounded-2xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-dark)] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 min-h-[48px] cursor-pointer"
                >
                  {khqrConfirming ? <><Loader2 size={16} className="animate-spin" /> {t("pay.confirming")}</> : <><Check size={16} /> {t("pay.customerPaid")}</>}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-2xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
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