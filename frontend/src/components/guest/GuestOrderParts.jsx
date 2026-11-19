import { useEffect } from "react"
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Check,
  ArrowLeft,
  AlertTriangle,
  ClipboardList,
  MapPin,
  LocateFixed,
  Loader2,
  Users,
  Leaf,
  X,
  ChevronRight,
} from "lucide-react"
import { cn, menuItemName, categoryDisplayName } from "@/lib/utils"
import { formatUSD, formatKHR } from "@/lib/currency"
import { useLang } from "@/i18n/LanguageContext"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import { MenuItemImage } from "@/components/admin/MenuParts"
import { ItemNoteRow } from "@/components/shared"

export function InvalidTable({ navigate, message }) {
  const { t } = useLang()
  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-[var(--color-background)] p-6 text-center">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 max-w-md w-full shadow-sm flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center mb-4">
          <AlertTriangle size={26} className="text-[var(--color-warning)]" />
        </div>
        <h2 className="font-display font-bold text-xl text-[var(--color-text)] mb-2">
          {t("guest.somethingWrong")}
        </h2>
        <p className="text-sm text-[var(--color-muted)] max-w-xs leading-relaxed mb-6">
          {message}
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft size={15} /> {t("guest.backToScan")}
        </button>
      </div>
    </div>
  )
}

export function LocationGate({ status, errorCode, onRetry, navigate }) {
  const { t } = useLang()

  if (status === "checking") {
    return (
      <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-[var(--color-background)] p-6 text-center">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 max-w-md w-full shadow-sm flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-muted)] flex items-center justify-center mb-4">
            <LocateFixed size={26} className="text-[var(--color-primary)] animate-pulse" />
          </div>
          <h2 className="font-display font-bold text-xl text-[var(--color-text)] mb-2">
            {t("guest.locationChecking")}
          </h2>
          <p className="text-sm text-[var(--color-muted)] max-w-xs leading-relaxed">
            {t("guest.locationCheckingSub")}
          </p>
          <Loader2 size={18} className="text-[var(--color-primary)] animate-spin mt-5" />
        </div>
      </div>
    )
  }

  const reasonKey =
    errorCode === "DESKTOP"
      ? "guest.desktopBlocked"
      : errorCode === "DENIED"
        ? "guest.locationDenied"
        : errorCode === "UNSUPPORTED"
          ? "guest.locationUnsupported"
          : "guest.locationUnavailable"

  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-[var(--color-background)] p-6 text-center">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 max-w-md w-full shadow-sm flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center mb-4">
          <MapPin size={26} className="text-[var(--color-warning)]" />
        </div>
        <h2 className="font-display font-bold text-xl text-[var(--color-text)] mb-2">
          {t("guest.locationRequired")}
        </h2>
        <p className="text-sm text-[var(--color-muted)] max-w-xs leading-relaxed mb-6">
          {t(reasonKey)}
        </p>
        <div className="flex gap-2.5 flex-wrap justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <LocateFixed size={15} /> {t("guest.locationRetry")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} /> {t("guest.backToScan")}
          </button>
        </div>
      </div>
    </div>
  )
}

