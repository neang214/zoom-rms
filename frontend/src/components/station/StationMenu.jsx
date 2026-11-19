import { useState, useEffect, useMemo } from "react"
import { Search, ToggleLeft, ToggleRight, X } from "lucide-react"
import { cn, menuItemName, menuItemMatchesSearch, categoryDisplayName } from "@/lib/utils"
import { formatUSD, formatKHR } from "@/lib/currency"
import { MenuItemImage } from "@/components/admin/MenuParts"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { useLang } from "@/i18n/LanguageContext"

export default function StationMenu({ config }) {
  const { t, lang } = useLang()
  usePageTitle("Menu")
  const { items, fetchItems, toggleItem, isLoading } = useMenuItemStore()
  const { categories, fetchCategories } = useMenuCategoryStore()

  const [activeCat, setActiveCat] = useState("All")
  const [availFilter, setAvailFilter] = useState("all") // "all" | "available" | "soldout"
  const [search, setSearch] = useState("")
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => {
    fetchItems().catch(() => {})
    fetchCategories().catch(() => {})
  }, [fetchItems, fetchCategories])

  const typeCategories = useMemo(
    () => (categories || []).filter((c) => c.type === config.type),
    [categories, config.type]
  )

  const typeCategoryIds = useMemo(
    () => new Set(typeCategories.map((c) => c.category_id)),
    [typeCategories]
  )

  const stationItems = useMemo(
    () => (items || []).filter((i) => typeCategoryIds.has(i.category_id)),
    [items, typeCategoryIds]
  )

  const availCount = useMemo(
    () => stationItems.filter((i) => i.available).length,
    [stationItems]
  )
  const soldOutCount = stationItems.length - availCount

  const filtered = useMemo(
    () =>
      stationItems.filter((i) => {
        if (activeCat !== "All" && i.category_id !== activeCat) return false
        if (availFilter === "available" && !i.available) return false
        if (availFilter === "soldout" && i.available) return false
        const catName = typeCategories.find((c) => c.category_id === i.category_id)?.category_name
        return menuItemMatchesSearch(i, search, catName)
      }),
    [stationItems, activeCat, availFilter, typeCategories, search]
  )

  const handleToggle = async (item, e) => {
    e.stopPropagation()
    if (togglingId === item.menu_item_id) return
    setTogglingId(item.menu_item_id)
    try {
      await toggleItem(item.menu_item_id, !item.available)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + Availability Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("menu.searchPlaceholder")}
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/75 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
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

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] self-start sm:self-auto">
          {[
            { key: "all", label: t("common.all"), count: stationItems.length },
            { key: "available", label: t("common.available"), count: availCount },
            { key: "soldout", label: t("common.soldOut"), count: soldOutCount },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setAvailFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5",
                availFilter === key
                  ? "bg-[var(--color-primary)] text-white shadow-2xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                  availFilter === key
                    ? "bg-white/20 text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-muted)]"
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setActiveCat("All")}
          className={cn(
            "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
            activeCat === "All"
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-2xs"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
          )}
        >
          {t("common.all")}
        </button>
        {typeCategories.map((cat) => {
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
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
              )}
            >
              {categoryDisplayName(cat, lang)}
            </button>
          )
        })}
      </div>

      {/* Station Menu Grid */}
      {isLoading && stationItems.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted)] text-sm">
          {t("menu.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-center py-16 text-[var(--color-muted)] text-sm">
          {t("common.noMenuItems")}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filtered.map((item) => {
            const busy = togglingId === item.menu_item_id
            return (
              <div
                key={item.menu_item_id}
                className={cn(
                  "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 group flex flex-col justify-between relative",
                  !item.available && "opacity-75"
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-[var(--color-surface-subtle)] shrink-0">
                  <MenuItemImage item={item} lang={lang} />
                  {!item.available && (
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="bg-[var(--color-danger)] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        {t("common.soldOut")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 flex flex-col flex-1 justify-between gap-2.5">
                  <div className="font-semibold text-[var(--color-text)] text-xs sm:text-sm leading-snug line-clamp-2">
                    {menuItemName(item, lang)}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]/60">
                    <div className="leading-tight">
                      <div className="text-sm font-bold text-[var(--color-primary)] tabular-nums">
                        {formatUSD(item.price)}
                      </div>
                      <div className="text-[10px] text-[var(--color-muted)] tabular-nums">
                        {formatKHR(item.price)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggle(item, e)}
                      disabled={busy}
                      title={item.available ? t("station.markSoldOut") : t("station.markAvailable")}
                      aria-label={
                        item.available
                          ? `Mark ${menuItemName(item, lang)} sold out`
                          : `Mark ${menuItemName(item, lang)} available`
                      }
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50",
                        item.available
                          ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)] hover:bg-[var(--color-danger-muted)] hover:text-[var(--color-danger)]"
                          : "bg-[var(--color-danger-muted)] text-[var(--color-danger)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
                      )}
                    >
                      {item.available ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                      <span className="hidden sm:inline">
                        {item.available ? t("common.available") : t("common.soldOut")}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
