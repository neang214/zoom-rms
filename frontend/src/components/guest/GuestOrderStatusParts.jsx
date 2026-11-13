import { ArrowLeft, Clock, Flame, CheckCircle2, CreditCard, RefreshCw } from "lucide-react"
import { cn, imageUrl, menuItemName } from "@/lib/utils"
import { useLang } from "@/i18n/LanguageContext"
import LanguageSwitcher from "@/components/LanguageSwitcher"

const FALLBACK_IMG = "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&h=200&fit=crop"

export const statusSteps = ["Pending", "Preparing", "Served", "Paid"]

const itemStatusOrder = ["Preparing", "Pending", "Ready"]

const itemStatusMeta = {
  Preparing: { labelKey: "status.preparing", icon: Flame,        color: "text-[var(--color-warning)]",        badgeBg: "bg-[var(--color-accent-muted)]" },
  Pending:   { labelKey: "status.pending",   icon: Clock,        color: "text-[var(--color-text-secondary)]", badgeBg: "bg-[var(--color-border)]/70" },
  Ready:     { labelKey: "status.ready",     icon: CheckCircle2, color: "text-[var(--color-primary)]",        badgeBg: "bg-[var(--color-primary-muted)]" },
}

const statusMeta = {
  Pending:   { key: "guest.statusReceived",  icon: Clock,        color: "text-[var(--color-text-secondary)]",  bg: "bg-[var(--color-border)]" },
  Preparing: { key: "guest.statusPreparing", icon: Flame,        color: "text-[var(--color-warning)]", bg: "bg-[var(--color-accent-muted)]" },
  Served:    { key: "guest.statusServed",    icon: CheckCircle2, color: "text-[var(--color-primary)]", bg: "bg-[var(--color-primary-muted)]" },
  Paid:      { key: "guest.statusPaid",      icon: CreditCard,   color: "text-[var(--color-plum)]", bg: "bg-[var(--color-plum-muted)]" },
}

export function StatusHeader({ table, token, navigate }) {
  const { t } = useLang()
  return (
    <header className="sticky top-0 z-20 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(`/order?t=${token}`)}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> {t("guest.backToMenu")}
        </button>
        <div className="flex items-center gap-3">
          <LanguageSwitcher langs={["en", "km"]} showIcon={false} />
          <div className="text-right pl-3 border-l border-[var(--color-border)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{t("guest.table")}</div>
            <div className="font-bold text-sm sm:text-base text-[var(--color-primary)] leading-tight">{table?.table_number || "..."}</div>
          </div>
        </div>
      </div>
    </header>
  )
}

export function StatusContent({ loading, order, token, navigate, statusKey, currentStepIndex, itemTotal, totalKHR, onRefresh }) {
  const { t, lang } = useLang()
  const meta = statusMeta[statusKey] || statusMeta.Pending
  const StatusIcon = meta.icon
  const items = order?.order_items || []
  const itemGroups = itemStatusOrder
    .map((status) => ({
      status,
      meta: itemStatusMeta[status],
      items: items.filter((oi) => (oi.status || "Pending") === status),
    }))
    .filter((group) => group.items.length > 0)
  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-2xl mx-auto">
      {loading ? (
        <div className="text-center py-20 text-[var(--color-muted)] text-sm">{t("guest.loadingOrder")}</div>
      ) : !order ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-10 text-center">
          <p className="text-sm text-[var(--color-muted)] mb-5">{t("guest.noActiveOrder")}</p>
          <button
            onClick={() => navigate(`/order?t=${token}`)}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {t("guest.browseMenu")}
          </button>
        </div>
      ) : (
        <>
          <div className={cn("rounded-2xl p-5 flex items-center gap-4", meta.bg)}>
            <div className="w-12 h-12 rounded-xl bg-white/70 dark:bg-black/20 flex items-center justify-center shrink-0">
              <StatusIcon size={24} className={meta.color} />
            </div>
            <div className="flex-1">
              <div className={cn("font-semibold text-base", meta.color)}>{t(meta.key)}</div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">{t("guest.yourOrder")} #{String(order.order_id).padStart(4, "0")}</div>
            </div>
            {order.queue_number != null && (
              <div className="text-center shrink-0 pl-3 border-l border-black/10 dark:border-white/10">
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">{t("guest.waitingNumber")}</div>
                <div className={cn("text-2xl font-bold", meta.color)}>#{order.queue_number}</div>
              </div>
            )}
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="flex items-start px-1">
              {statusSteps.map((step, idx) => {
                const done = idx <= currentStepIndex
                return (
                  <div key={step} className="flex-1 flex flex-col items-center relative">
                    {idx < statusSteps.length - 1 && (
                      <div className={cn(
                        "absolute top-[7px] left-1/2 w-full h-0.5",
                        idx < currentStepIndex ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
                      )} />
                    )}
                    <div className={cn(
                      "relative z-10 w-4 h-4 rounded-full border-2 transition-colors",
                      done
                        ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                        : "bg-[var(--color-surface)] border-[var(--color-border)]",
                      idx === currentStepIndex && "ring-4 ring-[var(--color-primary-muted)]"
                    )} />
                    <span className={cn(
                      "mt-2 text-[11px] text-center leading-tight",
                      done ? "text-[var(--color-primary)] font-semibold" : "text-[var(--color-muted)]"
                    )}>
                      {t(statusMeta[step].key)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
            <div className="font-semibold text-sm sm:text-base text-[var(--color-text)] mb-4">{t("guest.yourOrder")}</div>
            <div className="space-y-4">
              {itemGroups.map((group) => {
                const GroupIcon = group.meta.icon
                const groupQty = group.items.reduce((s, oi) => s + oi.quantity, 0)
                return (
                  <div key={group.status} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--color-border)]/60">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", group.meta.badgeBg, group.meta.color)}>
                        <GroupIcon size={12} />
                        {t(group.meta.labelKey)}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {groupQty} {t("station.items")}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map(oi => (
                        <div key={oi.order_item_id} className="flex items-center gap-3.5">
                          <img
                            src={imageUrl(oi.menu_item?.image_url || oi.image_url, FALLBACK_IMG)}
                            alt={menuItemName(oi.menu_item, lang)}
                            onError={(e) => {
                              if (e.currentTarget.src !== FALLBACK_IMG) {
                                e.currentTarget.src = FALLBACK_IMG
                              }
                            }}
                            className="w-13 h-13 rounded-xl object-cover shrink-0 bg-[var(--color-border)]/40"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--color-text)] truncate">{menuItemName(oi.menu_item, lang)}</div>
                            <div className="text-xs text-[var(--color-muted)]">${Number(oi.unit_price).toFixed(2)} × {oi.quantity}</div>
                            {oi.note && (
                              <div className="text-[11px] text-[var(--color-warning)] truncate mt-0.5">{oi.note}</div>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-[var(--color-text)]">${(Number(oi.unit_price) * oi.quantity).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-[var(--color-border)] mt-4 pt-4 flex justify-between text-base font-bold">
              <span className="text-[var(--color-text)]">{t("common.total")}</span>
              <span className="text-[var(--color-primary)]">
                ${itemTotal.toFixed(2)}{" "}
                <span className="text-xs font-normal text-[var(--color-muted)] ml-1">៛{totalKHR.toLocaleString()}</span>
              </span>
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] py-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} /> {t("guest.refresh")}
          </button>
        </>
      )}
    </div>
  )
} 