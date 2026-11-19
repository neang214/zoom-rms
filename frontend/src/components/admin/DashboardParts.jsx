import { TrendingUp, Calendar, DollarSign, Flame, Clock } from "lucide-react"
import { Card, Badge } from "@/components/ui"
import { useLang } from "@/i18n/LanguageContext"
import { cn, menuItemName } from "@/lib/utils"
import { formatUSD, formatKHR } from "@/lib/currency"

export function RevenueStats({ dailyRevenue, weeklyRevenue, monthlyRevenue }) {
  const { t } = useLang()
  const dailyVal = Number(dailyRevenue?.total || 0)
  const weeklyVal = Number(weeklyRevenue?.total || 0)
  const monthlyVal = Number(monthlyRevenue?.total || 0)

  const cards = [
    {
      label: t("dashboard.todayRevenue"),
      usd: formatUSD(dailyVal),
      khr: formatKHR(dailyVal),
      sub: t("dashboard.todaySub"),
      icon: TrendingUp,
      featured: true,
    },
    {
      label: t("dashboard.weeklyRevenue"),
      usd: formatUSD(weeklyVal),
      khr: formatKHR(weeklyVal),
      sub: t("dashboard.weeklySub"),
      icon: Calendar,
      featured: false,
    },
    {
      label: t("dashboard.monthlyRevenue"),
      usd: formatUSD(monthlyVal),
      khr: formatKHR(monthlyVal),
      sub: t("dashboard.monthlySub"),
      icon: DollarSign,
      featured: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map(({ label, usd, khr, sub, icon: Icon, featured }) => (
        <Card
          key={label}
          className={cn(
            "p-5 hover:shadow-md transition-shadow",
            featured && "border-[var(--color-primary)]/35 bg-[var(--color-primary-muted)]/35"
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              {label}
            </span>
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                featured
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-subtle)] text-[var(--color-primary)]"
              )}
            >
              <Icon size={17} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1 tabular-nums">
            <span
              className={cn(
                "font-display text-2xl sm:text-3xl font-bold",
                featured ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
              )}
            >
              {usd}
            </span>
            <span className="text-xs font-semibold text-[var(--color-muted)]">{khr}</span>
          </div>
          <div className="text-xs text-[var(--color-muted)]">{sub}</div>
        </Card>
      ))}
    </div>
  )
}

function rankBadgeStyle(index) {
  if (index === 0) {
    return "bg-[var(--color-primary)] text-white"
  }
  if (index === 1) {
    return "bg-[var(--color-primary-muted)] text-[var(--color-primary)] border border-[var(--color-primary)]/20"
  }
  return "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
}

export function TopSellingTable({ topSellingItems = [] }) {
  const { t, lang } = useLang()
  const items = topSellingItems.slice(0, 5)
  const maxQty =
    items.length > 0 ? Math.max(...items.map((i) => Number(i.total_quantity) || 0), 1) : 1

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-flame-muted)] text-[var(--color-flame)] flex items-center justify-center shrink-0">
            <Flame size={18} />
          </div>
          <div>
            <div className="font-semibold text-[var(--color-text)] text-base">
              {t("dashboard.topSelling")}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">
              {t("dashboard.topSellingSub")}
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0">
          Top {items.length || 5}
        </Badge>
      </div>

      <div className="p-5 space-y-4">
        {items.length > 0 ? (
          items.map((item, index) => {
            const qty = Number(item.total_quantity) || 0
            const pct = Math.max(Math.round((qty / maxQty) * 100), 6)
            return (
              <div key={item.menu_item_id || index} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 tabular-nums",
                        rankBadgeStyle(index)
                      )}
                    >
                      #{index + 1}
                    </span>
                    <span className="font-medium text-sm text-[var(--color-text)] truncate">
                      {menuItemName(item, lang)}
                    </span>
                  </div>
                  <Badge variant="secondary" className="font-semibold shrink-0 tabular-nums">
                    {qty} {t("dashboard.sold")}
                  </Badge>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-surface-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center text-xs text-[var(--color-muted)] py-8">
            {t("dashboard.noSales")}
          </div>
        )}
      </div>
    </Card>
  )
}

function formatHourRange(hourNum) {
  const fmt = (h) => {
    const normalized = ((h % 24) + 24) % 24
    const suffix = normalized >= 12 ? "PM" : "AM"
    const hr12 = normalized % 12 === 0 ? 12 : normalized % 12
    return `${hr12}:00 ${suffix}`
  }
  const h = Number(hourNum)
  return `${fmt(h)} – ${fmt(h + 1)}`
}

export function PeakHoursCard({ peakHours = [] }) {
  const { t } = useLang()

  const topPeakHours = [...peakHours]
    .filter((p) => Number(p.total_orders) > 0)
    .sort((a, b) => Number(b.total_orders) - Number(a.total_orders))
    .slice(0, 5)

  const maxOrders =
    topPeakHours.length > 0
      ? Math.max(...topPeakHours.map((p) => Number(p.total_orders) || 0), 1)
      : 1

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-muted)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <div className="font-semibold text-[var(--color-text)] text-base">
              {t("dashboard.peakHours")}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">
              {t("dashboard.peakHoursSub")}
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0">
          Top {topPeakHours.length || 5}
        </Badge>
      </div>

      <div className="p-5 space-y-4">
        {topPeakHours.length === 0 ? (
          <div className="text-center text-xs text-[var(--color-muted)] py-8">
            {t("dashboard.noSales")}
          </div>
        ) : (
          topPeakHours.map((row, index) => {
            const count = Number(row.total_orders) || 0
            const pct = Math.max(Math.round((count / maxOrders) * 100), 6)
            return (
              <div key={row.hour} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 tabular-nums",
                        rankBadgeStyle(index)
                      )}
                    >
                      #{index + 1}
                    </span>
                    <span className="font-medium text-sm text-[var(--color-text)] truncate tabular-nums">
                      {formatHourRange(row.hour)}
                    </span>
                  </div>
                  <Badge variant="secondary" className="font-semibold shrink-0 tabular-nums">
                    {count} {t("cashier.orders")}
                  </Badge>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-surface-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary-light)] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
