import { useState, useEffect, useRef, useCallback } from "react"
import { Check, QrCode, Loader2, X, CreditCard, Printer } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { cn, menuItemName } from "@/lib/utils"
import { usePaymentStore } from "../../context/paymentContext"
import api from "../../services/axios"
import { useSocketEvent } from "../../services/socket"
import { orderTotal, KHR_RATE, printOrderReceipt } from "./orderHelpers"
import { useLang } from "@/i18n/LanguageContext"

// Exact static KHQR string for Reaksmey Rin (reaksmey_rin@bkrt)
const REAKSMEY_STATIC_KHQR =
  "00020101021115311974011600520446BONG1000231208129210017reaksmey_rin@bkrt5204599953031165802KH5912Reaksmey Rin6010Phnom Penh63048D0A"

// EMVCo CRC-16/CCITT-FALSE (polynomial 0x1021, initial 0xFFFF)
function crc16ccitt(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

// Pure JS MD5 (RFC 1321) to compute Bakong transaction MD5 hash for auto-polling
function md5Hex(input) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits))
  }
  function addUnsigned(lX, lY) {
    const lX8 = lX & 0x80000000
    const lY8 = lY & 0x80000000
    const lX4 = lX & 0x40000000
    const lY4 = lY & 0x40000000
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff)
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8
      return lResult ^ 0x40000000 ^ lX8 ^ lY8
    }
    return lResult ^ lX8 ^ lY8
  }
  function F(x, y, z) { return (x & y) | (~x & z) }
  function G(x, y, z) { return (x & z) | (y & ~z) }
  function H(x, y, z) { return x ^ y ^ z }
  function I(x, y, z) { return y ^ (x | ~z) }
  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function convertToWordArray(str) {
    const lWordCount = []
    const lMessageLength = str.length
    const lNumberOfWordsTemp1 = lMessageLength + 8
    const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64
    const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16
    for (let i = 0; i < lNumberOfWords; i++) lWordCount[i] = 0
    let lBytePosition = 0
    let lByteCount = 0
    while (lByteCount < lMessageLength) {
      const lWordPosition = (lByteCount - (lByteCount % 4)) / 4
      lBytePosition = (lByteCount % 4) * 8
      lWordCount[lWordPosition] = lWordCount[lWordPosition] | (str.charCodeAt(lByteCount) << lBytePosition)
      lByteCount++
    }
    const lWordPosition = (lByteCount - (lByteCount % 4)) / 4
    lBytePosition = (lByteCount % 4) * 8
    lWordCount[lWordPosition] = lWordCount[lWordPosition] | (0x80 << lBytePosition)
    lWordCount[lNumberOfWords - 2] = lMessageLength << 3
    lWordCount[lNumberOfWords - 1] = lMessageLength >>> 29
    return lWordCount
  }
  function wordToHex(lValue) {
    let wordToHexValue = ""
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255
      const temp = "0" + lByte.toString(16)
      wordToHexValue += temp.substr(temp.length - 2, 2)
    }
    return wordToHexValue
  }

  const x = convertToWordArray(input)
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d
    a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478)
    d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756)
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070db)
    b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee)
    a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf)
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a)
    c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613)
    b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501)
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8)
    d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af)
    c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1)
    b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be)
    a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122)
    d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193)
    c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e)
    b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821)
    a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562)
    d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340)
    c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51)
    b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa)
    a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d)
    d = GG(d, a, b, c, x[k + 10], S22, 0x02441453)
    c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681)
    b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8)
    a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6)
    d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6)
    c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87)
    b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed)
    a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905)
    d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8)
    c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9)
    b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a)
    a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942)
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681)
    c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122)
    b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c)
    a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44)
    d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9)
    c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60)
    b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70)
    a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6)
    d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa)
    c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085)
    b = HH(b, c, d, a, x[k + 6], S34, 0x04881d05)
    a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039)
    d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5)
    c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8)
    b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665)
    a = II(a, b, c, d, x[k + 0], S41, 0xf4292244)
    d = II(d, a, b, c, x[k + 7], S42, 0x432aff97)
    c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7)
    b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039)
    a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3)
    d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92)
    c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d)
    b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1)
    a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f)
    d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0)
    c = II(c, d, a, b, x[k + 6], S43, 0xa3014314)
    b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1)
    a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82)
    d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235)
    c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb)
    b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391)
    a = addUnsigned(a, AA)
    b = addUnsigned(b, BB)
    c = addUnsigned(c, CC)
    d = addUnsigned(d, DD)
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase()
}

function tlv(tag, value) {
  const str = String(value)
  return `${tag}${String(str.length).padStart(2, "0")}${str}`
}

