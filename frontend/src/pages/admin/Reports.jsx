import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { BarChart3, UtensilsCrossed, Package, CreditCard } from "lucide-react"
import { useOrderStore } from "../../context/orderContext"
import { useMenuItemStore } from "../../context/menuItemContext"
import { useMenuCategoryStore } from "../../context/menuCategoryContext"
import { useStockStore } from "../../context/stockContext"
import { useStockOrderStore } from "../../context/stockOrderContext"
import { usePaymentStore } from "../../context/paymentContext"
import { usePageTitle } from "../../hooks/usePageTitle"
import { ReportBuilder, PaymentsTable } from "@/components/admin/PaymentsParts"
import { MenuReportBuilder, StockReportBuilder } from "@/components/admin/ReportsParts"
import { toLocalDateStr } from "@/lib/currency"
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

  const socketTimerRef = useRef(null)

  const refreshActiveTab = useCallback(
    (tab = activeTab) => {
      if (tab === "sales") {
        fetchOrders().catch(() => {})
      } else if (tab === "menu") {
        fetchOrders().catch(() => {})
        fetchItems().catch(() => {})
        fetchArchivedItems().catch(() => {})
        fetchCategories().catch(() => {})
      } else if (tab === "stock") {
        fetchStock().catch(() => {})
        fetchStockOrders().catch(() => {})
      } else if (tab === "payments") {
        fetchPayments().catch(() => {})
        fetchOrders().catch(() => {})
      }
    },
    [
      activeTab,
      fetchOrders,
      fetchItems,
      fetchArchivedItems,
      fetchCategories,
      fetchStock,
      fetchStockOrders,
      fetchPayments,
    ]
  )

  useEffect(() => {
    refreshActiveTab(activeTab)
  }, [activeTab, refreshActiveTab])

  useEffect(
    () => () => {
      if (socketTimerRef.current) clearTimeout(socketTimerRef.current)
    },
    []
  )

  // Only debounce-refresh order/payment-dependent tabs on order/payment events
  const scheduleOrderTabRefresh = useCallback(() => {
    if (activeTab === "stock") return
    if (socketTimerRef.current) clearTimeout(socketTimerRef.current)
    socketTimerRef.current = setTimeout(() => {
      socketTimerRef.current = null
      refreshActiveTab(activeTab)
    }, 400)
  }, [activeTab, refreshActiveTab])

  useSocketRole("admin")
  useSocketEvent("payment:completed", scheduleOrderTabRefresh)
  useSocketEvent("order:new", scheduleOrderTabRefresh)
  useSocketEvent("order:status_changed", scheduleOrderTabRefresh)

  const handleTabChange = (tab) => {
    if (tab === "sales") setSearchParams({}, { replace: true })
    else setSearchParams({ tab }, { replace: true })
  }

  const tabs = [
    { id: "sales", label: t("reports.salesTab"), icon: BarChart3, count: orders.length },
    {
      id: "menu",
      label: t("reports.menuTab"),
      icon: UtensilsCrossed,
      count: (menuItems?.length || 0) + (archivedMenuItems?.length || 0),
    },
    { id: "stock", label: t("reports.stockTab"), icon: Package, count: stockItems.length },
    { id: "payments", label: t("reports.paymentsTab"), icon: CreditCard, count: payments.length },
  ]

  const subtitleByTab = {
    sales: t("reports.filterSales"),
    menu: t("reports.filterMenu"),
    stock: t("reports.filterStock"),
    payments: t("payments.subtitle"),
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--color-text)]">
            {t("report.title")}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-0.5">
            {subtitleByTab[activeTab] || t("reports.filterSales")}
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xs w-fit">
          {tabs.map(({ id, label, icon: Icon, count }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-2xs"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                )}
              >
                <Icon size={15} />
                <span>{label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "text-[11px] px-1.5 py-0.5 rounded-full font-bold tabular-nums",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

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
        <PaymentsTable payments={payments} orders={orders} isLoading={paymentsLoading} />
      )}
    </div>
  )
}
