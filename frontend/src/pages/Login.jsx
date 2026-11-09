import { useState } from "react"
import { useLang } from "@/i18n/LanguageContext"
import { Eye, EyeOff, LogIn, Leaf, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import { authContext } from "../context/authContext"

export default function Login() {
  const { t } = useLang()
  const { login, isLoading, error: storeError } = authContext()
  const [form, setForm] = useState({ username: "", password: "" })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")

  // Masks password characters as "•" on a type="text" input so browsers
  // (Chrome, Firefox, Safari, Edge) never trigger "Save Password?" on shared POS terminals.
  const handlePasswordChange = (e) => {
    setError("")
    const val = e.target.value
    if (showPass) {
      setForm((f) => ({ ...f, password: val }))
      return
    }
    const cursor = e.target.selectionStart ?? val.length
    const inserted = val.replace(/•/g, "")
    const start = Math.max(0, cursor - inserted.length)
    const suffixLen = Math.max(0, val.length - cursor)

    setForm((f) => {
      const prev = f.password
      const prefix = prev.slice(0, start)
      const suffix = suffixLen > 0 ? prev.slice(prev.length - suffixLen) : ""
      return { ...f, password: prefix + inserted + suffix }
    })
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setError("")

    if (!form.username.trim() || !form.password) {
      setError(t("login.enterBoth") || "Please enter both username and password.")
      return
    }

    try {
      const res = await login({ username: form.username.trim(), password: form.password })
      const currentState = authContext.getState?.()
      if (res === false || (currentState && !currentState.user)) {
        const fallbackMsg =
          currentState?.error ||
          res?.error ||
          res?.message ||
          t("login.invalid") ||
          "Invalid username or password."
        setError(fallbackMsg)
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        t("login.invalid") ||
        "Invalid username or password."
      setError(msg)
    }
  }

  const displayError = error || storeError

  return (
    <div className="min-h-screen w-full flex bg-[var(--color-background)] font-sans antialiased">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark,var(--color-primary))] relative overflow-hidden flex-col justify-between p-16">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/[0.03] blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-black/[0.04] blur-2xl -ml-24 -mb-24 pointer-events-none" />

        <div className="relative z-10 opacity-15">
          <Leaf size={48} className="text-white rotate-12" />
        </div>

        <div className="relative z-10 w-full max-w-sm mx-auto my-auto flex flex-col items-center text-center">
          <div className="bg-white/[0.07] backdrop-blur-md border border-white/10 rounded-3xl p-8 w-full shadow-2xl shadow-black/10">
            <div className="font-display font-black text-5xl text-white tracking-wider leading-none">ZOOM</div>
            <div className="text-white/90 text-sm font-medium tracking-wide mt-2 uppercase">Garden Cafe & Wine</div>
            <div className="text-white/50 text-xs tracking-wider mt-0.5">Sen Sok</div>

            <div className="h-px bg-white/10 my-6 w-3/4 mx-auto" />

            <h2 className="text-white text-xl font-semibold mb-2">{t("login.welcomeBack")}</h2>
            <p className="text-white/70 text-xs leading-relaxed max-w-[280px] mx-auto">
              {t("login.welcomeSub")}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full mt-8">
            {[{ value: "11", label: t("login.tables") }, { value: "4", label: t("login.roles") }, { value: "100+", label: t("login.menuItems") }].map(({ value, label }) => (
              <div key={label} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-3 backdrop-blur-sm">
                <div className="text-white font-bold text-lg tracking-tight">{value}</div>
                <div className="text-white/50 text-[10px] uppercase font-medium tracking-wider mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-center text-white/40 text-xs font-medium tracking-wide">
          © {new Date().getFullYear()} ZOOM Management System
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 lg:p-16 bg-gradient-to-b from-[var(--color-background)] to-[var(--color-surface,var(--color-background))] relative">
        <div className="absolute top-6 right-6">
          <LanguageSwitcher langs={["en", "km"]} />
        </div>

        <div className="lg:hidden mb-12 text-center">
          <div className="inline-flex flex-col items-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl px-6 py-4 shadow-sm">
            <div className="font-display font-black text-3xl text-[var(--color-primary)] tracking-wide">ZOOM</div>
            <div className="text-[var(--color-text-secondary)] text-[11px] font-medium tracking-wider mt-1 uppercase">Garden Cafe & Wine · Sen Sok</div>
          </div>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">{t("login.signIn")}</h1>
            <p className="text-sm text-[var(--color-muted)] mt-1.5">{t("login.formSubtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase">{t("login.username")}</label>
              <input
                type="text"
                name="rms_staff_user"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={form.username}
                onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setError("") }}
                placeholder="e.g. admin_zoom"
                className="w-full h-12 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm placeholder:text-[var(--color-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200 shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wide text-[var(--color-text-secondary)] uppercase">{t("login.password")}</label>
              <div className="relative">
                <input
                  type="text"
                  name="rms_staff_pin"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={showPass ? form.password : "•".repeat(form.password.length)}
                  onChange={handlePasswordChange}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm placeholder:text-[var(--color-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors focus:outline-none p-1 rounded-md"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {displayError && (
              <div
                role="alert"
                className="bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs font-medium px-4 py-3 rounded-xl flex items-center gap-2.5"
              >
                <AlertCircle size={16} className="shrink-0 text-[var(--color-danger)]" />
                <span>{displayError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 mt-2 shadow-sm cursor-pointer",
                isLoading
                  ? "bg-[var(--color-primary)]/50 text-white/80 cursor-not-allowed"
                  : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] hover:shadow-md hover:shadow-[var(--color-primary)]/10 active:scale-[0.99]"
              )}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={16} className="translate-y-[-0.5px]" />
                  <span>{t("login.signInToSystem")}</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}