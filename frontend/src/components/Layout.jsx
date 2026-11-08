import { useEffect, useState } from "react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import { useTheme } from "next-themes"
import {
  LayoutDashboard, UtensilsCrossed, Package, TableIcon,
  CreditCard, Users, Truck, LogOut, Bell, Moon, Sun,
  Menu as MenuIcon, ChefHat, ShoppingBag, Coffee, Clock, BarChart3, Volume2, X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { authContext } from "../context/authContext"
import { useStaffNotifications, unlockAudioOnFirstInteraction, isAudioUnlocked, unlockAudioNow } from "../hooks/useStaffNotifications"
import { useLang } from "@/i18n/LanguageContext"
import LanguageSwitcher from "@/components/LanguageSwitcher"

const navByRole = {
  admin: {
    main: [
      { to: "/admin", icon: LayoutDashboard, label: "nav.dashboard" },
      { to: "/admin/menu", icon: UtensilsCrossed, label: "nav.menu" },
      { to: "/admin/stock", icon: Package, label: "nav.stockMgmt" },
      { to: "/admin/tables", icon: TableIcon, label: "nav.tables" },
      { to: "/admin/payments", icon: CreditCard, label: "nav.paymentsOnly" },
      { to: "/admin/reports", icon: BarChart3, label: "nav.reports" },
      { to: "/admin/history", icon: Clock, label: "nav.history" },
    ],
    secondary: [
      { to: "/admin/suppliers", icon: Truck, label: "nav.suppliers" },
      { to: "/admin/users", icon: Users, label: "nav.users" },
    ],
  },
  cashier: {
    main: [
      { to: "/cashier/menu", icon: UtensilsCrossed, label: "nav.menu" },
      { to: "/cashier/orders", icon: ShoppingBag, label: "nav.orders" },
      { to: "/cashier/payments", icon: CreditCard, label: "nav.payments" },
      { to: "/cashier/history", icon: Clock, label: "nav.history" },
    ],
    secondary: [],
  },
  kitchen: {
    main: [
      { to: "/kitchen/menu", icon: UtensilsCrossed, label: "nav.menu" },
      { to: "/kitchen/orders", icon: ChefHat, label: "nav.kitchenOrder" },
      { to: "/kitchen/stock", icon: Package, label: "nav.stock" },
    ],
    secondary: [],
  },
  barista: {
    main: [
      { to: "/barista/menu", icon: UtensilsCrossed, label: "nav.menu" },
      { to: "/barista/orders", icon: Coffee, label: "nav.drinkOrders" },
      { to: "/barista/stock", icon: Package, label: "nav.stock" },
    ],
    secondary: [],
  },
}

const roleInfo = {
  admin: {
    label: "Administrator",
    sub: "role.admin",
    avatarBg: "bg-[var(--color-plum-muted)]",
    avatarText: "text-[var(--color-plum)]",
    badge: "bg-[var(--color-plum-muted)] text-[var(--color-plum)] border border-[var(--color-plum)]/20",
  },
  cashier: {
    label: "Cashier Staff",
    sub: "role.cashier",
    avatarBg: "bg-[var(--color-primary-muted)]",
    avatarText: "text-[var(--color-primary)]",
    badge: "bg-[var(--color-primary-muted)] text-[var(--color-primary)] border border-[var(--color-primary)]/20",
  },
  kitchen: {
    label: "Kitchen Staff",
    sub: "role.kitchen",
    avatarBg: "bg-[var(--color-flame-muted)]",
    avatarText: "text-[var(--color-flame)]",
    badge: "bg-[var(--color-flame-muted)] text-[var(--color-flame)] border border-[var(--color-flame)]/20",
  },
  barista: {
    label: "Barista Staff",
    sub: "role.barista",
    avatarBg: "bg-[var(--color-accent-muted)]",
    avatarText: "text-[var(--color-warning)]",
    badge: "bg-[var(--color-accent-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/20",
  },
}

const exactEnds = ["/admin", "/cashier/menu", "/kitchen/menu", "/barista/menu"]

function LiveClock({ lang }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = now.toLocaleTimeString(lang === "km" ? "km-KH" : [], {
    hour: "2-digit",
    minute: "2-digit",
  })
  const dateStr = now.toLocaleDateString(lang === "km" ? "km-KH" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
      <Clock size={13} className="text-[var(--color-primary)] shrink-0" />
      <span className="font-semibold text-[var(--color-text)]">{timeStr}</span>
      <span className="text-[var(--color-muted)]">·</span>
      <span className="text-[var(--color-muted)]">{dateStr}</span>
    </div>
  )
}

export default function Layout({ children }) {
  const { theme, setTheme } = useTheme()
  const { t, lang } = useLang()
  const { user, logout } = authContext()
  const location = useLocation()
  const navigate = useNavigate()

  const role = user?.role || "admin"
  const info = roleInfo[role] || roleInfo.admin
  const nav = navByRole[role] || navByRole.admin

  const displayName = user?.fullName || user?.name || user?.username || info.label
  const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { count: bellCount, bellRinging } = useStaffNotifications(role)

  const bellDestination = {
    admin: "/admin",
    cashier: "/cashier/orders",
    kitchen: "/kitchen/orders",
    barista: "/barista/orders",
  }

  useEffect(() => { unlockAudioOnFirstInteraction() }, [])

  const needsSoundPrompt = ["cashier", "kitchen", "barista", "admin"].includes(role)
  const [soundUnlocked, setSoundUnlocked] = useState(isAudioUnlocked())

  useEffect(() => {
    if (!needsSoundPrompt || soundUnlocked) return
    const check = () => { if (isAudioUnlocked()) setSoundUnlocked(true) }
    window.addEventListener("click", check)
    window.addEventListener("touchstart", check)
    return () => {
      window.removeEventListener("click", check)
      window.removeEventListener("touchstart", check)
    }
  }, [needsSoundPrompt, soundUnlocked])

  const handleEnableSound = () => {
    unlockAudioNow()
    setSoundUnlocked(true)
  }

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const handleLogout = async () => {
    await logout()
  }

  // Resolve active nav item for top header breadcrumb title
  const allNavItems = [...(nav.main || []), ...(nav.secondary || [])]
  const activeNav =
    allNavItems.find((item) =>
      exactEnds.includes(item.to)
        ? location.pathname === item.to
        : location.pathname === item.to || location.pathname.startsWith(item.to + "/")
    ) || allNavItems[0]
  const ActiveIcon = activeNav?.icon || LayoutDashboard

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--color-background)]">

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none",
        "lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>

        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl shadow-xs shrink-0 overflow-hidden">
              <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="zoomSidebarGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                </defs>
                <rect width="120" height="120" rx="26" fill="url(#zoomSidebarGrad)" />
                <rect x="7" y="7" width="106" height="106" rx="20" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" />
                <path d="M78 24C90 22 98 30 96 42C85 44 77 36 78 24Z" fill="#fbbf24" />
                <path
                  d="M32 36H84L44 84H88"
                  stroke="#ffffff"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="88" cy="84" r="6.5" fill="#fbbf24" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg tracking-wider text-[var(--color-primary)] leading-none">
                  ZOOM
                </span>
                <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md", info.badge)}>
                  {t(info.sub)}
                </span>
              </div>
              <div className="text-[11px] font-medium text-[var(--color-text-secondary)] truncate mt-1">
                Garden Café &amp; Wine · Sen Sok
              </div>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              {t(info.sub)} Workspace
            </div>
            {nav.main.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={exactEnds.includes(to)}
                className={({ isActive }) => cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-sm shadow-[var(--color-primary)]/20"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
                )}
              >
                <Icon size={17} className="shrink-0 transition-transform duration-150 group-hover:scale-105" />
                <span className="truncate">{t(label)}</span>
              </NavLink>
            ))}
          </div>

          {nav.secondary?.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[var(--color-border)]">
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Management
              </div>
              {nav.secondary.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-[var(--color-primary)] text-white shadow-sm shadow-[var(--color-primary)]/20"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
                  )}
                >
                  <Icon size={17} className="shrink-0 transition-transform duration-150 group-hover:scale-105" />
                  <span className="truncate">{t(label)}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-background)]/40 shrink-0">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xs">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0", info.avatarBg, info.avatarText)}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--color-text)] truncate">{displayName}</div>
              <div className="text-[10px] text-[var(--color-muted)] truncate">{user?.email || t(info.sub)}</div>
            </div>
            <button
              onClick={handleLogout}
              title={t("common.logout")}
              className="p-2 rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-danger-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 gap-3">
          {/* Left: Hamburger + Active Module Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="lg:hidden p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-primary-muted)] text-[var(--color-text-secondary)] transition-colors"
            >
              <MenuIcon size={18} />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-muted)] flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <ActiveIcon size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--color-text)] truncate leading-tight">
                  {activeNav ? t(activeNav.label) : "ZOOM RMS"}
                </div>
                <div className="text-[10px] text-[var(--color-muted)] hidden sm:block truncate">
                  Zoom Garden Café &amp; Wine · {t(info.sub)}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Clock, Language, Notifications, Sound, Theme, Logout */}
          <div className="flex items-center gap-2">
            <LiveClock lang={lang} />

            <LanguageSwitcher langs={["en", "km"]} />

            {/* Action Icon Group */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/50 p-0.5">
              {/* Notification Bell */}
              <button
                onClick={() => navigate(bellDestination[role] || "/admin")}
                title={bellCount > 0 ? `${bellCount} order(s) need attention` : "No pending notifications"}
                className={cn(
                  "relative p-2 rounded-lg transition-all cursor-pointer",
                  bellRinging
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-warning)]"
                    : "hover:bg-[var(--color-primary-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                )}
              >
                <Bell size={15} className={cn(bellRinging && "animate-bounce", bellCount > 0 && "text-[var(--color-warning)]")} />
                {bellCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {bellCount}
                  </span>
                )}
              </button>

              {/* Test Sound Button */}
              <button
                onClick={unlockAudioNow}
                title="Test notification alert sound"
                className="p-2 rounded-lg hover:bg-[var(--color-primary-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
              >
                <Volume2 size={15} />
              </button>

              {/* Dark / Light Theme Toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle theme"
                className="p-2 rounded-lg hover:bg-[var(--color-primary-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>

            {/* Quick Logout Button on Desktop */}
            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-[var(--color-primary-dark)] shadow-xs transition-all cursor-pointer"
            >
              <LogOut size={13} />
              <span>{t("common.logout")}</span>
            </button>
          </div>
        </header>

        {/* Sound Prompt Banner */}
        {needsSoundPrompt && !soundUnlocked && (
          <button
            onClick={handleEnableSound}
            className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent-muted)] text-[var(--color-warning)] text-xs font-semibold py-2 px-4 border-b border-[var(--color-warning)]/20 transition-colors cursor-pointer"
          >
            <Bell size={13} /> Tap to enable order alert sounds
          </button>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
} 