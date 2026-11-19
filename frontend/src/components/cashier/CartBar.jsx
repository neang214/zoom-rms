import { ShoppingCart } from "lucide-react"
import { formatUSD, formatKHR } from "@/lib/currency"
import { useLang } from "@/i18n/LanguageContext"

export default function CartBar({ total, count, onPlaceOrder }) {
  const { t } = useLang()
  if (count <= 0) return null

  return (
    <div className="lg:hidden fixed bottom-4 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
      <div className="w-full max-w-lg pointer-events-auto">
        <div className="bg-[var(--color-banner-bg)] text-[var(--color-banner-text)] rounded-2xl shadow-2xl flex items-center justify-between gap-3 px-4 py-3 border border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] text-white font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
              {count}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm tabular-nums truncate">
                {formatUSD(total)}
                <span className="text-emerald-300 font-semibold ml-1.5 text-xs">
                  {formatKHR(total)}
                </span>
              </div>
              <div className="text-[11px] text-white/65">
                {count} {t("cashier.itemsSelected")}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onPlaceOrder}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] active:scale-95 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <ShoppingCart size={15} />
            <span>{t("cashier.placeOrder")}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
