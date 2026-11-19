import {
  ArrowLeft,
  Clock,
  Flame,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Plus,
  AlertTriangle,
  UtensilsCrossed,
} from "lucide-react"
import { cn, menuItemName } from "@/lib/utils"
import { formatUSD, formatKHR } from "@/lib/currency"
import { isAllergyNote } from "@/lib/noteTags"
import { useLang } from "@/i18n/LanguageContext"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import { MenuItemImage } from "@/components/admin/MenuParts"

export const statusSteps = ["Pending", "Preparing", "Served", "Paid"]

const itemStatusOrder = ["Preparing", "Pending", "Ready"]

const itemStatusMeta = {
  Preparing: {
    labelKey: "status.preparing",
    icon: Flame,
    color: "text-[var(--color-warning)]",
    badgeBg: "bg-[var(--color-accent-muted)]",
  },
  Pending: {
    labelKey: "status.pending",
    icon: Clock,
    color: "text-[var(--color-text-secondary)]",
    badgeBg: "bg-[var(--color-surface-subtle)]",
  },
  Ready: {
    labelKey: "status.ready",
    icon: CheckCircle2,
    color: "text-[var(--color-primary)]",
    badgeBg: "bg-[var(--color-primary-muted)]",
  },
}

const statusMeta = {
  Pending: {
    key: "guest.statusReceived",
    icon: Clock,
    color: "text-[var(--color-text-secondary)]",
    bg: "bg-[var(--color-surface)] border border-[var(--color-border)]",
    iconBg: "bg-[var(--color-surface-subtle)]",
  },
  Preparing: {
    key: "guest.statusPreparing",
    icon: Flame,
    color: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-accent-muted)]/75 border border-[var(--color-warning)]/20",
    iconBg: "bg-[var(--color-surface)]",
  },
  Served: {
    key: "guest.statusServed",
    icon: CheckCircle2,
    color: "text-[var(--color-primary)]",
    bg: "bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20",
    iconBg: "bg-[var(--color-surface)]",
  },
  Paid: {
    key: "guest.statusPaid",
    icon: CreditCard,
    color: "text-[var(--color-primary)]",
    bg: "bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/25",
    iconBg: "bg-[var(--color-surface)]",
  },
}

