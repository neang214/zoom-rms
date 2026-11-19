import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Search, ShoppingCart, X } from "lucide-react"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import { useTableStore } from "../../context/tableContext"
import { useOrderStore } from "../../context/orderContext"
import { useOrderItemStore } from "../../context/orderItemContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"
import { usePageTitle } from "../../hooks/usePageTitle"
import CashierMenuGrid from "@/components/cashier/CashierMenuGrid"
import CartBar from "@/components/cashier/CartBar"
import SubmitOrderDialog, { OrderTicketPanel } from "@/components/cashier/SubmitOrderDialog"
import { ConfirmModal } from "@/components/shared"
import { formatUSD } from "@/lib/currency"
import { useLang } from "@/i18n/LanguageContext"
import { cn, menuItemMatchesSearch, categoryDisplayName } from "@/lib/utils"

export default function CashierMenu() {
  usePageTitle("POS Menu")
  const { t, lang } = useLang()
  const { items, fetchItems, isLoading: itemsLoading } = useMenuItemStore()
  const { categories, fetchCategories } = useMenuCategoryStore()
  const { tables, fetchTables } = useTableStore()
  const { createOrder, getActiveOrderByTable, updateOrderDetails } = useOrderStore()
  const { addItem } = useOrderItemStore()

  const [activeCat, setActiveCat] = useState("All")
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [tableId, setTableId] = useState("")
  const [partySize, setPartySize] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [existingTableOrder, setExistingTableOrder] = useState(null)

  const submittingRef = useRef(false)
  const resetTimerRef = useRef(null)

  useSocketRole("cashier")

  const safeFetchTables = useCallback(() => {
    fetchTables().catch(() => {})
  }, [fetchTables])

  useSocketEvent("table:updated", safeFetchTables)
  useSocketEvent("order:new", safeFetchTables)
  useSocketEvent("order:deleted", safeFetchTables)
  useSocketEvent("payment:completed", safeFetchTables)

  useEffect(() => {
    fetchItems().catch(() => {})
    fetchCategories().catch(() => {})
    fetchTables().catch(() => {})
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [fetchItems, fetchCategories, fetchTables])

  // Check if selected table already has an active unpaid order
  useEffect(() => {
    if (!tableId) {
      setExistingTableOrder(null)
      return
    }
    let cancelled = false
    getActiveOrderByTable(parseInt(tableId, 10))
      .then((ord) => {
        if (!cancelled) setExistingTableOrder(ord || null)
      })
      .catch(() => {
        if (!cancelled) setExistingTableOrder(null)
      })
    return () => {
      cancelled = true
    }
  }, [tableId, tables, getActiveOrderByTable])

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
    () => cartItems.reduce((s, i) => s + Number(i.price || 0) * i.qty, 0),
    [cartItems]
  )
  const cartCount = useMemo(() => cartItems.reduce((s, i) => s + i.qty, 0), [cartItems])

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
    if (submittingRef.current || submitting || submitted) return
    if (!tableId) {
      setErrorMsg(t("cashier.selectTablePrompt"))
      return
    }
    if (cartItems.length === 0) return

    submittingRef.current = true
    setSubmitting(true)
    setErrorMsg("")

    const parsedParty = partySize ? parseInt(partySize, 10) : undefined
    const validParty = parsedParty && parsedParty > 0 ? parsedParty : undefined
    const cleanNote = note.trim() || undefined

    try {
      let orderId
      const existing = await getActiveOrderByTable(parseInt(tableId, 10))

      if (existing) {
        orderId = existing.order_id
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
            table_id: parseInt(tableId, 10),
            party_size: validParty,
            note: cleanNote,
          })
          orderId = order.order_id
        } catch (createErr) {
          const fallbackId = createErr?.response?.data?.order_id
          if (fallbackId) {
            orderId = fallbackId
          } else {
            throw createErr
          }
        }
      }

      const results = await Promise.allSettled(
        cartItems.map((item) =>
          addItem({
            order_id: orderId,
            menu_item_id: item.menu_item_id,
            quantity: item.qty,
            note: item.note?.trim() || undefined,
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

      setSubmitted(true)
      setSubmitting(false)
      fetchTables().catch(() => {})

      resetTimerRef.current = setTimeout(() => {
        submittingRef.current = false
        setSubmitted(false)
        setCart({})
        setTableId("")
        setPartySize("")
        setNote("")
        setExistingTableOrder(null)
        setConfirmOpen(false)
      }, 900)
    } catch (err) {
      submittingRef.current = false
      setSubmitting(false)
      setErrorMsg(err?.response?.data?.message || t("cashier.submitFailed"))
    }
  }

  const requestConfirm = () => {
    if (submittingRef.current || submitting || submitted) return
    if (!tableId) {
      setErrorMsg(t("cashier.selectTablePrompt"))
      return
    }
    if (cartItems.length === 0) return

    // Ask cashier to confirm before updating an existing active order
    if (existingTableOrder) {
      setConfirmOpen(false)
      setUpdateConfirmOpen(true)
      return
    }
    handleConfirm()
  }

  const ticketProps = {
    tables,
    tableId,
    onTableChange: (v) => {
      setTableId(v)
      setErrorMsg("")
    },
    existingOrder: existingTableOrder,
    partySize,
    onPartySizeChange: setPartySize,
    note,
    onNoteChange: setNote,
    cartItems,
    onItemNoteChange: setItemNote,
    onIncrease: addToCart,
    onDecrease: removeFromCart,
    onClearCart: () => setCart({}),
    total,
    errorMsg,
    submitting,
    submitted,
    onConfirm: requestConfirm,
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start pb-24 lg:pb-0">
      {/* Left: Search, Category Pills & Menu Grid */}
      <div className="space-y-4 min-w-0">
        <div className="relative max-w-md">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("menu.searchPlaceholder")}
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/75 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)] transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* One-Tap Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setActiveCat("All")}
            className={cn(
              "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
              activeCat === "All"
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-2xs"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
            )}
          >
            {t("common.all")}
          </button>
          {(categories || []).map((cat) => {
            const active = activeCat === cat.category_id
            return (
              <button
                key={cat.category_id}
                type="button"
                onClick={() => setActiveCat(active ? "All" : cat.category_id)}
                className={cn(
                  "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                  active
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-2xs"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                )}
              >
                {categoryDisplayName(cat, lang)}
              </button>
            )
          })}
        </div>

        <CashierMenuGrid
          items={filtered}
          loading={itemsLoading && items.length === 0}
          cart={cart}
          onAdd={addToCart}
          onRemove={removeFromCart}
        />
      </div>

      {/* Right: Sticky Live POS Ticket Sidebar (Desktop & Landscape Tablets) */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-[calc(100dvh-6.5rem)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] text-[var(--color-primary)] flex items-center justify-center">
              <ShoppingCart size={15} />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--color-text)] leading-none">
                {lang === "km" ? "វិក្កយបត្រកុម្ម៉ង់" : "Current Ticket"}
              </div>
              <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                {cartCount} {t("cashier.itemsSelected")}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <OrderTicketPanel {...ticketProps} />
        </div>
      </aside>

      {/* Mobile / Portrait Tablet Floating Bar + Modal */}
      <CartBar
        total={total}
        count={cartCount}
        onPlaceOrder={() => {
          fetchTables().catch(() => {})
          setErrorMsg("")
          setConfirmOpen(true)
        }}
      />

      <SubmitOrderDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!v && (submitting || submitted || submittingRef.current)) return
          setConfirmOpen(v)
        }}
        {...ticketProps}
      />

      <ConfirmModal
        open={updateConfirmOpen}
        onClose={() => !submitting && setUpdateConfirmOpen(false)}
        onConfirm={async () => {
          setUpdateConfirmOpen(false)
          await handleConfirm()
        }}
        busy={submitting}
        title={
          lang === "km"
            ? `បញ្ជាក់ការបន្ថែមលើការកុម្ម៉ង់ ${existingTableOrder ? `#${String(existingTableOrder.order_id).padStart(4, "0")}` : ""}?`
            : `Update Existing Order ${existingTableOrder ? `#${String(existingTableOrder.order_id).padStart(4, "0")}` : ""}?`
        }
        message={
          lang === "km"
            ? `បន្ថែម ${cartCount} មុខ (${formatUSD(total)}) ចូលទៅការកុម្ម៉ង់សកម្ម ${existingTableOrder ? `#${String(existingTableOrder.order_id).padStart(4, "0")}` : ""} នៅតុ ${tables.find((tb) => String(tb.table_id) === String(tableId))?.table_number || "—"}?`
            : `Add ${cartCount} item${cartCount === 1 ? "" : "s"} (${formatUSD(total)}) to active Order ${existingTableOrder ? `#${String(existingTableOrder.order_id).padStart(4, "0")}` : ""} at Table ${tables.find((tb) => String(tb.table_id) === String(tableId))?.table_number || "—"}?`
        }
        confirmLabel={lang === "km" ? "បញ្ជាក់ការកែប្រែ" : "Confirm Update"}
        cancelLabel={t("common.cancel")}
        errorMsg={errorMsg}
      />
    </div>
  )
}
