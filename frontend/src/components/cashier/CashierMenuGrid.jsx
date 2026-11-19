import { menuItemName, cn } from "@/lib/utils"
import { formatUSD, formatKHR } from "@/lib/currency"
import { Plus, Minus } from "lucide-react"
import { useLang } from "@/i18n/LanguageContext"
import { MenuItemImage } from "@/components/admin/MenuParts"

function MenuItemCard({ item, qty, onAdd, onRemove, lang }) {
  const { t } = useLang()
  const isSelected = qty > 0
  const isAvailable = item.available !== false

  return (
    <div
      onClick={() => isAvailable && qty === 0 && onAdd(item.menu_item_id)}
      className={cn(
        "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] transition-all duration-200 group flex flex-col justify-between relative select-none",
        isAvailable && qty === 0 && "cursor-pointer active:scale-[0.99]",
        isSelected && "ring-2 ring-[var(--color-primary)] border-transparent shadow-sm",
        !isAvailable && "opacity-60"
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-surface-subtle)] shrink-0">
        <MenuItemImage item={item} lang={lang} className="group-hover:scale-[1.04]" />
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-[var(--color-danger)] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              {t("common.soldOut")}
            </span>
          </div>
        )}
        {isSelected && (
          <div className="absolute top-2.5 right-2.5 bg-[var(--color-primary)] text-white text-xs font-bold min-w-[26px] h-[26px] px-1.5 rounded-full flex items-center justify-center shadow-md tabular-nums">
            {qty}
          </div>
        )}
      </div>

      <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between gap-2.5">
        <div className="font-semibold text-[var(--color-text)] text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.4rem]">
          {menuItemName(item, lang)}
        </div>

        <div className="flex items-end justify-between gap-2 pt-2 border-t border-[var(--color-border)]/50">
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-[var(--color-primary)] tabular-nums">
              {formatUSD(item.price)}
            </div>
            <div className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
              {formatKHR(item.price)}
            </div>
          </div>

          {!isAvailable ? (
            <span className="text-[11px] text-[var(--color-danger)] font-semibold">
              {t("common.unavailable")}
            </span>
          ) : qty === 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAdd(item.menu_item_id)
              }}
              aria-label={`Add ${menuItemName(item, lang)}`}
              className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus size={16} />
            </button>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 bg-[var(--color-surface-subtle)] rounded-xl p-0.5 border border-[var(--color-border)] shrink-0"
            >
              <button
                type="button"
                onClick={() => onRemove(item.menu_item_id)}
                aria-label="Decrease quantity"
                className="w-7 h-7 rounded-lg bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <Minus size={12} />
              </button>
              <span className="text-xs font-bold min-w-[18px] text-center text-[var(--color-text)] tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => onAdd(item.menu_item_id)}
                aria-label="Increase quantity"
                className="w-7 h-7 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] flex items-center justify-center transition-all cursor-pointer"
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CashierMenuGrid({ items, loading, cart, onAdd, onRemove }) {
  const { t, lang } = useLang()

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden animate-pulse"
          >
            <div className="aspect-[4/3] bg-[var(--color-surface-subtle)]" />
            <div className="p-3.5 space-y-2">
              <div className="h-4 bg-[var(--color-surface-subtle)] rounded w-3/4" />
              <div className="h-4 bg-[var(--color-surface-subtle)] rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-center py-16 text-[var(--color-muted)] text-sm">
        {t("common.noMenuItems")}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {items.map((item) => (
        <MenuItemCard
          key={item.menu_item_id}
          item={item}
          qty={cart[item.menu_item_id]?.qty || 0}
          onAdd={onAdd}
          onRemove={onRemove}
          lang={lang}
        />
      ))}
    </div>
  )
}
