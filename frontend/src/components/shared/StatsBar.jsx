import { cn } from "@/lib/utils"

export function StatsBar({ stats, columns }) {
  const cols = columns || stats.length
  const colClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-5",
  }[cols] || "grid-cols-2 sm:grid-cols-4"
  return (
    <div className={cn("grid gap-2", colClass)}>
      {stats.map(({ label, value, color, bg }) => (
        <div key={label} className={cn("rounded-xl p-3 text-center", bg || "bg-[var(--color-primary-muted)]")}>
          <div className={cn("text-lg font-bold", color || "text-[var(--color-primary)]")}>{value}</div>
          <div className="text-[10px] text-[var(--color-muted)]">{label}</div>
        </div>
      ))}
    </div>
  )
}
