import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { BarChart3, UtensilsCrossed, Package, CreditCard } from "lucide-react"
import { useOrderStore } from "../../context/orderContext"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import { useStockStore } from "../../context/stockContext"
import { useStockOrderStore } from "../../context/stockOrderContext"
import { usePaymentStore } from "../../context/paymentContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { ReportBuilder, PaymentsTable, toLocalDateStr } from "@/components/admin/PaymentsParts"
import { MenuReportBuilder, StockReportBuilder } from "@/components/admin/ReportsParts"
import { useLang } from "@/i18n/LanguageContext"
import { useSocketRole, useSocketEvent } from "../../services/socket"
import { cn } from "@/lib/utils"

const VALID_TABS = ["sales", "menu", "stock", "payments"]

export default function Reports() {
  const { t } = useLang()
  usePageTitle(t("nav.reports"))

  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get("tab")
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : "sales"

  const { orders, fetchOrders, isLoading: ordersLoading } = useOrderStore()
  const {
    items: menuItems,
    archivedItems: archivedMenuItems,
    fetchItems,
    fetchArchivedItems,
    fetchItemSales,
    isLoading: menuLoading,
  } = useMenuItemStore()
  const { categories, fetchCategories } = useMenuCategoryStore()
  const { stockItems, fetchStock, isLoading: stockLoading } = useStockStore()
  const { stockOrders, fetchStockOrders, isLoading: poLoading } = useStockOrderStore()
  const { payments, fetchPayments, isLoading: paymentsLoading } = usePaymentStore()

  const todayStr = toLocalDateStr()
  const [activePeriod, setActivePeriod] = useState("Daily")
  const [customFrom, setCustomFrom] = useState(todayStr)
  const [customTo, setCustomTo] = useState(todayStr)

  const refresh = useCallback(() => {
    fetchOrders().catch(() => {})
    fetchItems().catch(() => {})
    fetchArchivedItems().catch(() => {})
    fetchCategories().catch(() => {})
    fetchStock().catch(() => {})
    fetchStockOrders().catch(() => {})
    fetchPayments().catch(() => {})
  }, [fetchOrders, fetchItems, fetchArchivedItems, fetchCategories, fetchStock, fetchStockOrders, fetchPayments])

  useEffect(() => {
    refresh()
  }, [refresh])

  useSocketRole("admin")
  useSocketEvent("payment:completed", refresh)
  useSocketEvent("order:new", refresh)
  useSocketEvent("order:status_changed", refresh)

  const handleTabChange = (tab) => {
    if (tab === "sales") {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
  }

  const tabs = [
    {
      id: "sales",
      label: t("reports.salesTab"),
      icon: BarChart3,
      count: orders.length,
    },
    {
      id: "menu",
      label: t("reports.menuTab"),
      icon: UtensilsCrossed,
      count: (menuItems?.length || 0) + (archivedMenuItems?.length || 0),
    },
    {
      id: "stock",
      label: t("reports.stockTab"),
      icon: Package,
      count: stockItems.length,
    },
    {
      id: "payments",
      label: t("reports.paymentsTab"),
      icon: CreditCard,
      count: payments.length,
    },
  ]

  const subtitleByTab = {
    sales: t("reports.filterSales"),
    menu: t("reports.filterMenu"),
    stock: t("reports.filterStock"),
    payments: t("payments.subtitle"),
  }

  return (
    <div className="space-y-5">
      {/* Header + Unified Report Tab Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--color-text)]">{t("report.title")}</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            {subtitleByTab[activeTab] || t("reports.filterSales")}
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs w-fit">
          {tabs.map(({ id, label, icon: Icon, count }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
                )}
              >
                <Icon size={15} />
                <span>{label}</span>
                <span
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "sales" && (
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

      {activeTab === "menu" && (
        <MenuReportBuilder
          orders={orders}
          menuItems={menuItems}
          archivedMenuItems={archivedMenuItems}
          categories={categories}
          fetchItemSales={fetchItemSales}
          isLoading={ordersLoading || menuLoading}
        />
      )}

      {activeTab === "stock" && (
        <StockReportBuilder
          stockItems={stockItems}
          stockOrders={stockOrders}
          isLoading={stockLoading || poLoading}
        />
      )}

      {activeTab === "payments" && (
        <PaymentsTable
          payments={payments}
          orders={orders}
          isLoading={paymentsLoading}
        />
      )}
    </div>
  )
}
