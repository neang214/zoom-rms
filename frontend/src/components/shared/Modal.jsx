import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export function Modal({ open, onClose, title, children, maxWidth = "max-w-sm" }) {
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e) => {
      if (e.key === "Escape" && onClose) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
      onClick={() => onClose?.()}
    >
      <div
        className={cn(
          "bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full border border-[var(--color-border)] overflow-hidden",
          maxWidth
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
            <div className="font-semibold text-sm text-[var(--color-text)]">{title}</div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1 rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
