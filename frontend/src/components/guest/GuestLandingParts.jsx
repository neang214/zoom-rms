import { Link } from "react-router-dom"
import { Camera, X, UtensilsCrossed, QrCode, ClipboardList, Leaf, Sparkles } from "lucide-react"
import { useLang } from "@/i18n/LanguageContext"
import LanguageSwitcher from "@/components/LanguageSwitcher"

export function LandingContent({ onScan, lastToken, error, navigate }) {
  const { t } = useLang()

  return (
    <div className="relative max-w-5xl w-full mx-auto flex-1 flex flex-col justify-between px-4 sm:px-6">
      {/* Subtle botanical ambient glow */}
      <div className="pointer-events-none fixed -top-24 -right-24 w-80 h-80 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-24 w-80 h-80 rounded-full bg-[var(--color-wine)]/10 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted)]">
          <Leaf size={14} className="text-[var(--color-primary)] rotate-12" />
          <span>Sen Sok · Phnom Penh</span>
        </div>
        <LanguageSwitcher langs={["en", "km"]} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-6 text-center">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 sm:p-11 shadow-sm max-w-md w-full flex flex-col items-center">
          {/* Refined Brand Emblem */}
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center shadow-sm mb-4">
            <Leaf size={26} className="rotate-12" />
          </div>
          <div className="font-display font-bold text-4xl tracking-wide text-[var(--color-text)] leading-none">
            ZOOM
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)] mt-2">
            Garden Café &amp; Wine
          </div>

          <div className="w-16 h-px bg-[var(--color-border)] my-6" />

          <h1 className="font-display text-2xl font-bold text-[var(--color-text)] mb-2">
            {t("guest.welcome")}
          </h1>
          <p className="text-sm text-[var(--color-muted)] max-w-xs leading-relaxed mb-8">
            {t("guest.scanPrompt")}
          </p>

          {/* Primary Scan Button */}
          <div className="relative flex items-center justify-center">
            <span className="absolute w-24 h-24 rounded-full bg-[var(--color-primary)]/15 animate-ping [animation-duration:2.6s]" />
            <button
              type="button"
              onClick={onScan}
              aria-label={t("guest.tapToScan")}
              className="relative w-20 h-20 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] active:scale-95 text-white flex items-center justify-center shadow-lg shadow-[var(--color-primary)]/25 transition-all cursor-pointer"
            >
              <Camera size={30} />
            </button>
          </div>
          <p className="text-xs font-medium text-[var(--color-muted)] mt-4">
            {t("guest.tapToScan")}
          </p>

          {lastToken && (
            <button
              type="button"
              onClick={() => navigate(`/order/status?t=${encodeURIComponent(lastToken)}`)}
              className="mt-6 w-full flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-primary)] bg-[var(--color-primary-muted)] hover:bg-[var(--color-primary)] hover:text-white px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <ClipboardList size={16} />
              <span>{t("guest.trackMyOrder")}</span>
            </button>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 w-full bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/25 text-[var(--color-danger)] text-xs font-medium px-4 py-3 rounded-xl"
            >
              {error}
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-10 text-center pb-6 flex flex-col items-center gap-2">
        <p className="text-xs text-[var(--color-muted)] flex items-center justify-center gap-1.5">
          <UtensilsCrossed size={12} className="text-[var(--color-primary)]" />
          <span>ZOOM Garden Café &amp; Wine</span>
        </p>
        <Link
          to="/login"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)] underline underline-offset-4 transition-colors"
        >
          {t("guest.staffLogin")}
        </Link>
      </footer>
    </div>
  )
}

export function ScannerOverlay({ scanning, elementId, onClose }) {
  const { t } = useLang()
  if (!scanning) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 max-w-2xl w-full mx-auto">
        <div className="flex items-center gap-2.5 text-white">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <QrCode size={16} />
          </div>
          <span className="text-sm font-semibold">{t("guest.scanTitle")}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-5">
        <div
          id={elementId}
          className="w-full max-w-sm rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-2xl"
        />
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/85 text-xs">
          <Sparkles size={13} className="text-emerald-300" />
          <span>{t("guest.scanHint")}</span>
        </div>
      </div>
    </div>
  )
}
