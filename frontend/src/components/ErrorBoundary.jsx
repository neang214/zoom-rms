import React from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "./ui"

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled UI error:", error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const isKm =
        typeof window !== "undefined" && localStorage.getItem("zoom_lang") === "km"

      return (
        <div className="min-h-dvh w-full flex items-center justify-center p-6 bg-[var(--color-background)]">
          <div className="max-w-md w-full rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-danger-muted)] flex items-center justify-center text-[var(--color-danger)]">
              <AlertTriangle size={26} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold font-display text-[var(--color-text)]">
                {isKm ? "មានបញ្ហាបច្ចេកទេសបន្តិចបន្តួច" : "Something went wrong"}
              </h2>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                {isKm
                  ? "មានបញ្ហាដែលមិនបានរំពឹងទុកបានកើតឡើង។ អ្នកអាចផ្ទុកទំព័រឡើងវិញ ឬត្រឡប់ទៅទំព័រដើម។"
                  : "An unexpected interface error occurred. You can reload this view or return to the home screen."}
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-[var(--color-danger-muted)]/60 border border-[var(--color-danger)]/20 text-[11px] font-mono text-[var(--color-danger)] text-left overflow-x-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  window.location.href = "/"
                }}
              >
                <Home size={15} /> {isKm ? "ទំព័រដើម" : "Return Home"}
              </Button>
              <Button className="flex-1" onClick={this.handleReset}>
                <RefreshCw size={15} /> {isKm ? "ផ្ទុកឡើងវិញ" : "Reload View"}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
