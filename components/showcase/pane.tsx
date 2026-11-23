"use client"

import * as React from "react"
import { SlidersHorizontalIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Which tuner: the system's tokens, or an entry's tuning (the entry pane and entry page share it). */
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

/** Whether a tuner is showing, remembered per browser. Shown until the person hides it. */
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

// The card fits its contents up to the pane's height. Its sections scroll on
// their own (see the inspector panel), so the card itself never scrolls.
const floatingTuner =
  "absolute top-3 z-20 max-h-[calc(100%-1.5rem)] w-88 bg-popover text-popover-foreground shadow-lg"

/** The width of an element's vertical scrollbar, kept current as it resizes. */
function useScrollbarWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(element.offsetWidth - element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    // Content changes can add or remove the scrollbar without a resize.
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/**
 * A column of the showcase: a header bar, a body that scrolls on its own, and
 * a tuner that floats over the body's top-right corner, toggled from the
 * header. The tuner may cover content, never the pane's controls; hide it to
 * see everything.
 */
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
  /** Renders the tuner with the classes that make it float. */
  tuner: (className: string) => React.ReactNode
  tunerOpen: boolean
  onTunerOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const scrollbar = useScrollbarWidth(scrollRef)
  return (
    // overflow-clip, not hidden: the resizable panel around a pane scrolls
    // anything that spills out of it, and a hidden-overflow box can still be
    // scrolled by focus or scrollIntoView. Either would slide the whole pane,
    // header included. Clip can't be scrolled at all.
    <section aria-label={label} className="flex h-full min-w-0 flex-col overflow-clip">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b pr-2 pl-4">
        {/* Plain text: the page's own h1 names it for assistive tech. */}
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
        {/* relative: absolutely positioned content (sr-only text, popups)
            stays inside the scroller instead of spilling out of the pane. */}
        <div ref={scrollRef} className="@container relative h-full overflow-y-auto overscroll-contain">
          {children}
        </div>
        {tunerOpen ? (
          // Over the content but never over the pane's scrollbar: it sits
          // 12px in from the bar, and narrows with the pane.
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
