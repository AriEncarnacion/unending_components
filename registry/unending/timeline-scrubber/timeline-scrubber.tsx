"use client"

import * as React from "react"
import { cn } from "cn"
import { RotateCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEntryTuning } from "@/lib/tuning"

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type TimelineEvent = {
  id: string
  /** Epoch milliseconds. */
  start: number
  /** Epoch milliseconds, exclusive. */
  end: number
  label: string
  /** Replaces part of another event. Drawn with a dashed edge. */
  override?: boolean
  /** One of the five chart colors, to tell people or kinds apart. */
  tone?: 1 | 2 | 3 | 4 | 5
}

export type TimelineLane = {
  id: string
  label: string
  events: TimelineEvent[]
  /** Shown in place of events when none are in view. */
  emptyLabel?: string
}

export type TimelineScrubberProps = Omit<
  React.ComponentProps<"section">,
  "onChange" | "defaultValue"
> & {
  lanes: TimelineLane[]
  /** The present moment. Defaults to the clock, ticking every 15 seconds. */
  now?: number
  /** How much time the track shows at once, in ms. Defaults to 14 days. */
  span?: number
  /** How far either side of now the scrubber can travel. Defaults to 90 days. */
  range?: number
  /** The moment under the playhead (controlled). */
  value?: number
  /** The moment under the playhead at first render. Defaults to now. */
  defaultValue?: number
  onValueChange?: (time: number) => void
  /** Settle on the nearest event edge after a drag or flick. Defaults to true. */
  snapToEdges?: boolean
  formatTime?: (time: number) => string
  /** Replaces the per-lane summary below the track. */
  renderDetail?: (
    lane: TimelineLane,
    event: TimelineEvent | undefined,
    at: number,
    now: number
  ) => React.ReactNode
}

const toneClass: Record<NonNullable<TimelineEvent["tone"]>, string> = {
  1: "shadow-[inset_3px_0_0_var(--color-chart-1)]",
  2: "shadow-[inset_3px_0_0_var(--color-chart-2)]",
  3: "shadow-[inset_3px_0_0_var(--color-chart-3)]",
  4: "shadow-[inset_3px_0_0_var(--color-chart-4)]",
  5: "shadow-[inset_3px_0_0_var(--color-chart-5)]",
}

const readoutFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
const longFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
const dayFormat = new Intl.DateTimeFormat(undefined, { day: "numeric" })
const monthDayFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

function midnight(time: number) {
  return new Date(time).setHours(0, 0, 0, 0)
}

function covers(event: TimelineEvent, time: number) {
  return event.start <= time && time < event.end
}

function overlaps(event: TimelineEvent, start: number, end: number) {
  return event.start < end && event.end > start
}

function describeRemaining(event: TimelineEvent, now: number) {
  const difference =
    now < event.start ? event.start - now : Math.abs(event.end - now)
  const hours = Math.round(difference / HOUR)
  const days = Math.floor(hours / 24)
  const duration = days ? `${days}d ${hours % 24}h` : `${hours}h`
  if (now < event.start) return `Starts in ${duration}`
  if (now >= event.end) return `Ended ${duration} ago`
  return `${duration} left`
}

/**
 * Splits base events around overrides so each moment has exactly one owner.
 * Use it for rotations where someone covers part of another person's slot.
 */
export function withOverrides(
  events: TimelineEvent[],
  overrides: TimelineEvent[]
): TimelineEvent[] {
  let result = events.map((event) => ({ ...event }))
  for (const override of overrides) {
    const next: TimelineEvent[] = []
    for (const event of result) {
      if (!overlaps(event, override.start, override.end)) {
        next.push(event)
        continue
      }
      if (event.start < override.start)
        next.push({ ...event, id: `${event.id}:before`, end: override.start })
      if (event.end > override.end)
        next.push({ ...event, id: `${event.id}:after`, start: override.end })
    }
    next.push({ ...override, override: true })
    result = next
  }
  return result.sort((a, b) => a.start - b.start)
}

let clockTime = Date.now()
function subscribeClock(notify: () => void) {
  clockTime = Date.now()
  const interval = window.setInterval(() => {
    clockTime = Date.now()
    notify()
  }, 15_000)
  return () => window.clearInterval(interval)
}

function useClock(fixed: number | undefined) {
  const clock = React.useSyncExternalStore<number | null>(
    subscribeClock,
    () => clockTime,
    () => null
  )
  return fixed ?? clock
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"
function subscribeReducedMotion(notify: () => void) {
  const media = window.matchMedia(reducedMotionQuery)
  media.addEventListener("change", notify)
  return () => media.removeEventListener("change", notify)
}

function useReducedMotion() {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false
  )
}

