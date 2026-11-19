import { useState, useEffect, useMemo } from "react"
import {
  Package,
  Minus,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStockStore } from "../../context/stockContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { EmptyState, LoadingState } from "@/components/shared"
import { useLang } from "@/i18n/LanguageContext"
import { StockImage, StockTypeBadge } from "@/components/admin/StockParts"

export default function StationStock() {
  const { t, lang } = useLang()
  usePageTitle("Stock")
  const { stockItems, fetchStock, decreaseStock, isLoading } = useStockStore()

  const [search, setSearch] = useState("")
  const [lowOnly, setLowOnly] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [qty, setQty] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState({})
  const [success, setSuccess] = useState({})

  useEffect(() => {
    fetchStock().catch(() => {})
  }, [fetchStock])

  const isLow = (item) =>
    Number(item.quantity) <= 0 ||
    (item.min_level != null && Number(item.quantity) <= Number(item.min_level))

  const lowCount = useMemo(
    () => (stockItems || []).filter(isLow).length,
    [stockItems]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (stockItems || []).filter((item) => {
      if (lowOnly && !isLow(item)) return false
      if (!q) return true
      return (
        String(item.item_name || "").toLowerCase().includes(q) ||
        String(item.unit?.unit_name || "").toLowerCase().includes(q)
      )
    })
  }, [stockItems, search, lowOnly])

  const adjustQty = (id, delta) => {
    setError((prev) => ({ ...prev, [id]: null }))
    setQty((prev) => {
      const cur = parseFloat(prev[id]) || 0
      const next = Math.max(0, Math.round((cur + delta) * 100) / 100)
      return { ...prev, [id]: next === 0 ? "" : String(next) }
    })
  }

  const handleDecrease = async (item) => {
    const amount = parseFloat(qty[item.stock_id]) || 0
    if (amount <= 0) {
      setError((prev) => ({ ...prev, [item.stock_id]: t("station.enterValidQty") }))
      return
    }
    if (amount > Number(item.quantity)) {
      setError((prev) => ({ ...prev, [item.stock_id]: t("station.notEnoughStock") }))
      return
    }

    setBusy(item.stock_id)
    setError((prev) => ({ ...prev, [item.stock_id]: null }))
    try {
      await decreaseStock(item.stock_id, amount)
      setQty((prev) => ({ ...prev, [item.stock_id]: "" }))
      setSuccess((prev) => ({ ...prev, [item.stock_id]: true }))
      setTimeout(() => {
        setSuccess((prev) => ({ ...prev, [item.stock_id]: false }))
      }, 2200)
      setExpandedId(null)
    } catch (err) {
      setError((prev) => ({
        ...prev,
        [item.stock_id]: err?.response?.data?.message || t("common.failed"),
      }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + Search + Low Stock Filter */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-muted)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
              <Package size={19} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[var(--color-text)] leading-tight">
                {t("nav.stock")}
              </h1>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                {t("station.stockSubtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLowOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer self-start sm:self-auto",
              lowOnly
                ? "bg-[var(--color-danger)] text-white border-[var(--color-danger)]"
                : "bg-[var(--color-background)]/60 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-warning)]"
            )}
          >
            <AlertTriangle size={13} />
            <span>
              {t("stock.lowStockOnly")} ({lowCount})
            </span>
          </button>
        </div>

        <div className="relative max-w-md">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("stock.searchPlaceholder")}
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/60 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]/75 outline-none focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
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
      </div>

      {/* Stock Item List */}
      {isLoading && stockItems.length === 0 ? (
        <LoadingState text={t("stock.loadingStock")} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} text={t("station.noStock")} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((item) => {
            const low = isLow(item)
            const out = Number(item.quantity) <= 0
            const expanded = expandedId === item.stock_id
            const takeVal = parseFloat(qty[item.stock_id]) || 0
            const remaining = Number(item.quantity) - takeVal

            return (
              <div
                key={item.stock_id}
                className={cn(
                  "bg-[var(--color-surface)] border rounded-2xl overflow-hidden shadow-2xs transition-all",
                  out
                    ? "border-[var(--color-danger)]/45"
                    : low
                      ? "border-[var(--color-warning)]/40"
                      : "border-[var(--color-border)]"
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : item.stock_id)}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-[var(--color-surface-subtle)]/55 transition-colors text-left cursor-pointer"
                >
                  <StockImage
                    item={item}
                    size={56}
                    className="rounded-xl border border-[var(--color-border)]/70"
                    placeholderClassName={
                      low ? "bg-[var(--color-accent-muted)]" : "bg-[var(--color-primary-muted)]"
                    }
                    iconClassName={
                      low ? "text-[var(--color-warning)]" : "text-[var(--color-primary)]"
                    }
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                        {item.item_name}
                      </span>
                      <StockTypeBadge type={item.stock_type} />
                      {low && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                            out
                              ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)]"
                              : "bg-[var(--color-accent-muted)] text-[var(--color-warning)]"
                          )}
                        >
                          <AlertTriangle size={10} />
                          {out ? t("stock.outOfStock") : t("ing.lowStock")}
                        </span>
                      )}
                      {success[item.stock_id] && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary-muted)] px-2 py-0.5 rounded-full">
                          <Check size={10} /> {t("common.done")}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[var(--color-muted)] mt-1 tabular-nums">
                      <span className="font-bold text-[var(--color-text-secondary)]">
                        {Number(item.quantity).toFixed(2)} {item.unit?.unit_name}
                      </span>
                      {item.min_level != null && (
                        <span>
                          {" "}
                          · {t("stock.minLevel")}: {Number(item.min_level).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {expanded ? (
                    <ChevronUp size={16} className="text-[var(--color-muted)] shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-[var(--color-muted)] shrink-0" />
                  )}
                </button>

                {expanded && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-background)]/45 px-4 py-3.5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-muted)]">
                        {lang === "km"
                          ? `តើអ្នកដកប៉ុន្មាន ${item.unit?.unit_name || ""} ចេញពីឃ្លាំង?`
                          : `How many ${item.unit?.unit_name || "units"} are you taking?`}
                      </span>
                      {takeVal > 0 && (
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            remaining < 0
                              ? "text-[var(--color-danger)]"
                              : "text-[var(--color-primary)]"
                          )}
                        >
                          {lang === "km" ? "នៅសល់" : "Left"}: {remaining.toFixed(2)}{" "}
                          {item.unit?.unit_name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustQty(item.stock_id, -1)}
                        aria-label="Decrease quantity"
                        className="w-9 h-9 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] cursor-pointer"
                      >
                        <Minus size={14} />
                      </button>

                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        inputMode="decimal"
                        value={qty[item.stock_id] || ""}
                        onChange={(e) => {
                          setError((prev) => ({ ...prev, [item.stock_id]: null }))
                          setQty((prev) => ({ ...prev, [item.stock_id]: e.target.value }))
                        }}
                        placeholder="0"
                        className="flex-1 h-9 text-center text-sm font-bold tabular-nums bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]"
                      />

                      <button
                        type="button"
                        onClick={() => adjustQty(item.stock_id, 1)}
                        aria-label="Increase quantity"
                        className="w-9 h-9 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] cursor-pointer"
                      >
                        <Plus size={14} />
                      </button>

                      <span className="text-xs font-semibold text-[var(--color-muted)] min-w-[40px]">
                        {item.unit?.unit_name}
                      </span>
                    </div>

                    {/* Quick Increment Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[0.5, 1, 2, 5].map((step) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => adjustQty(item.stock_id, step)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer tabular-nums"
                        >
                          +{step}
                        </button>
                      ))}
                    </div>

                    {error[item.stock_id] && (
                      <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
                        {error[item.stock_id]}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDecrease(item)}
                      disabled={busy === item.stock_id || out}
                      className="w-full h-10 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      {busy === item.stock_id ? t("common.updating") : t("station.confirmTake")}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