export function GuestHeader({ table, token, navigate }) {
  const { t } = useLang()

  return (
    <header className="sticky top-0 z-20 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)]/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center shadow-xs shrink-0">
            <Leaf size={17} className="rotate-12" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-lg text-[var(--color-text)] leading-none tracking-wide">
              ZOOM
            </div>
            <div className="hidden sm:block text-[11px] text-[var(--color-muted)] mt-0.5 truncate">
              Garden Café &amp; Wine
            </div>
          </div>
        </div>

        {/* Actions + Table Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher langs={["en", "km"]} />

          <button
            type="button"
            onClick={() => navigate(`/order/status?t=${encodeURIComponent(token)}`)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--color-primary)] bg-[var(--color-primary-muted)] hover:bg-[var(--color-primary)] hover:text-white px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <ClipboardList size={15} />
            <span className="hidden xs:inline sm:inline">{t("guest.trackOrder")}</span>
          </button>

          <div className="flex flex-col items-end pl-2.5 border-l border-[var(--color-border)]">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] leading-none">
              {t("guest.yourTable")}
            </span>
            <span className="font-bold text-sm text-[var(--color-text)] mt-0.5 leading-none">
              {table?.table_number || "..."}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

export function OrderStatusBanner({ liveOrderStatus, queueNumber, token, navigate }) {
  const { t } = useLang()
  if (!liveOrderStatus) return null

  const styleMap = {
    Paid: "bg-[var(--color-primary-muted)] text-[var(--color-primary)] border-b border-[var(--color-primary)]/15",
    Served: "bg-[var(--color-primary)] text-white",
    Preparing: "bg-[var(--color-accent-muted)] text-[var(--color-warning)] border-b border-[var(--color-warning)]/20",
    Pending: "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]",
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/order/status?t=${encodeURIComponent(token)}`)}
      className={cn(
        "w-full px-4 py-2.5 text-xs sm:text-sm font-semibold transition-opacity hover:opacity-95 cursor-pointer",
        styleMap[liveOrderStatus] || styleMap.Pending
      )}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-2">
        {queueNumber != null && (
          <span className="px-2 py-0.5 rounded-full bg-black/10 text-[11px] font-bold">
            #{queueNumber}
          </span>
        )}
        <span>
          {liveOrderStatus === "Pending" && t("guest.bannerReceived")}
          {liveOrderStatus === "Preparing" && t("guest.bannerPreparing")}
          {liveOrderStatus === "Served" && t("guest.bannerServed")}
          {liveOrderStatus === "Paid" && t("guest.bannerPaid")}
        </span>
        <ChevronRight size={14} className="shrink-0 opacity-75" />
      </div>
    </button>
  )
}

export function GuestMenuControls({ search, setSearch, categories, activeCat, setActiveCat }) {
  const { t, lang } = useLang()

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("guest.searchMenu")}
          className="w-full h-11 pl-10 pr-9 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/75 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)] shadow-2xs transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)] cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Horizontal Scrollable Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setActiveCat("All")}
          className={cn(
            "shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border transition-all cursor-pointer",
            activeCat === "All"
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs"
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
                "shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border transition-all cursor-pointer",
                active
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
              )}
            >
              {categoryDisplayName(cat, lang)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function GuestMenuGrid({ items, loading, cart, onAdd, onRemove }) {
  const { t, lang } = useLang()

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {Array.from({ length: 10 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden animate-pulse"
          >
            <div className="aspect-square bg-[var(--color-surface-subtle)]" />
            <div className="p-3.5 space-y-2">
              <div className="h-3.5 bg-[var(--color-surface-subtle)] rounded w-3/4" />
              <div className="h-4 bg-[var(--color-surface-subtle)] rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-center py-16 px-4 text-[var(--color-muted)] text-sm">
        {t("guest.noItems")}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
      {items.map((item) => {
        const qty = cart[item.menu_item_id]?.qty || 0
        const isSelected = qty > 0
        const isAvailable = item.available !== false

        return (
          <div
            key={item.menu_item_id}
            className={cn(
              "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-2xs hover:shadow-md hover:border-[var(--color-border-strong)] transition-all duration-200 group flex flex-col justify-between relative",
              isSelected && "ring-2 ring-[var(--color-primary)] border-transparent shadow-sm",
              !isAvailable && "opacity-60"
            )}
          >
            {/* Square Dish Photo */}
            <div className="relative aspect-square overflow-hidden bg-[var(--color-surface-subtle)] shrink-0">
              <MenuItemImage item={item} lang={lang} />

              {!isAvailable && (
                <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
                  <span className="bg-[var(--color-danger)] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {t("common.soldOut")}
                  </span>
                </div>
              )}

              {isSelected && (
                <div className="absolute top-2.5 right-2.5 bg-[var(--color-primary)] text-white text-xs font-bold min-w-[26px] h-[26px] px-1.5 rounded-full flex items-center justify-center shadow-md">
                  {qty}
                </div>
              )}
            </div>

            {/* Dish Info + Stepper */}
            <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between gap-2.5">
              <div className="font-semibold text-[var(--color-text)] text-xs sm:text-sm leading-snug line-clamp-2">
                {menuItemName(item, lang)}
              </div>

              <div className="flex items-end justify-between gap-1 pt-2 border-t border-[var(--color-border)]/60">
                <div className="leading-tight">
                  <div className="text-sm sm:text-base font-bold text-[var(--color-primary)] tabular-nums">
                    {formatUSD(item.price)}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)] tabular-nums">
                    {formatKHR(item.price)}
                  </div>
                </div>

                {!isAvailable ? (
                  <span className="text-[11px] text-[var(--color-danger)] font-medium">
                    {t("common.soldOut")}
                  </span>
                ) : qty === 0 ? (
                  <button
                    type="button"
                    onClick={() => onAdd(item.menu_item_id)}
                    aria-label={`Add ${menuItemName(item, lang)}`}
                    className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] hover:bg-[var(--color-primary)] hover:text-white active:scale-95 text-[var(--color-primary)] flex items-center justify-center transition-all cursor-pointer shrink-0"
                  >
                    <Plus size={16} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-[var(--color-surface-subtle)] rounded-xl p-0.5 border border-[var(--color-border)] shrink-0">
                    <button
                      type="button"
                      onClick={() => onRemove(item.menu_item_id)}
                      aria-label={`Remove ${menuItemName(item, lang)}`}
                      className="w-7 h-7 rounded-lg bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold min-w-[18px] text-center text-[var(--color-text)] tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAdd(item.menu_item_id)}
                      aria-label={`Add more ${menuItemName(item, lang)}`}
                      className="w-7 h-7 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function CartBar({ total, cartCount, onOrder }) {
  const { t } = useLang()
  if (cartCount <= 0) return null

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-30 px-4 pointer-events-none">
      <div className="bg-[var(--color-banner-bg)] text-[var(--color-banner-text)] rounded-2xl shadow-2xl flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 max-w-lg mx-auto pointer-events-auto border border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] text-white font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
            {cartCount}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm sm:text-base tabular-nums truncate">
              {formatUSD(total)}
              <span className="text-emerald-300 font-semibold ml-1.5 text-xs">
                {formatKHR(total)}
              </span>
            </div>
            <div className="text-[11px] text-white/65">
              {cartCount} {t("guest.itemsSelected")}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOrder}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] active:scale-95 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shrink-0"
        >
          <ShoppingCart size={15} />
          <span>{t("guest.order")}</span>
        </button>
      </div>
    </div>
  )
}

