import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import { useTableStore } from "../../context/tableContext"
import { useOrderStore } from "../../context/orderContext"
import { useOrderItemStore } from "../../context/orderItemContext"
import { useSocketTable, useSocketEvent } from "../../services/socket"
import { usePageTitle } from "../../hooks/usePageTitle"
import { useGuestOrderSound } from "../../hooks/useGuestOrderSound"
import {
  InvalidTable,
  LocationGate,
  GuestHeader,
  OrderStatusBanner,
  GuestMenuControls,
  GuestMenuGrid,
  CartBar,
  ConfirmOrderDialog,
} from "@/components/guest/GuestOrderParts"
import { useLang } from "@/i18n/LanguageContext"
import { getCurrentPosition, isMobileDevice } from "@/lib/geolocation"
import { menuItemMatchesSearch } from "@/lib/utils"

function readSavedCart(token) {
  if (!token) return {}
  try {
    const raw = sessionStorage.getItem(`zoom_guest_cart_${token}`)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export default function GuestOrder() {
  usePageTitle("Menu")
  const { t } = useLang()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("t")

  const { items, fetchItems, isLoading: itemsLoading } = useMenuItemStore()
  const { categories, fetchCategories } = useMenuCategoryStore()
  const { getTableByToken } = useTableStore()
  const { createOrder, getActiveOrderBySession, updateOrderDetails } = useOrderStore()
  const { addItem } = useOrderItemStore()

  const [activeCat, setActiveCat] = useState("All")
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState(() => readSavedCart(token))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [queueNumber, setQueueNumber] = useState(null)
  const [partySize, setPartySize] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const submittingRef = useRef(false)

  const [table, setTable] = useState(null)
  const [loadingTable, setLoadingTable] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [liveOrder, setLiveOrder] = useState(null)

  const [geoStatus, setGeoStatus] = useState("checking")
  const [geoError, setGeoError] = useState(null)
  const [coords, setCoords] = useState(null)

  const checkLocation = useCallback(() => {
    setGeoStatus("checking")
    setGeoError(null)

    const isDevOrBypass =
      import.meta.env.DEV || import.meta.env.VITE_ENFORCE_MOBILE_QR === "false"
    if (!isMobileDevice() && !isDevOrBypass) {
      setGeoError("DESKTOP")
      setGeoStatus("blocked")
      return
    }

    getCurrentPosition()
      .then(({ latitude, longitude }) => {
        setCoords({ latitude, longitude })
        setGeoStatus("ok")
      })
      .catch((err) => {
        setGeoError(err.code)
        setGeoStatus("blocked")
      })
  }, [])

  // Persist cart in sessionStorage per table token
  useEffect(() => {
    setCart(readSavedCart(token))
  }, [token])

  useEffect(() => {
    if (!token) return
    try {
      if (Object.keys(cart).length === 0) {
        sessionStorage.removeItem(`zoom_guest_cart_${token}`)
      } else {
        sessionStorage.setItem(`zoom_guest_cart_${token}`, JSON.stringify(cart))
      }
    } catch {}
  }, [cart, token])

  useSocketTable(table?.table_id)
  useGuestOrderSound()

  const syncSessionOrder = useCallback(async () => {
    try {
      const existing = await getActiveOrderBySession()
      setLiveOrder(existing || null)
    } catch {}
  }, [getActiveOrderBySession])

  useSocketEvent("order:status_changed", (data) => {
    if (!data?.status) return
    setLiveOrder((prev) => {
      if (!prev) return prev
      if (data.order_id && prev.order_id !== data.order_id) return prev
      return { ...prev, status: data.status }
    })
  })
  useSocketEvent("order:new", () => syncSessionOrder())
  useSocketEvent("order:deleted", (data) => {
    setLiveOrder((prev) => {
      if (!prev) return null
      if (data?.order_id && prev.order_id !== data.order_id) return prev
      return null
    })
  })

  useEffect(() => {
    let cancelled = false
    fetchItems().catch(() => {})
    fetchCategories().catch(() => {})

    setTable(null)
    setTableError(false)
    setLiveOrder(null)
    setGeoStatus("checking")
    setGeoError(null)

    if (!token) {
      setLoadingTable(false)
      return
    }

    setLoadingTable(true)
    getTableByToken(token)
      .then(async (tbl) => {
        if (cancelled) return
        setTable(tbl)
        localStorage.setItem("zoom_last_table_token", token)
        try {
          const existing = await getActiveOrderBySession()
          if (!cancelled && existing) setLiveOrder(existing)
        } catch {}
      })
      .catch(() => {
        if (!cancelled) setTableError(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingTable(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, fetchItems, fetchCategories, getTableByToken, getActiveOrderBySession])

  useEffect(() => {
    if (table) checkLocation()
  }, [table, checkLocation])

  const availableItems = useMemo(() => (items || []).filter((i) => i.available), [items])

  const filtered = useMemo(
    () =>
      availableItems.filter((i) => {
        const matchesCat = activeCat === "All" || i.category_id === activeCat
        const catName = categories.find((c) => c.category_id === i.category_id)?.category_name
        return matchesCat && menuItemMatchesSearch(i, search, catName)
      }),
    [availableItems, activeCat, categories, search]
  )

  const itemMap = useMemo(() => {
    const map = new Map()
    for (const i of items || []) map.set(i.menu_item_id, i)
    return map
  }, [items])

  // Safely ignore deleted/missing items so totals never produce NaN
  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, entry]) => {
          const menuItem = itemMap.get(Number(id))
          if (!menuItem || !entry?.qty) return null
          return { ...menuItem, qty: entry.qty, note: entry.note || "" }
        })
        .filter(Boolean),
    [cart, itemMap]
  )

  const total = useMemo(
    () => cartItems.reduce((sum, i) => sum + Number(i.price || 0) * i.qty, 0),
    [cartItems]
  )
  const cartCount = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.qty, 0),
    [cartItems]
  )

  if (!token) {
    return <InvalidTable navigate={navigate} message={t("guest.noTable")} />
  }
  if (!loadingTable && (tableError || !table)) {
    return <InvalidTable navigate={navigate} message={t("guest.tableNotFound")} />
  }
  if (table && geoStatus !== "ok") {
    return (
      <LocationGate
        status={geoStatus}
        errorCode={geoError}
        onRetry={checkLocation}
        navigate={navigate}
      />
    )
  }

  const addToCart = (id) =>
    setCart((c) => ({
      ...c,
      [id]: { qty: (c[id]?.qty || 0) + 1, note: c[id]?.note || "" },
    }))

  const removeFromCart = (id) =>
    setCart((c) => {
      const next = { ...c }
      if ((next[id]?.qty || 0) <= 1) delete next[id]
      else next[id] = { ...next[id], qty: next[id].qty - 1 }
      return next
    })

  const setItemNote = (id, itemNote) =>
    setCart((c) => (c[id] ? { ...c, [id]: { ...c[id], note: itemNote } } : c))

  const handleConfirm = async () => {
    if (submittingRef.current || submitting || submitted || cartItems.length === 0) return
    submittingRef.current = true
    setSubmitting(true)
    setErrorMsg("")

    const parsedParty = partySize ? parseInt(partySize, 10) : undefined
    const validParty = parsedParty && parsedParty > 0 ? parsedParty : undefined
    const cleanNote = note.trim() || undefined

    try {
      let orderId
      let nextQueue = null
      const existing = await getActiveOrderBySession()

      if (existing) {
        orderId = existing.order_id
        nextQueue = existing.queue_number ?? null
        if (validParty || cleanNote) {
          try {
            await updateOrderDetails(orderId, {
              party_size: validParty,
              note: cleanNote,
            })
          } catch {}
        }
      } else {
        try {
          const order = await createOrder({
            table_id: table.table_id,
            channel: "guest",
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            party_size: validParty,
            note: cleanNote,
          })
          orderId = order.order_id
          nextQueue = order.queue_number ?? null
        } catch (createErr) {
          const fallbackId = createErr?.response?.data?.order_id
          if (fallbackId) {
            orderId = fallbackId
          } else {
            throw createErr
          }
        }
      }

      // Submit items with settled tracking so partial failures never duplicate on retry
      const results = await Promise.allSettled(
        cartItems.map((item) =>
          addItem({
            order_id: orderId,
            menu_item_id: item.menu_item_id,
            quantity: item.qty,
            note: item.note?.trim() || undefined,
            channel: "guest",
            latitude: coords?.latitude,
            longitude: coords?.longitude,
          })
        )
      )

      const succeededIds = new Set()
      let firstError = null
      results.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          succeededIds.add(cartItems[idx].menu_item_id)
        } else if (!firstError) {
          firstError = res.reason
        }
      })

      if (succeededIds.size > 0) {
        setCart((prev) => {
          const next = { ...prev }
          succeededIds.forEach((id) => delete next[id])
          return next
        })
      }

      if (firstError) {
        throw firstError
      }

      setQueueNumber(nextQueue)
      setSubmitted(true)
      setPartySize("")
      setNote("")
      await syncSessionOrder()
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || t("guest.submitError"))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleCloseConfirm = () => {
    if (submitting || submittingRef.current) return
    setConfirmOpen(false)
    if (submitted) {
      setSubmitted(false)
    }
  }

  const handleTrackOrder = () => {
    setConfirmOpen(false)
    setSubmitted(false)
    navigate(`/order/status?t=${encodeURIComponent(token)}`)
  }

  return (
    <div className="min-h-dvh w-full bg-[var(--color-background)] pb-28">
      <GuestHeader table={table} token={token} navigate={navigate} />

      <OrderStatusBanner
        liveOrderStatus={liveOrder?.status}
        queueNumber={liveOrder?.queue_number}
        token={token}
        navigate={navigate}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <GuestMenuControls
          search={search}
          setSearch={setSearch}
          categories={categories}
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          totalItems={filtered.length}
        />

        <GuestMenuGrid
          items={filtered}
          loading={itemsLoading && items.length === 0}
          cart={cart}
          onAdd={addToCart}
          onRemove={removeFromCart}
        />
      </main>

      <CartBar
        total={total}
        cartCount={cartCount}
        onOrder={() => {
          setSubmitted(false)
          setErrorMsg("")
          setConfirmOpen(true)
        }}
      />

      <ConfirmOrderDialog
        open={confirmOpen}
        table={table}
        cartItems={cartItems}
        onItemNoteChange={setItemNote}
        onIncrease={addToCart}
        onDecrease={removeFromCart}
        total={total}
        errorMsg={errorMsg}
        submitting={submitting}
        submitted={submitted}
        queueNumber={queueNumber}
        partySize={partySize}
        onPartySizeChange={setPartySize}
        note={note}
        onNoteChange={setNote}
        onCancel={handleCloseConfirm}
        onConfirm={handleConfirm}
        onTrackOrder={handleTrackOrder}
      />
    </div>
  )
}
