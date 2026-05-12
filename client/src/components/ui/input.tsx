import * as React from "react"

import { cn } from "@/lib/utils"

// Native date / time pickers in Chromium only open when the user clicks the
// tiny calendar icon at the right edge of the input — clicking the value
// area does nothing. We force the picker open on any click (and on focus
// for keyboard users) so the whole field acts as the trigger.
const PICKER_TYPES = new Set(["date", "datetime-local", "month", "time", "week"])

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onClick, onFocus, ...props }, ref) => {
    const isPicker = !!type && PICKER_TYPES.has(type)

    const tryShowPicker = (el: HTMLInputElement) => {
      if (el.disabled || el.readOnly) return
      try {
        // showPicker is supported in modern Chrome/Edge/Firefox/Safari; older
        // browsers fall back to clicking the native icon as before.
        (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
      } catch {
        // Some browsers throw if the input isn't user-activated yet — ignore.
      }
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isPicker && "cursor-pointer",
          className
        )}
        ref={ref}
        onClick={(e) => {
          onClick?.(e)
          if (isPicker && !e.defaultPrevented) tryShowPicker(e.currentTarget)
        }}
        onFocus={(e) => {
          onFocus?.(e)
          if (isPicker && !e.defaultPrevented) tryShowPicker(e.currentTarget)
        }}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
