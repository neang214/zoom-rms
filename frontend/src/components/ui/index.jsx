import * as React from "react"
import { cn } from "@/lib/utils"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as SelectPrimitive from "@radix-ui/react-select"
import { ChevronDown, X } from "lucide-react"

export const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-sm",
    outline: "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)] bg-transparent",
    ghost: "text-[var(--color-text)] hover:bg-[var(--color-primary-muted)] bg-transparent",
    destructive: "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90",
    secondary: "bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-primary-muted)]",
    dark: "bg-[var(--color-text)] text-white hover:bg-[#1f2937] dark:bg-[#f0f7f0] dark:text-[var(--color-text)]",
  }
  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs",
    lg: "h-11 px-6 text-base",
    icon: "h-9 w-9",
  }
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50 cursor-pointer",
        variants[variant], sizes[size], className
      )}
      {...props}
    />
  )
})

export const Badge = ({ className, variant = "default", ...props }) => {
  const variants = {
    default: "bg-[var(--color-primary)] text-white",
    success: "bg-[var(--color-primary-muted)] text-[var(--color-primary)] border border-[var(--color-border-strong)]",
    danger: "bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-[var(--color-danger)]/25",
    warning: "bg-[var(--color-accent-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/25",
    outline: "border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface)]",
    purple: "bg-[var(--color-plum-muted)] text-[var(--color-plum)] border border-[var(--color-plum)]/25",
    orange: "bg-[var(--color-flame-muted)] text-[var(--color-flame)] border border-[var(--color-flame)]/25",
    blue: "bg-[var(--color-info-muted)] text-[var(--color-info)] border border-[var(--color-info)]/25",
    secondary: "bg-[var(--color-primary-muted)] text-[var(--color-primary)] border border-[var(--color-border-strong)]",
    dark: "bg-[var(--color-text)] text-white",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", variants[variant], className)} {...props} />
  )
}

export const Card = ({ className, ...props }) => (
  <div className={cn("rounded-2xl border bg-[var(--color-surface)] shadow-sm", className)} {...props} />
)
export const CardHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
)
export const CardTitle = ({ className, ...props }) => (
  <h3 className={cn("font-semibold leading-none tracking-tight text-[var(--color-text)]", className)} {...props} />
)
export const CardContent = ({ className, ...props }) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
)

export const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-transparent transition-all",
      className
    )}
    {...props}
  />
))

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-transparent transition-all resize-none",
      className
    )}
    {...props}
  />
))

export const Label = ({ className, ...props }) => (
  <label className={cn("text-sm font-medium text-[var(--color-text-secondary)] leading-none", className)} {...props} />
)

export const Table = ({ className, ...props }) => (
  <div className="w-full overflow-x-auto">
    <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
)
export const TableHeader = ({ ...props }) => <thead {...props} />
export const TableBody = ({ ...props }) => <tbody {...props} />
export const TableRow = ({ className, ...props }) => (
  <tr className={cn("border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-primary-muted)]/40", className)} {...props} />
)
export const TableHead = ({ className, ...props }) => (
  <th className={cn("h-11 px-4 text-left align-middle font-medium text-[var(--color-muted)] text-xs uppercase tracking-wide whitespace-nowrap", className)} {...props} />
)
export const TableCell = ({ className, ...props }) => (
  <td className={cn("px-4 py-3 align-middle text-[var(--color-text)]", className)} {...props} />
)

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close
export const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)}
    {...props}
  />
))
export const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 bg-[var(--color-surface)] p-6 shadow-2xl rounded-2xl border border-[var(--color-border)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1 opacity-70 hover:opacity-100 hover:bg-[var(--color-border)] transition-all">
        <X className="h-4 w-4 text-[var(--color-text)]" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
export const DialogHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5", className)} {...props} />
)
export const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-[var(--color-text)]", className)} {...props} />
))
export const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-[var(--color-muted)]", className)} {...props} />
))

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value
export const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
export const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
export const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 px-3 text-sm text-[var(--color-text)] outline-none hover:bg-[var(--color-primary-muted)] focus:bg-[var(--color-primary-muted)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