export function ConfirmOrderDialog({
  open,
  table,
  cartItems,
  onItemNoteChange,
  onIncrease,
  onDecrease,
  total,
  errorMsg,
  submitting,
  submitted,
  queueNumber,
  partySize,
  onPartySizeChange,
  note,
  onNoteChange,
  onCancel,
  onConfirm,
  onTrackOrder,
}) {
  const { t, lang } = useLang()

  // Lock background scrolling and allow Escape to close when not submitting
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e) => {
      if (e.key === "Escape" && !submitting) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, submitting, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] sm:p-4"
      onClick={() => !submitting && onCancel()}
    >
      <div
        className="bg-[var(--color-surface)] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md border border-[var(--color-border)] max-h-[90dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border-strong)]" />
        </div>

        {submitted ? (
          /* Clean Order Placed Confirmation Screen */
          <div className="p-6 sm:p-7 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-muted)] text-[var(--color-primary)] flex items-center justify-center mx-auto">
              <Check size={32} />
            </div>

            <div className="space-y-1">
              <h2 className="font-display text-2xl font-bold text-[var(--color-text)]">
                {t("guest.orderPlaced")}
              </h2>
              <p className="text-xs text-[var(--color-muted)]">
                {t("guest.table")} {table?.table_number}
              </p>
            </div>

            {queueNumber != null && (
              <div className="bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20 rounded-2xl px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  {t("guest.waitingNumber")}
                </div>
                <div className="font-display text-4xl font-bold text-[var(--color-primary)] mt-1 tabular-nums">
                  #{queueNumber}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] text-sm font-semibold text-[var(--color-text-secondary)] transition-colors cursor-pointer"
              >
                {lang === "km" ? "កុម្ម៉ង់បន្ថែម" : "Order More"}
              </button>
              <button
                type="button"
                onClick={onTrackOrder}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ClipboardList size={15} />
                <span>{t("guest.trackMyOrder")}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-4 pb-3.5 border-b border-[var(--color-border)] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center shrink-0">
                  <ShoppingCart size={16} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <div className="font-semibold text-base text-[var(--color-text)] leading-tight">
                    {t("guest.confirmTitle")}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    {t("guest.table")} {table?.table_number}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                aria-label="Close"
                className="p-1.5 rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)] cursor-pointer disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Guests + Order Note */}
              <div className="flex gap-2">
                <div className="w-28 relative shrink-0">
                  <Users
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                  />
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={partySize}
                    onChange={(e) => onPartySizeChange(e.target.value)}
                    placeholder={t("guest.guests")}
                    className="w-full h-10 pl-8 pr-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/60 text-sm text-[var(--color-text)] outline-none focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                  />
                </div>
                <input
                  value={note}
                  onChange={(e) => onNoteChange(e.target.value)}
                  placeholder={t("guest.orderNotePlaceholder")}
                  className="flex-1 h-10 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/60 text-sm text-[var(--color-text)] outline-none focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                {t("guest.itemsLabel")}
              </div>

              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.menu_item_id}
                    className="pb-3 border-b border-[var(--color-border)]/70 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--color-surface-subtle)] border border-[var(--color-border)]/60 shrink-0">
                        <MenuItemImage item={item} lang={lang} iconSize={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-text)] truncate">
                          {menuItemName(item, lang)}
                        </div>
                        <div className="text-xs text-[var(--color-muted)] tabular-nums">
                          {formatUSD(item.price)} × {item.qty} ={" "}
                          <span className="font-semibold text-[var(--color-text-secondary)]">
                            {formatUSD(Number(item.price) * item.qty)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onDecrease(item.menu_item_id)}
                          disabled={submitting}
                          aria-label="Decrease quantity"
                          className="w-7 h-7 rounded-lg bg-[var(--color-danger-muted)] hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-danger)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold w-5 text-center text-[var(--color-text)] tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onIncrease(item.menu_item_id)}
                          disabled={submitting}
                          aria-label="Increase quantity"
                          className="w-7 h-7 rounded-lg bg-[var(--color-primary-muted)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 pl-15">
                      <ItemNoteRow
                        note={item.note}
                        onChange={(v) => onItemNoteChange(item.menu_item_id, v)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="text-xs font-medium text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3.5 py-2.5"
                >
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] space-y-3 shrink-0">
              <div className="bg-[var(--color-banner-bg)] text-[var(--color-banner-text)] rounded-xl flex items-center justify-between px-4 py-3">
                <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                  {t("common.total")}
                </span>
                <div className="text-right tabular-nums">
                  <span className="text-base font-bold">{formatUSD(total)}</span>
                  <span className="text-emerald-300 text-xs font-semibold ml-2">
                    {formatKHR(total)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] text-sm font-semibold text-[var(--color-text-secondary)] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={submitting || cartItems.length === 0}
                  className={cn(
                    "flex-[1.5] font-semibold text-sm px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white shadow-xs",
                    (submitting || cartItems.length === 0) && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  <span>{submitting ? t("guest.submitting") : t("guest.confirmOrder")}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