export function StatusHeader({ table, token, connected, navigate }) {
  const { t } = useLang()

  return (
    <header className="sticky top-0 z-20 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)]/80">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(`/order?t=${encodeURIComponent(token)}`)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> {t("guest.backToMenu")}
        </button>

        <div className="flex items-center gap-3">
          {connected && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
              {t("tables.live")}
            </span>
          )}
          <LanguageSwitcher langs={["en", "km"]} />
          <div className="text-right pl-3 border-l border-[var(--color-border)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] leading-none">
              {t("guest.table")}
            </div>
            <div className="font-bold text-sm text-[var(--color-text)] mt-0.5 leading-none">
              {table?.table_number || "..."}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export function StatusContent({
  loading,
  refreshing,
  order,
  token,
  navigate,
  statusKey,
  currentStepIndex,
  itemTotal,
  onRefresh,
}) {
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
        <div className="space-y-4">
          <div className="h-24 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
          <div className="h-20 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
          <div className="h-56 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
        </div>
      ) : !order ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-10 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-muted)] text-[var(--color-primary)] flex items-center justify-center mx-auto">
            <UtensilsCrossed size={24} />
          </div>
          <p className="text-sm text-[var(--color-muted)]">{t("guest.noActiveOrder")}</p>
          <button
            type="button"
            onClick={() => navigate(`/order?t=${encodeURIComponent(token)}`)}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {t("guest.browseMenu")}
          </button>
        </div>
      ) : (
        <>
          {/* Status Hero Banner */}
          <div className={cn("rounded-3xl p-5 flex items-center gap-4 shadow-2xs", meta.bg)}>
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs",
                meta.iconBg
              )}
            >
              <StatusIcon size={24} className={meta.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("font-display font-bold text-lg leading-snug", meta.color)}>
                {t(meta.key)}
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">
                {t("guest.yourOrder")} #{String(order.order_id).padStart(4, "0")}
              </div>
            </div>
            {order.queue_number != null && (
              <div className="text-center shrink-0 pl-4 border-l border-[var(--color-border)]">
                <div className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                  {t("guest.waitingNumber")}
                </div>
                <div className={cn("font-display text-3xl font-bold tabular-nums", meta.color)}>
                  #{order.queue_number}
                </div>
              </div>
            )}
          </div>

          {/* Visual Stepper */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-2xs">
            <div className="flex items-start px-1">
              {statusSteps.map((step, idx) => {
                const done = idx <= currentStepIndex
                const StepIcon = statusMeta[step].icon
                return (
                  <div key={step} className="flex-1 flex flex-col items-center relative">
                    {idx < statusSteps.length - 1 && (
                      <div
                        className={cn(
                          "absolute top-3.5 left-1/2 w-full h-0.5 transition-colors",
                          idx < currentStepIndex
                            ? "bg-[var(--color-primary)]"
                            : "bg-[var(--color-border)]"
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
                        done
                          ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                          : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)]",
                        idx === currentStepIndex && "ring-4 ring-[var(--color-primary-muted)]"
                      )}
                    >
                      <StepIcon size={13} />
                    </div>
                    <span
                      className={cn(
                        "mt-2 text-[11px] text-center leading-tight px-1",
                        done
                          ? "text-[var(--color-primary)] font-semibold"
                          : "text-[var(--color-muted)]"
                      )}
                    >
                      {t(statusMeta[step].key)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order Items Card */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="font-semibold text-base text-[var(--color-text)]">
                {t("guest.yourOrder")}
              </div>
              {statusKey !== "Paid" && (
                <button
                  type="button"
                  onClick={() => navigate(`/order?t=${encodeURIComponent(token)}`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary-muted)] hover:bg-[var(--color-primary)] hover:text-white px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  <span>{lang === "km" ? "បន្ថែមមុខម្ហូប" : "Add More"}</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {itemGroups.map((group) => {
                const GroupIcon = group.meta.icon
                const groupQty = group.items.reduce((s, oi) => s + oi.quantity, 0)
                return (
                  <div key={group.status} className="space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--color-border)]/70">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
                          group.meta.badgeBg,
                          group.meta.color
                        )}
                      >
                        <GroupIcon size={12} />
                        {t(group.meta.labelKey)}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {groupQty} {t("station.items")}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {group.items.map((oi) => {
                        const allergy = isAllergyNote(oi.note)
                        return (
                          <div key={oi.order_item_id} className="flex items-center gap-3.5">
                            <div className="w-13 h-13 rounded-xl overflow-hidden bg-[var(--color-surface-subtle)] border border-[var(--color-border)]/60 shrink-0">
                              <MenuItemImage item={oi.menu_item} lang={lang} iconSize={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[var(--color-text)] truncate">
                                {menuItemName(oi.menu_item, lang)}
                              </div>
                              <div className="text-xs text-[var(--color-muted)] tabular-nums">
                                {formatUSD(oi.unit_price)} × {oi.quantity}
                              </div>
                              {oi.note && (
                                <div
                                  className={cn(
                                    "inline-flex items-center gap-1 text-[11px] font-medium mt-1 px-2 py-0.5 rounded-full max-w-full truncate",
                                    allergy
                                      ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)]"
                                      : "bg-[var(--color-accent-muted)] text-[var(--color-warning)]"
                                  )}
                                >
                                  {allergy && <AlertTriangle size={10} className="shrink-0" />}
                                  <span className="truncate">{oi.note}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-bold text-[var(--color-text)] tabular-nums shrink-0">
                              {formatUSD(Number(oi.unit_price) * oi.quantity)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {order.note && (
              <div className="mt-4 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-subtle)] rounded-xl px-3.5 py-2.5">
                <span className="font-semibold">{t("history.note")}:</span> {order.note}
              </div>
            )}

            <div className="border-t border-[var(--color-border)] mt-4 pt-4 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                {t("common.total")}
              </span>
              <div className="text-right tabular-nums">
                <span className="text-lg font-bold text-[var(--color-primary)]">
                  {formatUSD(itemTotal)}
                </span>
                <span className="text-xs font-medium text-[var(--color-muted)] ml-2">
                  {formatKHR(itemTotal)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>{t("guest.refresh")}</span>
          </button>
        </>
      )}
    </div>
  )
}
