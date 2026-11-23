"use client"

import * as React from "react"
import { SlidersHorizontalIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type TunerKey = "tokens" | "entry"

const storageKey = (key: TunerKey) => `unending:tuner-open:${key}`
const listeners = new Set<() => void>()
const subscribe = (notify: () => void) => {
  listeners.add(notify)
  window.addEventListener("storage", notify)
  return () => {
    listeners.delete(notify)
    window.removeEventListener("storage", notify)
  }
}
const read = (key: TunerKey) => {
  try {
    return localStorage.getItem(storageKey(key)) !== "0"
  } catch {
    return true
  }
}

export function useTunerOpen(key: TunerKey) {
  const open = React.useSyncExternalStore(
    subscribe,
    () => read(key),
    () => true
  )
  const setOpen = React.useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(storageKey(key), next ? "1" : "0")
      } catch {}
      listeners.forEach((notify) => notify())
    },
    [key]
  )
  return [open, setOpen] as const
}

const floatingTuner =
  "absolute top-3 z-20 max-h-[calc(100%-1.5rem)] w-88 bg-popover text-popover-foreground shadow-lg"

function useScrollbarWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(element.offsetWidth - element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [ref])
  return width
}

export function Pane({
  label,
  title,
  badge,
  actions,
  tuner,
  tunerOpen,
  onTunerOpenChange,
  children,
}: {
  label: string
  title: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  tuner: (className: string) => React.ReactNode
  tunerOpen: boolean
  onTunerOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const scrollbar = useScrollbarWidth(scrollRef)
  return (
    <section aria-label={label} className="flex h-full min-w-0 flex-col overflow-clip">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b pr-2 pl-4">
        <span className="truncate text-sm font-medium">{title}</span>
        {badge}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <PaneButton
            label="Tuning"
            aria-pressed={tunerOpen}
            className="aria-pressed:bg-muted"
            onClick={() => onTunerOpenChange(!tunerOpen)}
          >
            <SlidersHorizontalIcon />
          </PaneButton>
          {actions}
        </div>
      </header>
      <div
        className="relative min-h-0 flex-1"
        style={{ "--pane-scrollbar": `${scrollbar}px` } as React.CSSProperties}
      >
        <div ref={scrollRef} className="@container relative h-full overflow-y-auto overscroll-contain">
          {children}
        </div>
        {tunerOpen ? (
          tuner(
            `${floatingTuner} right-[calc(var(--pane-scrollbar)+0.75rem)] max-w-[calc(100%-var(--pane-scrollbar)-1.5rem)]`
          )
        ) : null}
      </div>
    </section>
  )
}

export function PaneButton({
  label,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} className={cn(className)} {...props} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
