import { useState, useEffect, useRef } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import { useTableStore } from "../../context/tableContext"
import { useOrderStore } from "../../context/orderContext"
import { useOrderItemStore } from "../../context/orderItemContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"
import { usePageTitle } from "../../hooks/usePageTitle"
import { MenuCategoryBar } from "@/components/admin/MenuParts"
import CashierMenuGrid from "@/components/cashier/CashierMenuGrid"
import CartBar from "@/components/cashier/CartBar"
import SubmitOrderDialog from "@/components/cashier/SubmitOrderDialog"
import { useLang } from "@/i18n/LanguageContext"
import { menuItemMatchesSearch } from "@/lib/utils"

const KHR_RATE = 4100

export default function CashierMenu() {
  usePageTitle("Menu")
  const { t } = useLang()
  const { items, fetchItems } = useMenuItemStore()
  const { categories, fetchCategories } = useMenuCategoryStore()
  const { tables, fetchTables } = useTableStore()
  const { createOrder, getActiveOrderByTable } = useOrderStore()
  const { addItem } = useOrderItemStore()

  const [activeCat, setActiveCat] = useState("All")
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState({}) // { menu_item_id: qty }
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [tableId, setTableId] = useState("")
  const [partySize, setPartySize] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [existingTableOrder, setExistingTableOrder] = useState(null)
  const submittingRef = useRef(false)

  useSocketRole("cashier")
  useSocketEvent("table:updated", () => fetchTables().catch(() => {}))
  useSocketEvent("order:new", () => fetchTables().catch(() => {}))
  useSocketEvent("order:deleted", () => fetchTables().catch(() => {}))
  useSocketEvent("payment:completed", () => fetchTables().catch(() => {}))

  useEffect(() => {
    fetchItems()
    fetchCategories()
    fetchTables()
  }, [])

  useEffect(() => {
    if (!confirmOpen || !tableId) {
      setExistingTableOrder(null)
      return
    }
    let cancelled = false
    getActiveOrderByTable(parseInt(tableId))
      .then((ord) => {
        if (!cancelled) setExistingTableOrder(ord || null)
      })
      .catch(() => {
        if (!cancelled) setExistingTableOrder(null)
      })
    return () => { cancelled = true }
  }, [confirmOpen, tableId])

  const availableItems = items.filter(i => i.available)
  const filtered = availableItems.filter(i => {
    const matchesCat = activeCat === "All" || i.category_id === activeCat
    const catName = categories.find(c => c.category_id === i.category_id)?.category_name
    return matchesCat && menuItemMatchesSearch(i, search, catName)
  })

  
  
  
  const addToCart = (id) => setCart(c => ({ ...c, [id]: { qty: (c[id]?.qty || 0) + 1, note: c[id]?.note || "" } }))
  const removeFromCart = (id) => setCart(c => {
    const n = { ...c }
    if ((n[id]?.qty || 0) <= 1) delete n[id]
    else n[id] = { ...n[id], qty: n[id].qty - 1 }
    return n
  })
  const setItemNote = (id, note) => setCart(c => (
    c[id] ? { ...c, [id]: { ...c[id], note } } : c
  ))

  const cartItems = Object.entries(cart).map(([id, { qty, note }]) => ({
    ...items.find(i => i.menu_item_id === +id), qty, note
  }))
  const total = cartItems.reduce((s, i) => s + Number(i.price) * i.qty, 0)
  const totalKHR = Math.round(total * KHR_RATE)
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

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
    try {
      let orderId

      // check for an existing active order on this table
      const existing = await getActiveOrderByTable(parseInt(tableId))

      if (existing) {
        orderId = existing.order_id
      } else {
        try {
          // party_size / note only apply when an order is actually being
          // created — an existing order already had its own chance to
          // set these when it was first opened.
          const order = await createOrder({
            table_id: parseInt(tableId),
            party_size: partySize || undefined,
            note: note || undefined,
          })
          orderId = order.order_id
        } catch (createErr) {
          // race condition: table got an active order between our check and create
          const fallbackId = createErr?.response?.data?.order_id
          if (fallbackId) {
            orderId = fallbackId
          } else {
            throw createErr
          }
        }
      }

      // add all cart items to the order
      await Promise.all(
        cartItems.map((item) =>
          addItem({
            order_id: orderId,
            menu_item_id: item.menu_item_id,
            quantity: item.qty,
            note: item.note || undefined,
          })
        )
      )

      setSubmitted(true)
      setSubmitting(false)
      // refresh tables since availability may have changed
      fetchTables()
      setTimeout(() => {
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

  return (
    <div className="space-y-4">
      {}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" placeholder={t("common.search")} />
        </div>
        <MenuCategoryBar categories={categories} activeCat={activeCat} onSelect={setActiveCat} />
      </div>

      <CashierMenuGrid items={filtered} cart={cart} onAdd={addToCart} onRemove={removeFromCart} />

      <CartBar total={total} totalKHR={totalKHR} count={cartCount}
        onPlaceOrder={() => { fetchTables(); setConfirmOpen(true); setErrorMsg("") }} />

      <SubmitOrderDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!v && (submitting || submitted || submittingRef.current)) return
          setConfirmOpen(v)
        }}
        tables={tables}
        tableId={tableId}
        onTableChange={setTableId}
        existingOrder={existingTableOrder}
        partySize={partySize}
        onPartySizeChange={setPartySize}
        note={note}
        onNoteChange={setNote}
        cartItems={cartItems}
        onItemNoteChange={setItemNote}
        onIncrease={addToCart}
        onDecrease={removeFromCart}
        total={total}
        totalKHR={totalKHR}
        errorMsg={errorMsg}
        submitting={submitting}
        submitted={submitted}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