type Drag = {
  id: number
  originX: number
  originCenter: number
  lastX: number
  lastTime: number
  velocity: number
  moved: boolean
}

function TimelineScrubber({
  lanes,
  now: nowProp,
  span: spanProp,
  range = 90 * DAY,
  value,
  defaultValue,
  onValueChange,
  snapToEdges = true,
  formatTime = (time) => readoutFormat.format(time),
  renderDetail,
  className,
  ...props
}: TimelineScrubberProps) {
  const tuning = useEntryTuning("timeline-scrubber", {
    spanDays: 14,
    glideMinMs: 320,
    glideMaxMs: 700,
    snapPercent: 4,
    flickCarry: 200,
  })
  const span = spanProp ?? tuning.spanDays * DAY
  const { glideMinMs, glideMaxMs, snapPercent, flickCarry } = tuning
  const now = useClock(nowProp)
  const reduceMotion = useReducedMotion()
  const [internal, setInternal] = React.useState<number | undefined>(
    defaultValue
  )
  const center = value ?? internal ?? now ?? 0
  const current = React.useRef(center)
  React.useLayoutEffect(() => {
    current.current = center
  }, [center])

  const track = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<Drag | undefined>(undefined)
  const frame = React.useRef<number | undefined>(undefined)
  const wheelTimer = React.useRef<number | undefined>(undefined)
  const [dragging, setDragging] = React.useState(false)
  const [keyboardTarget, setKeyboardTarget] = React.useState<number>()

  const min = now === null ? 0 : midnight(now - range + DAY / 2)
  const max = now === null ? 0 : midnight(now + range + DAY / 2)
  const renderRadius = span * 0.6

  const edges = React.useMemo(
    () => lanes.flatMap((lane) => lane.events.flatMap((e) => [e.start, e.end])),
    [lanes]
  )

  const clamp = React.useCallback(
    (time: number) => Math.max(min, Math.min(max, time)),
    [min, max]
  )

  const moveTo = React.useCallback(
    (time: number) => {
      const next = clamp(time)
      current.current = next
      if (value === undefined) setInternal(next)
      onValueChange?.(next)
    },
    [clamp, onValueChange, value]
  )

  const stop = React.useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    window.clearTimeout(wheelTimer.current)
    frame.current = undefined
  }, [])

  const animateTo = React.useCallback(
    (target: number, duration?: number, fromKeyboard = false) => {
      stop()
      const start = current.current
      const end = clamp(target)
      if (reduceMotion || start === end) {
        setKeyboardTarget(undefined)
        moveTo(end)
        return
      }
      setKeyboardTarget(fromKeyboard ? end : undefined)
      const began = performance.now()
      const length =
        duration ?? Math.min(glideMaxMs, glideMinMs + (Math.abs(end - start) / span) * 400)
      const step = (time: number) => {
        const progress = Math.max(0, Math.min(1, (time - began) / length))
        if (progress === 1) {
          frame.current = undefined
          moveTo(end)
          setKeyboardTarget(undefined)
          return
        }
        moveTo(start + (end - start) * (1 - (1 - progress) ** 3))
        frame.current = requestAnimationFrame(step)
      }
      frame.current = requestAnimationFrame(step)
    },
    [clamp, moveTo, reduceMotion, span, stop, glideMinMs, glideMaxMs]
  )

  const snap = React.useCallback(
    (target: number) => {
      const time = clamp(target)
      if (!snapToEdges || now === null) return time
      let closest = now
      for (const edge of edges)
        if (Math.abs(edge - time) < Math.abs(closest - time)) closest = edge
      return Math.abs(closest - time) <= span * (snapPercent / 100) ? closest : time
    },
    [clamp, edges, now, snapToEdges, span, snapPercent]
  )

  React.useEffect(() => stop, [stop])

  React.useEffect(() => {
    const element = track.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.shiftKey
            ? event.deltaY
            : 0
      if (!delta || !element.clientWidth || drag.current?.moved) return
      event.preventDefault()
      stop()
      setKeyboardTarget(undefined)
      moveTo(current.current + (delta / element.clientWidth) * span)
      wheelTimer.current = window.setTimeout(() => {
        const target = snap(current.current)
        if (target !== current.current) animateTo(target, 320)
      }, 140)
    }
    element.addEventListener("wheel", wheel, { passive: false })
    return () => element.removeEventListener("wheel", wheel)
  }, [animateTo, moveTo, snap, span, stop])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current) return
    stop()
    setKeyboardTarget(undefined)
    drag.current = {
      id: event.pointerId,
      originX: event.clientX,
      originCenter: current.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
      moved: false,
    }
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = drag.current
    const width = track.current?.clientWidth ?? 0
    if (!active || active.id !== event.pointerId || !width) return
    const delta = event.clientX - active.originX
    if (!active.moved) {
      if (Math.abs(delta) <= 4) return
      active.moved = true
      event.currentTarget.setPointerCapture?.(event.pointerId)
      setDragging(true)
    }
    const time = performance.now()
    const traveled = ((active.lastX - event.clientX) / width) * span
    const instantaneous = traveled / Math.max(1, time - active.lastTime)
    active.velocity = active.velocity * 0.6 + instantaneous * 0.4
    active.lastX = event.clientX
    active.lastTime = time
    moveTo(active.originCenter - (delta / width) * span)
  }
  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = drag.current
    if (!active || active.id !== event.pointerId) return
    drag.current = undefined
    if (!active.moved) return
    setDragging(false)
    const velocity =
      performance.now() - active.lastTime < 80 ? active.velocity : 0
    const carry = Math.max(-span, Math.min(span, velocity * flickCarry))
    animateTo(snap(current.current + carry))
  }

  if (now === null) {
    return (
      <section
        data-slot="timeline-scrubber"
        aria-busy="true"
        className={cn("flex flex-col gap-3", className)}
        {...props}
      >
        <div className="h-7" />
        {lanes.map((lane) => (
          <div key={lane.id} className="h-10 animate-pulse rounded-md bg-muted" />
        ))}
      </section>
    )
  }

  const position = (time: number) => 50 + ((time - center) / span) * 100
  const nowPosition = position(now)
  const showNowMarker =
    Math.abs(nowPosition - 50) > 0.6 && nowPosition >= 4 && nowPosition <= 96
  const awayFromNow = Math.abs(center - now) >= 60_000

  const ticks: React.ReactNode[] = []
  const windowStart = center - renderRadius
  const windowEnd = center + renderRadius
  const today = midnight(now)
  for (
    const day = new Date(midnight(windowStart));
    day.getTime() <= windowEnd;
    day.setDate(day.getDate() + 1)
  ) {
    const time = day.getTime()
    const first = day.getDate() === 1
    if (time >= windowStart)
      ticks.push(
        <span
          key={time}
          data-today={time === today || undefined}
          data-first={first || undefined}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-1 font-mono text-xs text-muted-foreground tabular-nums data-first:font-medium data-first:text-foreground data-today:font-medium data-today:text-primary"
          style={{ left: `${position(time)}%` }}
        >
          {first ? monthDayFormat.format(day) : dayFormat.format(day)}
        </span>
      )
    for (const hour of [6, 12, 18]) {
      const marker = new Date(time).setHours(hour)
      if (marker >= windowStart && marker <= windowEnd)
        ticks.push(
          <span
            key={marker}
            className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
            style={{ left: `${position(marker)}%` }}
          />
        )
    }
  }

  type Row = { kind: "lane"; lane: TimelineLane } | { kind: "ticks" }
  const rows: Row[] = lanes.flatMap((lane, index): Row[] =>
    index === 0
      ? [{ kind: "lane", lane }, { kind: "ticks" }]
      : [{ kind: "lane", lane }]
  )

  const fade =
    "[mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]"

  return (
    <section
      data-slot="timeline-scrubber"
      className={cn("flex min-w-0 flex-col gap-4", className)}
      {...props}
    >
      <div className="flex min-h-8 items-center justify-between gap-2">
        <Badge
          variant="outline"
          className="h-7 px-2.5 font-mono text-xs tabular-nums"
        >
          {formatTime(center)}
        </Badge>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-hidden={!awayFromNow}
          tabIndex={awayFromNow ? 0 : -1}
          disabled={!awayFromNow}
          onClick={() => animateTo(now)}
          className="transition-opacity disabled:opacity-0"
        >
          <RotateCcwIcon data-icon="inline-start" />
          Now
        </Button>
      </div>

      <div
        data-slot="timeline-scrubber-track"
        data-dragging={dragging || undefined}
        className="flex cursor-grab touch-pan-y gap-3 select-none data-dragging:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onPointerLeave={(event) => {
          if (drag.current?.id === event.pointerId && !drag.current.moved)
            drag.current = undefined
        }}
      >
        <div aria-hidden="true" className="flex w-20 shrink-0 flex-col gap-1.5 sm:w-28">
          {rows.map((row) =>
            row.kind === "ticks" ? (
              <span key="ticks" className="h-6" />
            ) : (
              <span
                key={row.lane.id}
                className="flex h-10 items-center truncate text-sm text-muted-foreground"
              >
                {row.lane.label}
              </span>
            )
          )}
        </div>
        <div ref={track} className="relative flex min-w-0 flex-1 flex-col gap-1.5">
          {rows.map((row) => {
            if (row.kind === "ticks")
              return (
                <div
                  key="ticks"
                  aria-hidden="true"
                  className={cn("relative h-6 overflow-hidden", fade)}
                >
                  {ticks}
                </div>
              )
            const lane = row.lane
            const visible = lane.events.filter((e) =>
              overlaps(e, windowStart, windowEnd)
            )
            const inView = visible.some((e) =>
              overlaps(e, center - span / 2, center + span / 2)
            )
            return (
              <div
                key={lane.id}
                role="group"
                aria-label={lane.label}
                className={cn(
                  "relative h-10 overflow-hidden [container-type:inline-size]",
                  fade
                )}
              >
                {!inView && (
                  <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                    {lane.emptyLabel ?? "Nothing in this range"}
                  </span>
                )}
                {visible.map((event) => {
                  const left = position(event.start)
                  const right = position(event.end)
                  const active = covers(event, center)
                  return (
                    <Tooltip key={event.id}>
                      <TooltipTrigger
                        render={<div />}
                        data-active={active || undefined}
                        data-override={event.override || undefined}
                        className={cn(
                          "absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-md text-sm whitespace-nowrap transition-colors",
                          "bg-muted text-muted-foreground",
                          event.tone && toneClass[event.tone],
                          "data-active:bg-primary data-active:font-medium data-active:text-primary-foreground data-active:shadow-none",
                          "data-override:border data-override:border-dashed data-override:border-primary"
                        )}
                        style={{
                          left: `calc(${left}% + 1px)`,
                          width: `max(0px, calc(${right - left}% - 2px))`,
                        }}
                      >
                        <span
                          className="truncate"
                          style={{
                            paddingLeft: `calc(${Math.max(0, 14 - left)}cqw + 0.75rem)`,
                            paddingRight: `calc(${Math.max(0, right - 86)}cqw + 0.75rem)`,
                          }}
                        >
                          {event.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {event.label}
                        {event.override ? " · override" : ""} ·{" "}
                        {formatTime(event.start)} – {formatTime(event.end)}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            )
          })}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-y-1 left-1/2 w-0.5 -translate-x-1/2 bg-primary"
          />
          {showNowMarker && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-y-1 border-l border-dashed border-muted-foreground/60"
              style={{ left: `${nowPosition}%` }}
            />
          )}
        </div>
      </div>

      <Slider
        aria-label={`Hours from now. Showing ${longFormat.format(center)}`}
        min={Math.round((min - now) / HOUR)}
        max={Math.round((max - now) / HOUR)}
        step={1}
        largeStep={24}
        format={{ style: "unit", unit: "hour", signDisplay: "exceptZero" }}
        value={Math.round(((keyboardTarget ?? center) - now) / HOUR)}
        onValueChange={(next, details) => {
          const hours = Array.isArray(next) ? next[0] : next
          const time = now + hours * HOUR
          if (details.reason === "keyboard" || details.reason === "track-press")
            animateTo(time, 280, true)
          else {
            stop()
            moveTo(time)
          }
        }}
      />

      <dl className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {lanes.map((lane) => {
          const event = lane.events.find((e) => covers(e, center))
          if (renderDetail)
            return (
              <React.Fragment key={lane.id}>
                {renderDetail(lane, event, center, now)}
              </React.Fragment>
            )
          return (
            <div key={lane.id} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">{lane.label}</dt>
              <dd className="truncate font-medium">
                {event
                  ? event.label + (event.override ? " (override)" : "")
                  : "No one"}
              </dd>
              <dd className="font-mono text-xs text-muted-foreground tabular-nums">
                {event
                  ? `${formatTime(event.start)} – ${formatTime(event.end)}`
                  : " "}
              </dd>
              <dd className="text-xs text-primary">
                {event ? describeRemaining(event, now) : " "}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

export { TimelineScrubber }
