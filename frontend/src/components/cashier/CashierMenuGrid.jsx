import { menuItemName, cn } from "@/lib/utils"
import { Plus, Minus } from "lucide-react"
import { useLang } from "@/i18n/LanguageContext"
import { MenuItemImage } from "@/components/admin/MenuParts"

function MenuItemCard({ item, qty, onAdd, onRemove, lang }) {
  const { t } = useLang()
  const isSelected = qty > 0
  const isAvailable = item.available !== false

  return (
    <div
      className={cn(
        "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 group flex flex-col justify-between relative",
        isSelected && "ring-2 ring-[var(--color-primary)] border-transparent shadow-md",
        !isAvailable && "opacity-60"
      )}
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-[var(--color-border)]/40 shrink-0">
        <MenuItemImage item={item} lang={lang} />
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-[var(--color-danger)] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {t("common.soldOut")}
            </span>
          </div>
        )}
        {isSelected && (
          <div className="absolute top-2 right-2 bg-[var(--color-primary)] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-scale-in">
            {qty}
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col flex-1 justify-between gap-2">
        <div className="font-semibold text-[var(--color-text)] text-xs leading-snug line-clamp-2">
          {menuItemName(item, lang)}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]/50">
          <span className="text-sm font-bold text-[var(--color-primary)]">
            ${Number(item.price).toFixed(2)}
          </span>

          {!isAvailable ? (
            <span className="text-[10px] text-[var(--color-danger)] font-medium">{t("common.unavailable")}</span>
          ) : qty === 0 ? (
            <button
              type="button"
              onClick={() => onAdd(item.menu_item_id)}
              className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white flex items-center justify-center transition-all shadow-xs active:scale-95"
              title="Add to order"
            >
              <Plus size={15} />
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-[var(--color-background)] rounded-xl p-0.5 border border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => onRemove(item.menu_item_id)}
                className="w-7 h-7 rounded-lg bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white flex items-center justify-center transition-all shadow-xs"
              >
                <Minus size={12} />
              </button>
              <span className="text-xs font-bold px-1.5 text-center text-[var(--color-primary)]">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => onAdd(item.menu_item_id)}
                className="w-7 h-7 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] flex items-center justify-center transition-all shadow-xs"
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

export default function CashierMenuGrid({ items, cart, onAdd, onRemove }) {
  const { t, lang } = useLang()
  if (items.length === 0) {
    return <div className="text-center py-16 text-[var(--color-muted)] text-sm">{t("common.noMenuItems")}</div>
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {items.map(item => (
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
