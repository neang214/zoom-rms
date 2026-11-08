import { useState, useRef, useEffect } from "react"
import { Globe, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLang } from "@/i18n/LanguageContext"
import { LANGUAGES } from "@/i18n/translations"

const LANG_LABELS = {
  en: "English",
  km: "ភាសាខ្មែរ",
}

export default function LanguageSwitcher({ langs = ["en", "km"], className }) {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Change language"
        className={cn(
          "p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center",
          open
            ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
            : "hover:bg-[var(--color-primary-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
        )}
      >
        <Globe size={16} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg p-1 z-50">
          {langs.map((code) => {
            const active = lang === code
            const label = LANG_LABELS[code] || LANGUAGES[code]?.short || code.toUpperCase()
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setLang(code)
                  setOpen(false)
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  active
                    ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)] font-semibold"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-muted)]/60 hover:text-[var(--color-text)]"
                )}
              >
                <span>{label}</span>
                {active && <Check size={13} className="text-[var(--color-primary)] shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}