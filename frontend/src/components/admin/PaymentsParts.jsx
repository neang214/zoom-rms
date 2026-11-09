export function ReportBuilder({
  activePeriod = "Daily",
  setActivePeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  orders = [],
  ordersLoading = false,
  periods: periodsProp,
  printSize = "a4",
}) {
  const { t, lang } = useLang()
  const periodOptions = periodsProp || periods
  const periodLabelKey = {
    Daily: "reports.daily",
    Yesterday: "reports.yesterday",
    Weekly: "reports.weekly",
    Monthly: "reports.monthly",
    Custom: "reports.custom",
  }
  const todayStr = toLocalDateStr()

  const [localPeriod, setLocalPeriod] = useState(activePeriod)
  const [localFrom, setLocalFrom] = useState(todayStr)
  const [localTo, setLocalTo] = useState(todayStr)
  const [statusFilter, setStatusFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [viewOrder, setViewOrder] = useState(null)

  const currentPeriod = setActivePeriod ? activePeriod : localPeriod
  const handlePeriodChange = setActivePeriod || setLocalPeriod
  const fromDate = customFrom !== undefined ? customFrom : localFrom
  const toDate = customTo !== undefined ? customTo : localTo
  const handleFromChange = setCustomFrom || setLocalFrom
  const handleToChange = setCustomTo || setLocalTo

  const range = useMemo(
    () => getDateRangeForPeriod(currentPeriod, fromDate, toDate),
    [currentPeriod, fromDate, toDate]
  )

  const rangedOrders = useMemo(
    () => filterOrdersByRange(orders, range.from, range.to),
    [orders, range.from, range.to]
  )
  const paidOrders = useMemo(() => rangedOrders.filter((o) => o.status === "Paid"), [rangedOrders])
  const totalRevenue = useMemo(() => paidOrders.reduce((s, o) => s + orderTotal(o), 0), [paidOrders])
  const avgOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0
  const itemsSold = useMemo(
    () => paidOrders.reduce((sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0), 0),
    [paidOrders]
  )

  const methodBreakdown = useMemo(() => {
    const map = new Map()
    for (const o of paidOrders) {
      const name = o.payments?.[0]?.method?.method_name || "Cash / Other"
      const prev = map.get(name) || { name, count: 0, total: 0 }
      prev.count += 1
      prev.total += orderTotal(o)
      map.set(name, prev)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [paidOrders])

  const topItemsInPeriod = useMemo(() => {
    const map = new Map()
    for (const o of paidOrders) {
      for (const oi of o.order_items || []) {
        const key = oi.menu_item_id || oi.menu_item?.item_name || `item-${oi.order_item_id}`
        const name = oi.menu_item ? menuItemName(oi.menu_item, lang) : `Item #${oi.menu_item_id}`
        const prev = map.get(key) || { name, qty: 0, revenue: 0 }
        prev.name = name
        prev.qty += Number(oi.quantity || 0)
        prev.revenue += Number(oi.unit_price || 0) * Number(oi.quantity || 0)
        map.set(key, prev)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [paidOrders, lang])

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rangedOrders.filter((o) => {
      if (statusFilter === "Paid" && o.status !== "Paid") return false
      if (statusFilter === "Unpaid" && o.status === "Paid") return false
      if (!q) return true
      const idStr = String(o.order_id)
      const padded = idStr.padStart(4, "0")
      const tbl = String(o.table?.table_number || "").toLowerCase()
      return idStr.includes(q) || padded.includes(q) || `ord-${padded}`.includes(q) || tbl.includes(q)
    })
  }, [rangedOrders, statusFilter, search])

  const kpis = [
    {
      label: t("reports.periodRevenue"),
      value: `$${totalRevenue.toFixed(2)}`,
      sub: `៛${Math.round(totalRevenue * KHR_RATE).toLocaleString()} KHR`,
      icon: DollarSign,
      tint: "bg-[var(--color-primary-muted)]",
      color: "text-[var(--color-primary)]",
      accent: true,
    },
    {
      label: t("reports.paidOrders"),
      value: paidOrders.length,
      sub: `${paidOrders.length} / ${rangedOrders.length} ${t("cashier.orders")}`,
      icon: CheckCircle2,
      tint: "bg-[var(--color-info-muted)]",
      color: "text-[var(--color-info)]",
    },
    {
      label: t("reports.avgOrderValue"),
      value: `$${avgOrderValue.toFixed(2)}`,
      sub: `៛${Math.round(avgOrderValue * KHR_RATE).toLocaleString()}`,
      icon: TrendingUp,
      tint: "bg-[var(--color-plum-muted)]",
      color: "text-[var(--color-plum)]",
    },
    {
      label: t("reports.itemsSold"),
      value: itemsSold,
      sub: `${paidOrders.length} ${t("reports.paidOrders")}`,
      icon: ShoppingCart,
      tint: "bg-[var(--color-flame-muted)]",
      color: "text-[var(--color-flame)]",
    },
  ]

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center">
              <BarChart3 size={16} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--color-text)] text-base">{t("report.salesReport")}</div>
              <div className="text-xs text-[var(--color-muted)]">{range.label}</div>
            </div>
          </div>

          {periodOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {periodOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                    currentPeriod === p
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  )}
                >
                  {p === "Custom" ? <Calendar size={13} /> : <TrendingUp size={13} />}
                  {periodLabelKey[p] ? t(periodLabelKey[p]) : p}
                </button>
              ))}
            </div>
          )}
        </div>

        {currentPeriod === "Custom" && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-[var(--color-primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--color-muted)]">{t("reports.from")}</span>
              <input
                type="date"
                value={fromDate}
                max={toDate || todayStr}
                onChange={(e) => e.target.value && handleFromChange(e.target.value)}
                className="text-xs font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
              />
            </div>

            <ArrowRight size={14} className="text-[var(--color-muted)] hidden sm:block" />

            <div className="flex items-center gap-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-[var(--color-primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--color-muted)]">{t("reports.to")}</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={todayStr}
                onChange={(e) => e.target.value && handleToChange(e.target.value)}
                className="text-xs font-semibold text-[var(--color-text)] bg-transparent outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                handleFromChange(todayStr)
                handleToChange(todayStr)
              }}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline px-2 py-1"
            >
              {t("reports.resetToday")}
            </button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, tint, color, accent }) => (
          <Card key={label} className={cn("p-5", accent && "border-l-4 border-l-[var(--color-primary)]")}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</span>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", tint)}>
                <Icon size={16} className={color} />
              </div>
            </div>
            <div className={cn("text-2xl font-bold", accent ? "text-[var(--color-primary)]" : "text-[var(--color-text)]")}>
              {value}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">{sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-[var(--color-primary)]" />
            <div>
              <div className="font-semibold text-sm text-[var(--color-text)]">{t("reports.revenueByMethod")}</div>
              <div className="text-xs text-[var(--color-muted)]">{t("reports.distributionCompleted")}</div>
            </div>
          </div>

          {methodBreakdown.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--color-muted)]">{t("reports.noPaidOrdersPeriod")}</div>
          ) : (
            <div className="space-y-3">
              {methodBreakdown.map((m) => {
                const pct = totalRevenue > 0 ? Math.round((m.total / totalRevenue) * 100) : 0
                return (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--color-text)]">
                        {m.name}{" "}
                        <span className="text-[var(--color-muted)] font-normal">
                          ({m.count} {t("cashier.orders")})
                        </span>
                      </span>
                      <span className="font-bold text-[var(--color-primary)]">
                        ${m.total.toFixed(2)} <span className="text-[var(--color-muted)] font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--color-primary-muted)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={16} className="text-[var(--color-flame)]" />
            <div>
              <div className="font-semibold text-sm text-[var(--color-text)]">{t("reports.topItemsPeriod")}</div>
              <div className="text-xs text-[var(--color-muted)]">
                {t("reports.mostOrderedPeriod")} {range.label}
              </div>
            </div>
          </div>

          {topItemsInPeriod.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--color-muted)]">{t("reports.noItemSales")}</div>
          ) : (
            <div className="space-y-2.5">
              {topItemsInPeriod.map((item, idx) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/60 last:border-0 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-[var(--color-primary-muted)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-[var(--color-text)] truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary">
                      {item.qty} {t("dashboard.sold")}
                    </Badge>
                    <span className="font-semibold text-[var(--color-text)] w-16 text-right">
                      ${item.revenue.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="p-5 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-[var(--color-text)]">
              {t("reports.orderTransactions")} ({visibleOrders.length})
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {t("reports.detailedBreakdown")} {range.label}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={visibleOrders.length === 0}
              onClick={() => exportOrdersCsv(visibleOrders, range.label)}
            >
              <Download size={13} /> {t("reports.exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={visibleOrders.length === 0}
              onClick={() =>
                exportOrdersExcel({
                  orders: visibleOrders,
                  periodLabel: range.label,
                  totalRevenue,
                  paidOrdersCount: paidOrders.length,
                  avgOrderValue,
                })
              }
            >
              <FileSpreadsheet size={13} /> Export Excel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={rangedOrders.length === 0}
              onClick={() =>
                printExecutiveReport({
                  period: range.label,
                  totalRevenue,
                  paidOrders,
                  avgOrderValue,
                  periodOrders: rangedOrders,
                  format: printSize,
                })
              }
            >
              <Printer size={13} /> {t("reports.printReport")}
            </Button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-background)]/40">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("reports.searchOrderOrTable")}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {["All", "Paid", "Unpaid"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  statusFilter === st
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)]"
                )}
              >
                {st === "All" ? t("reports.all") : st === "Paid" ? t("reports.paid") : t("reports.unpaid")}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2">
          {ordersLoading ? (
            <div className="text-center text-sm text-[var(--color-muted)] py-10">{t("cashier.loadingOrders")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead>{t("report.orderNum")}</TableHead>
                  <TableHead>{t("common.table")}</TableHead>
                  <TableHead>{t("payments.dateTime")}</TableHead>
                  <TableHead>{t("common.items")}</TableHead>
                  <TableHead>{t("report.payment")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.total")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrders.slice(0, 100).map((o) => {
                  const total = orderTotal(o)
                  const itemCount = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
                  const method = o.payments?.[0]?.method?.method_name || "—"
                  return (
                    <TableRow key={o.order_id}>
                      <TableCell className="font-semibold">ORD-{String(o.order_id).padStart(4, "0")}</TableCell>
                      <TableCell className="text-[var(--color-muted)]">{o.table?.table_number || "—"}</TableCell>
                      <TableCell className="text-[var(--color-muted)] text-xs">
                        {new Date(o.order_date).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[var(--color-muted)]">
                        {itemCount} {t("station.items")}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--color-text-secondary)]">{method}</TableCell>
                      <TableCell>
                        <Badge variant={o.status === "Paid" ? "success" : "warning"}>{o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-bold text-[var(--color-primary)]">${total.toFixed(2)}</div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          ៛{Math.round(total * KHR_RATE).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => printOrderReceipt(o)}
                            title={t("cashier.printReceipt")}
                            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => setViewOrder(o)}
                            title={t("cashier.viewDetails")}
                            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] transition-colors cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {visibleOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-[var(--color-muted)] py-10">
                      {t("reports.noOrdersRange")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
        {visibleOrders.length > 100 && (
          <div className="px-5 pb-4 text-xs text-[var(--color-muted)]">
            {t("reports.showingFirst100")} {visibleOrders.length} {t("reports.exportCsvHint")}
          </div>
        )}
      </Card>

      <ViewOrderDialog order={viewOrder} onClose={() => setViewOrder(null)} />
    </div>
  )
}