import { Search, Plus, Minus, ShoppingCart, Check, ArrowLeft, AlertTriangle, ClipboardList, MapPin, LocateFixed, Loader2, Users } from "lucide-react"
import { cn, imageUrl, menuItemName } from "@/lib/utils"
import { useLang } from "@/i18n/LanguageContext"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import { MenuCategoryBar } from "@/components/admin/MenuParts"
import { ItemNoteRow } from "@/components/shared"

const FALLBACK_IMG = "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&h=200&fit=crop"

export function InvalidTable({ navigate, message }) {
  const { t } = useLang()
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[var(--color-background)] p-6 text-center">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 max-w-md w-full shadow-sm flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center mb-4">
          <AlertTriangle size={28} className="text-[var(--color-warning)]" />
        </div>
        <h2 className="font-semibold text-lg text-[var(--color-text)] mb-2">{t("guest.somethingWrong")}</h2>
        <p className="text-sm text-[var(--color-muted)] max-w-xs mb-6">{message}</p>
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
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
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[var(--color-background)] p-6 text-center">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 max-w-md w-full shadow-sm flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary-muted)] flex items-center justify-center mb-4">
            <LocateFixed size={26} className="text-[var(--color-primary)] animate-pulse" />
          </div>
          <h2 className="font-semibold text-lg text-[var(--color-text)] mb-2">{t("guest.locationChecking")}</h2>
          <p className="text-sm text-[var(--color-muted)] max-w-xs">{t("guest.locationCheckingSub")}</p>
          <Loader2 size={18} className="text-[var(--color-muted)] animate-spin mt-5" />
        </div>
      </div>
    )
  }

  const reasonKey =
    errorCode === "DESKTOP" ? "guest.desktopBlocked" :
    errorCode === "DENIED" ? "guest.locationDenied" :
    errorCode === "UNSUPPORTED" ? "guest.locationUnsupported" :
    "guest.locationUnavailable"

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[var(--color-background)] p-6 text-center">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 max-w-md w-full shadow-sm flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-[var(--color-accent-muted)] flex items-center justify-center mb-4">
          <MapPin size={26} className="text-[var(--color-warning)]" />
        </div>
        <h2 className="font-semibold text-lg text-[var(--color-text)] mb-2">{t("guest.locationRequired")}</h2>
        <p className="text-sm text-[var(--color-muted)] max-w-xs mb-6">{t(reasonKey)}</p>
        <div className="flex gap-2.5 flex-wrap justify-center">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <LocateFixed size={15} /> {t("guest.locationRetry")}
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 border border-[var(--color-border)] hover:bg-[var(--color-primary-muted)] text-[var(--color-text-secondary)] text-sm font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
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
    <header className="sticky top-0 z-20 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="border-2 border-[var(--color-primary)] rounded-xl px-2.5 py-1 flex items-center gap-1.5">
            <span className="font-display font-bold text-base text-[var(--color-primary)] leading-none">ZOOM</span>
            <span className="hidden sm:inline text-[10px] text-[var(--color-muted)] font-medium">Garden Cafe & Wine</span>
          </div>
          <LanguageSwitcher langs={["en", "km"]} showIcon={false} />
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate(`/order/status?t=${token}`)}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)]/30 px-3 py-2 rounded-xl hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
          >
            <ClipboardList size={15} /> {t("guest.trackOrder")}
          </button>
          <div className="text-right pl-3 border-l border-[var(--color-border)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{t("guest.yourTable")}</div>
            <div className="font-bold text-sm sm:text-base text-[var(--color-primary)] leading-tight">{table?.table_number || "..."}</div>
          </div>
        </div>
      </div>
    </header>
  )
}

export function OrderStatusBanner({ liveOrderStatus, token, navigate }) {
  const { t } = useLang()
  if (!liveOrderStatus) return null
  return (
    <button
      onClick={() => navigate(`/order/status?t=${token}`)}
      className={cn(
        "w-full px-4 py-2.5 text-xs sm:text-sm font-medium text-center transition-opacity hover:opacity-90 cursor-pointer",
        liveOrderStatus === "Paid" ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)]" :
        liveOrderStatus === "Served" ? "bg-[var(--color-primary)] text-white" :
        liveOrderStatus === "Preparing" ? "bg-[var(--color-accent-muted)] text-[var(--color-warning)]" :
        "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
      )}
    >
      <div className="max-w-6xl mx-auto">
        {liveOrderStatus === "Pending" && t("guest.bannerReceived")}
        {liveOrderStatus === "Preparing" && t("guest.bannerPreparing")}
        {liveOrderStatus === "Served" && t("guest.bannerServed")}
        {liveOrderStatus === "Paid" && t("guest.bannerPaid")}
      </div>
    </button>
  )
}