// Builds valid Bakong KHQR for reaksmey_rin@bkrt (Reaksmey Rin)
function buildReaksmeyKhqr({ currency = "KHR", totalUSD = 0, totalKHR = 0, orderId }) {
  if (currency === "STATIC") {
    return {
      qr: REAKSMEY_STATIC_KHQR,
      md5: md5Hex(REAKSMEY_STATIC_KHQR),
      amount: totalKHR,
      currency: "KHR",
    }
  }

  const isKhr = currency === "KHR"
  const amountVal = isKhr ? Math.max(100, Math.round(totalKHR)) : Number(totalUSD.toFixed(2))
  const amountStr = isKhr ? String(amountVal) : amountVal.toFixed(2)

  const nowMs = String(Date.now())
  const expMs = String(Date.now() + 10 * 60 * 1000)

  // Tag 15 (UPI account routing from your QR) is supported on KHR (116)
  const upiTag = isKhr ? "15311974011600520446BONG10002312081" : ""
  const accountTag = tlv("29", tlv("00", "reaksmey_rin@bkrt"))
  const currencyTag = tlv("53", isKhr ? "116" : "840")
  const amountTag = tlv("54", amountStr)
  const billTag = orderId ? tlv("62", tlv("01", `ORD-${orderId}`)) : ""
  const timestampTag = tlv("99", tlv("00", nowMs) + tlv("01", expMs))

  const payloadWithoutCrc =
    "000201" +
    "010212" +
    upiTag +
    accountTag +
    "52045999" +
    currencyTag +
    amountTag +
    "5802KH" +
    tlv("59", "Reaksmey Rin") +
    tlv("60", "Phnom Penh") +
    billTag +
    timestampTag +
    "6304"

  const qr = payloadWithoutCrc + crc16ccitt(payloadWithoutCrc)
  return {
    qr,
    md5: md5Hex(qr),
    amount: amountVal,
    currency: isKhr ? "KHR" : "USD",
  }
}

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
  const [khqrPaid, setKhqrPaid] = useState(false)
  const [khqrError, setKhqrError] = useState(null)
  const [khqrConfirming, setKhqrConfirming] = useState(false)
  const [khqrCountdown, setKhqrCountdown] = useState(600)

  const khqrPollRef = useRef(null)
  const khqrDelayRef = useRef(null)
  const khqrCountdownRef = useRef(null)
  const handledPaidRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const onPaidRef = useRef(onPaid)

  useEffect(() => {
    onCloseRef.current = onClose
    onPaidRef.current = onPaid
  }, [onClose, onPaid])

  const stopKhqrPolling = useCallback(() => {
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
    handledPaidRef.current = false
    setPayMethodId(paymentMethods.find(m => !/khqr|aba|bakong/i.test(m.method_name))?.method_id || paymentMethods[0]?.method_id || null)
    setErrorMsg("")
    setCashGiven("")
    setCashCur("USD")
    setPayMode("normal")
    setKhqrData(null)
    setKhqrPaid(false)
    setKhqrError(null)
  }, [order?.order_id])

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
  const itemCount = order.order_items?.reduce((s, oi) => s + oi.quantity, 0) || 0

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

  const startKhqrSession = (curMode = khqrCurrency) => {
    stopKhqrPolling()
    setKhqrError(null)
    setKhqrPaid(false)
    handledPaidRef.current = false
    setKhqrCountdown(600)

    const generated = buildReaksmeyKhqr({
      currency: curMode,
      totalUSD: total,
      totalKHR,
      orderId: order.order_id,
    })
    setKhqrData(generated)

    let attempts = 0
    const MAX_AUTO_CHECKS = 15

    const pollCheck = async () => {
      if (handledPaidRef.current || document.hidden) return
      attempts += 1
      if (attempts > MAX_AUTO_CHECKS) {
        if (khqrPollRef.current) clearInterval(khqrPollRef.current)
        khqrPollRef.current = null
        return
      }
      try {
        const check = await api.get(
          `/payments/khqr/check/${generated.md5}?order_id=${order.order_id}&currency=${generated.currency}`
        )
        if (check.data?.paid) {
          finishKhqrPayment()
        }
      } catch {
        // Ignore network/rate-limit errors during background check; manual confirm button is always available
      }
    }

    khqrDelayRef.current = setTimeout(() => {
      pollCheck()
      khqrPollRef.current = setInterval(pollCheck, 8000)
    }, 10000)

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
          {/* Always show Cash/Card vs KHQR tabs */}
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

                  {khqrData && (
                    <div className="text-center space-y-2">
                      <div className="mx-auto max-w-[240px] bg-white rounded-2xl border-2 border-[#e11d48] overflow-hidden shadow-md">
                        <div className="bg-[#e11d48] text-white py-2 px-3 font-black text-sm tracking-widest">
                          KHQR
                        </div>
                        <div className="px-4 pt-2.5 pb-1 text-left border-b border-dashed border-slate-200">
                          <div className="text-[11px] font-bold text-slate-600 uppercase">Reaksmey Rin</div>
                          <div className="text-base font-black text-slate-900">
                            {khqrCurrency === "STATIC"
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

                      <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--color-muted)] pt-1">
                        <Loader2 size={12} className="animate-spin" /> {t("pay.waiting")} {Math.floor(khqrCountdown / 60)}:{String(khqrCountdown % 60).padStart(2, "0")}
                      </div>
                    </div>
                  )}

                  {khqrError && (
                    <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2 text-center">
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