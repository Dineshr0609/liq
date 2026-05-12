import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format, parse, isValid } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerInputProps {
  /** ISO date string (YYYY-MM-DD) — same shape as <input type="date">. */
  value?: string | null
  /** Fires with an ISO date string (YYYY-MM-DD), or "" when cleared. */
  onChange?: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  "data-testid"?: string
}

const ISO = "yyyy-MM-dd"
const DISPLAY = "MM/dd/yyyy"

function parseIso(value?: string | null): Date | undefined {
  if (!value) return undefined
  const d = parse(value, ISO, new Date())
  return isValid(d) ? d : undefined
}

/**
 * Drop-in replacement for `<Input type="date">` that opens a real popover
 * calendar instead of relying on the browser's native date picker, which
 * silently fails to open inside sandboxed preview iframes.
 */
export function DatePickerInput({
  value,
  onChange,
  className,
  placeholder = "mm/dd/yyyy",
  disabled,
  id,
  "data-testid": testId,
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseIso(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-testid={testId}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selected ? format(selected, DISPLAY) : placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 opacity-60 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange?.(d ? format(d, ISO) : "")
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