export function GuestMenuControls({ search, setSearch, categories, activeCat, setActiveCat }) {
  const { t } = useLang()
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="relative flex-1 sm:max-w-xs md:max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("guest.searchMenu")}
          className="w-full h-10 pl-9 pr-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
        />
      </div>
      <MenuCategoryBar categories={categories} activeCat={activeCat} onSelect={setActiveCat} />
    </div>
  )
}

export function GuestMenuGrid({ items, cart, onAdd, onRemove }) {
  const { t, lang } = useLang()
  if (!items || items.length === 0) {
    return <div className="text-center py-20 text-[var(--color-muted)] text-sm">{t("guest.noItems")}</div>
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
      {items.map(item => {
        const qty = cart[item.menu_item_id]?.qty || 0
        const isSelected = qty > 0
        const isAvailable = item.available !== false

        return (
          <div
            key={item.menu_item_id}
            className={cn(
              "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-xs hover:shadow-md hover:border-[var(--color-border-strong)] transition-all duration-200 group flex flex-col justify-between relative",
              isSelected && "ring-2 ring-[var(--color-primary)] border-transparent shadow-md",
              !isAvailable && "opacity-60"
            )}
          >
            <div className="relative aspect-square overflow-hidden bg-[var(--color-border)]/40 shrink-0">
              <img
                src={imageUrl(item.image_url, FALLBACK_IMG)}
                alt={menuItemName(item, lang)}
                onError={(e) => { e.currentTarget.src = FALLBACK_IMG }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {!isAvailable && (
                <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
                  <span className="bg-[var(--color-danger)] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {t("common.soldOut")}
                  </span>
                </div>
              )}
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 bg-[var(--color-primary)] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                  {qty}
                </div>
              )}
            </div>

            <div className="p-3 flex flex-col flex-1 justify-between gap-2">
              <div className="font-semibold text-[var(--color-text)] text-xs sm:text-sm leading-snug line-clamp-2">
                {menuItemName(item, lang)}
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-border)]/60">
                <span className="text-sm sm:text-base font-bold text-[var(--color-primary)]">
                  ${Number(item.price).toFixed(2)}
                </span>

                {!isAvailable ? (
                  <span className="text-[10px] text-[var(--color-danger)] font-medium">{t("common.soldOut")}</span>
                ) : qty === 0 ? (
                  <button
                    onClick={() => onAdd(item.menu_item_id)}
                    className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] hover:bg-[var(--color-primary)] hover:text-white active:scale-95 text-[var(--color-primary)] flex items-center justify-center transition-all shadow-xs cursor-pointer"
                    title="Add to cart"
                  >
                    <Plus size={16} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-[var(--color-background)] rounded-xl p-0.5 border border-[var(--color-border)]">
                    <button
                      onClick={() => onRemove(item.menu_item_id)}
                      className="w-7 h-7 rounded-lg bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white active:scale-95 flex items-center justify-center transition-all shadow-xs cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold px-1.5 text-center text-[var(--color-primary)]">
                      {qty}
                    </span>
                    <button
                      onClick={() => onAdd(item.menu_item_id)}
                      className="w-7 h-7 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-95 flex items-center justify-center transition-all shadow-xs cursor-pointer"
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

export function CartBar({ total, totalKHR, cartCount, onOrder }) {
  const { t } = useLang()
  if (cartCount <= 0) return null
  return (
    <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-30 px-4 pointer-events-none">
      <div className="bg-[var(--color-text)] text-white rounded-2xl shadow-2xl flex items-center justify-between px-5 py-3.5 max-w-lg mx-auto pointer-events-auto border border-white/10">
        <div>
          <div className="font-bold text-sm sm:text-base">
            {t("common.total")}: ${total.toFixed(2)}{" "}
            <span className="text-[var(--color-primary-light)] ml-1.5 text-xs sm:text-sm">៛{totalKHR.toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-white/70">{cartCount} {t("guest.itemsSelected")}</div>
        </div>
        <button
          onClick={onOrder}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] active:scale-95 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <ShoppingCart size={15} /> {t("guest.order")}
        </button>
      </div>
    </div>
  )
}

export function ConfirmOrderDialog({ open, table, cartItems, onItemNoteChange, onIncrease, onDecrease, total, totalKHR, errorMsg, submitting, submitted, queueNumber, partySize, onPartySizeChange, note, onNoteChange, onCancel, onConfirm }) {
  const { t, lang } = useLang()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-4">
      <div className="bg-[var(--color-surface)] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md border border-[var(--color-border)] max-h-[88vh] overflow-y-auto">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
                <ShoppingCart size={17} className="text-[var(--color-primary)]" />
              </div>
              <div>
                <div className="font-semibold text-base text-[var(--color-text)]">{t("guest.confirmTitle")}</div>
                <div className="text-xs text-[var(--color-muted)]">{t("guest.table")} {table?.table_number}</div>
              </div>
            </div>
          </div>

          {submitted && queueNumber != null && (
            <div className="bg-[var(--color-primary-muted)] rounded-2xl px-4 py-3 text-center">
              <div className="text-[11px] text-[var(--color-muted)] uppercase tracking-wide">{t("guest.waitingNumber")}</div>
              <div className="text-3xl font-bold text-[var(--color-primary)] mt-0.5">#{queueNumber}</div>
            </div>
          )}

          {!submitted && (
            <div className="flex gap-2">
              <div className="w-28 relative shrink-0">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                <input
                  type="number" min="1" inputMode="numeric"
                  value={partySize}
                  onChange={e => onPartySizeChange(e.target.value)}
                  placeholder={t("guest.guests")}
                  className="w-full h-10 pl-8 pr-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <input
                value={note}
                onChange={e => onNoteChange(e.target.value)}
                placeholder={t("guest.orderNotePlaceholder")}
                className="flex-1 h-10 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          )}

          {!submitted && (
            <div className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide pt-1">
              {t("guest.itemsLabel")}
            </div>
          )}
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {cartItems.map(item => (
              <div key={item.menu_item_id} className="pb-2.5 border-b border-[var(--color-border)] last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <img
                    src={imageUrl(item.image_url || item.menu_item?.image_url, FALLBACK_IMG)}
                    alt={menuItemName(item, lang)}
                    onError={(e) => {
                      if (e.currentTarget.src !== FALLBACK_IMG) {
                        e.currentTarget.src = FALLBACK_IMG
                      }
                    }}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 bg-[var(--color-border)]/40"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text)] truncate">{menuItemName(item, lang)}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">${Number(item.price).toFixed(2)}</div>
                  </div>
                  {!submitted && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => onDecrease(item.menu_item_id)}
                        className="w-7 h-7 rounded-full bg-[var(--color-danger-muted)] hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-danger)] flex items-center justify-center transition-colors cursor-pointer">
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-bold w-5 text-center text-[var(--color-text)]">{item.qty}</span>
                      <button type="button" onClick={() => onIncrease(item.menu_item_id)}
                        className="w-7 h-7 rounded-full bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] flex items-center justify-center transition-colors cursor-pointer">
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                  {submitted && <div className="text-xs text-[var(--color-muted)] shrink-0">x{item.qty}</div>}
                </div>
                {!submitted && (
                  <div className="mt-1.5 pl-15">
                    <ItemNoteRow note={item.note} onChange={(v) => onItemNoteChange(item.menu_item_id, v)} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {errorMsg && <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 rounded-xl px-3 py-2">{errorMsg}</div>}

          <div className="bg-[var(--color-text)] text-white rounded-xl flex items-center justify-between px-4 py-3">
            <div className="text-sm font-bold">{t("common.total")}: ${total.toFixed(2)} <span className="text-[var(--color-primary-light)] ml-1">៛{totalKHR.toLocaleString()}</span></div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting || submitted}
              className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-primary-muted)] text-sm font-medium text-[var(--color-text-secondary)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting || submitted}
              className={cn(
                "flex-1 font-semibold text-sm px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white",
                (submitting || submitted) && "opacity-60 cursor-not-allowed"
              )}
            >
              {submitted ? <><Check size={14} /> {t("guest.orderPlaced")}</> : submitting ? t("guest.submitting") : t("guest.confirmOrder")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 