import { useState, useEffect } from "react"
import { Search, ToggleLeft, ToggleRight } from "lucide-react"
import { cn, imageUrl, menuItemName, menuItemMatchesSearch } from "@/lib/utils"
import { Input } from "@/components/ui"
import { MenuCategoryBar, MenuItemImage } from "@/components/admin/MenuParts"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { useLang } from "@/i18n/LanguageContext"

export default function StationMenu({ config }) {
  const { t, lang } = useLang()
  usePageTitle("Menu")
  const { items, fetchItems, toggleItem } = useMenuItemStore()
  const { categories, fetchCategories } = useMenuCategoryStore()
  const [activeCat, setActiveCat] = useState("All")
  const [search, setSearch] = useState("")
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => {
    fetchItems()
    fetchCategories()
  }, [])

  // Only show this station's category type to its staff.
  const typeCategoryIds = categories.filter(c => c.type === config.type).map(c => c.category_id)
  const stationItems = items.filter(i => typeCategoryIds.includes(i.category_id))
  const typeCategories = categories.filter(c => c.type === config.type)

  const filtered = stationItems.filter(i => {
    const matchesCat = activeCat === "All" || i.category_id === activeCat
    const catName = categories.find(c => c.category_id === i.category_id)?.category_name
    return matchesCat && menuItemMatchesSearch(i, search, catName)
  })

  const handleToggle = async (item, e) => {
    e.stopPropagation()
    setTogglingId(item.menu_item_id)
    try {
      await toggleItem(item.menu_item_id, !item.available)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" placeholder={t("common.search")} />
        </div>
        <MenuCategoryBar categories={typeCategories} activeCat={activeCat} onSelect={setActiveCat} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted)] text-sm">{t("common.noMenuItems")}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {(filtered || []).map(item => (
            <div
              key={item.menu_item_id}
              className={cn(
                "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 group flex flex-col justify-between relative",
                !item.available && "opacity-60"
              )}
            >
              <div className="relative aspect-square overflow-hidden bg-[var(--color-border)]/40 shrink-0">
                <MenuItemImage item={item} lang={lang} />
                {!item.available && (
                  <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="bg-[var(--color-danger)] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {t("common.soldOut")}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-2.5 flex flex-col flex-1 justify-between gap-1.5">
                <div className="font-semibold text-[var(--color-text)] text-xs leading-snug line-clamp-2">
                  {menuItemName(item, lang)}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]/50">
                  <div className="text-sm font-bold text-[var(--color-primary)]">
                    ${Number(item.price).toFixed(2)}
                  </div>
                  <button
                    onClick={(e) => handleToggle(item, e)}
                    disabled={togglingId === item.menu_item_id}
                    title={item.available ? t("station.markSoldOut") : t("station.markAvailable")}
                    className={cn(
                      "p-1 rounded-lg hover:bg-[var(--color-primary-muted)] transition-colors",
                      item.available ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]",
                      togglingId === item.menu_item_id && "opacity-50"
                    )}
                  >
                    {item.available
                      ? <ToggleRight size={22} />
                      : <ToggleLeft size={22} />
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
