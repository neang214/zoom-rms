import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { BarChart3, Package } from "lucide-react"
import { useOrderStore } from "../../context/orderContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { ReportBuilder, toLocalDateStr } from "@/components/admin/PaymentsParts"
import { StockReportBuilder } from "@/components/admin/StockReportParts"
import { useLang } from "@/i18n/LanguageContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"
import { cn } from "@/lib/utils"

export default function Reports() {
  const { t } = useLang()
  usePageTitle(t("nav.reports"))
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") === "stock" ? "stock" : "sales"

  const { orders, fetchOrders, isLoading: ordersLoading } = useOrderStore()

  const todayStr = toLocalDateStr()
  const [activePeriod, setActivePeriod] = useState("Daily")
  const [customFrom, setCustomFrom] = useState(todayStr)
  const [customTo, setCustomTo] = useState(todayStr)

  const refresh = useCallback(() => {
    fetchOrders().catch(() => { })
  }, [fetchOrders])

  useEffect(() => {
    refresh()
  }, [refresh])

  useSocketRole("admin")
  useSocketEvent("payment:completed", refresh)
  useSocketEvent("order:new", refresh)
  useSocketEvent("order:status_changed", refresh)

  const setTab = (tab) => {
    if (tab === "stock") {
      setSearchParams({ tab: "stock" }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--color-text)]">{t("report.title")}</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            {activeTab === "stock" ? t("reports.filterStock") : t("reports.filterSales")}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] w-fit">
          <button
            type="button"
            onClick={() => setTab("sales")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
              activeTab === "sales"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
            )}
          >
            <BarChart3 size={15} />
            <span>{t("reports.salesTab")}</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("stock")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
              activeTab === "stock"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
            )}
          >
            <Package size={15} />
            <span>{t("reports.stockTab")}</span>
          </button>
        </div>
      </div>

      {activeTab === "stock" ? (
        <StockReportBuilder />
      ) : (
        <ReportBuilder
          activePeriod={activePeriod}
          setActivePeriod={setActivePeriod}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
          orders={orders}
          ordersLoading={ordersLoading}
        />
      )}
    </div>
  )
} 