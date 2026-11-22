"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, ClockIcon, GripHorizontalIcon, Undo2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd } from "@/components/ui/kbd"
import { useEntryTuning } from "@/lib/tuning"

/* ------------------------------------------------------------------ */
/* Gesture: distance commits, direction comes from cones with neutral */
/* gaps. Screen space: +x is right, +y is down.                        */
/* ------------------------------------------------------------------ */

export type ReviewDirection = "left" | "down" | "right"

export type ReviewGesture = {
  /** Movement below this many pixels is ignored. */
  deadZone: number
  /** Distance from origin at which a release decides. */
  commitDistance: number
  /** Half-width in degrees of the neutral gaps at 45°, 135° and 270°. */
  angleBuffer: number
}

const DEFAULT_GESTURE: ReviewGesture = { deadZone: 18, commitDistance: 110, angleBuffer: 7.5 }

export function classifyGesture(x: number, y: number, gesture: ReviewGesture = DEFAULT_GESTURE) {
  const distance = Math.hypot(x, y)
  const progress = Math.max(
    0,
    Math.min(1, (distance - gesture.deadZone) / (gesture.commitDistance - gesture.deadZone))
  )
  if (distance < gesture.deadZone)
    return { direction: null, distance, progress: 0, ready: false }
  const angle = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  const b = gesture.angleBuffer
  let direction: ReviewDirection | null = null
  if (angle > 45 + b && angle < 135 - b) direction = "down"
  else if (angle > 135 + b && angle < 270 - b) direction = "left"
  else if (angle > 270 + b || angle < 45 - b) direction = "right"
  return { direction, distance, progress, ready: direction !== null && progress >= 1 }
}

function renderedPose(x: number, y: number) {
  const px = Math.max(-210, Math.min(210, x))
  const py = Math.max(-170, Math.min(170, y))
  return { x: px, y: py, rotation: px / 32 }
}

const unit: Record<ReviewDirection, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
}

/* ------------------------------------------------------------------ */
/* Actions, copy and decisions                                         */
/* ------------------------------------------------------------------ */

export type DecisionValue = boolean | null

export type ReviewAction<A extends string = string> = {
  id: A
  direction: ReviewDirection
  label: string
  /** Defaults to true for left, null for down and false for right. */
  value?: DecisionValue
  /** One printable key, matched case-insensitively. */
  shortcut?: string
  icon?: React.ReactNode
  disabled?: boolean
}

export type DefaultActionId = "accept" | "defer" | "dismiss"

export type ReviewDecision<T, A extends string = DefaultActionId> = {
  item: T
  itemId: string
  action: A
  value: DecisionValue
  direction: ReviewDirection
  source: "button" | "keyboard" | "drag"
}

export type ReviewTerms = {
  positive: string
  negative: string
  later: string
  item: { singular: string; plural: string }
}

export type ReviewCopy = {
  region: string
  dragHandle: string
  instructions: string
  waiting: string
  empty: string
  error: string
  undo: string
  undoError: string
  remaining: (count: number) => string
  decided: (label: string) => string
}

const defaultTerms: ReviewTerms = {
  positive: "Yes",
  negative: "No",
  later: "Save for later",
  item: { singular: "item", plural: "items" },
}

export function createReviewActions(
  terms: Partial<ReviewTerms> = {}
): ReviewAction<DefaultActionId>[] {
  const t = { ...defaultTerms, ...terms }
  return [
    { id: "accept", direction: "left", label: t.positive, shortcut: "F", icon: <CheckIcon /> },
    { id: "defer", direction: "down", label: t.later, shortcut: "Q", icon: <ClockIcon /> },
    { id: "dismiss", direction: "right", label: t.negative, shortcut: "J", icon: <XIcon /> },
  ]
}

const defaultValue: Record<ReviewDirection, DecisionValue> = { left: true, down: null, right: false }

const tone: Record<ReviewDirection, { tint: string; ink: string; button: "default" | "secondary" | "destructive" }> = {
  left: { tint: "bg-primary/10", ink: "text-primary", button: "default" },
  down: { tint: "bg-muted", ink: "text-muted-foreground", button: "secondary" },
  right: { tint: "bg-destructive/10", ink: "text-destructive", button: "destructive" },
}

export type ReviewDeckProps<T, A extends string = DefaultActionId> = {
  /** Controlled queue; items[0] is the active card. Remove it once onDecision succeeds. */
  items: readonly T[]
  getItemId: (item: T) => string
  renderCard: (item: T) => React.ReactNode
  /** May return a promise. A rejection restores the card and asks to retry. */
  onDecision: (decision: ReviewDecision<T, A>) => void | Promise<void>
  /** Restore your previous recorded choice and put its item back at the front. */
  onUndo?: () => void | Promise<void>
  canUndo?: boolean
  actions?: readonly ReviewAction<A>[]
  terms?: Partial<ReviewTerms>
  copy?: Partial<ReviewCopy>
  emptyState?: React.ReactNode
  gesture?: Partial<ReviewGesture>
  disabled?: boolean
  className?: string
}

type Pose = { x: number; y: number; rotation: number; opacity: number; animate: boolean }
const REST: Pose = { x: 0, y: 0, rotation: 0, opacity: 1, animate: false }

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest('[role="textbox"],[role="combobox"]') !== null
  )
}

function isInteractive(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest('a,button,input,textarea,select,label,[contenteditable],[data-review-no-drag]') !== null
  )
}

function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)")
      media.addEventListener("change", notify)
      return () => media.removeEventListener("change", notify)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
}

function ReviewDeck<T, A extends string = DefaultActionId>({
  items,
  getItemId,
  renderCard,
  onDecision,
  onUndo,
  canUndo = false,
  actions: actionsProp,
  terms: termsProp,
  copy: copyProp,
  emptyState,
  gesture: gestureProp,
  disabled = false,
  className,
}: ReviewDeckProps<T, A>) {
  const tuning = useEntryTuning("review-deck", {
    flightMs: 180,
    flightEase: "cubic-bezier(0.2, 0, 0, 1)",
    flightDistance: 260,
    commitDistance: 110,
    deadZone: 18,
  })
  const terms = { ...defaultTerms, ...termsProp }
  const actions = (actionsProp ?? createReviewActions(terms)) as readonly ReviewAction<A>[]
  const gesture = {
    ...DEFAULT_GESTURE,
    commitDistance: tuning.commitDistance,
    deadZone: tuning.deadZone,
    ...gestureProp,
  }
  const byDirection = (direction: ReviewDirection) =>
    actions.find((action) => action.direction === direction)
  const hint = actions
    .map((action) => `${action.direction === "down" ? "down" : action.direction} for ${action.label}`)
    .join(", ")
  const copy: ReviewCopy = {
    region: `Review ${terms.item.plural}`,
    dragHandle: "Drag to decide",
    instructions: `Drag the card ${hint}, or use the buttons or their keys.`,
    waiting: `Waiting for the next ${terms.item.singular}…`,
    empty: `No ${terms.item.plural} left to review.`,
    error: "That decision wasn’t saved. Try again.",
    undo: "Undo",
    undoError: "Undo didn’t go through. Try again.",
    remaining: (count) =>
      `${count} ${count === 1 ? terms.item.singular : terms.item.plural} left`,
    decided: (label) => `${label}.`,
    ...copyProp,
  }

  const reduceMotion = usePrefersReducedMotion()
  const instructionsId = React.useId()
  const active = items[0]
  const activeId = active === undefined ? undefined : getItemId(active)

  const [pose, setPose] = React.useState<Pose>(REST)
  const [drag, setDrag] = React.useState<{ id: number; startX: number; startY: number } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [decidedId, setDecidedId] = React.useState<string>()
  const [outgoing, setOutgoing] = React.useState<{ item: T; pose: Pose } | null>(null)
  const [error, setError] = React.useState<string>()
  const [announcement, setAnnouncement] = React.useState("")

  // A new first item ends the previous decision's lock.
  const [seenId, setSeenId] = React.useState(activeId)
  if (seenId !== activeId) {
    setSeenId(activeId)
    setDecidedId(undefined)
    setPose(REST)
  }

  const waiting = activeId !== undefined && decidedId === activeId
  const locked = disabled || busy || waiting || outgoing !== null

  const current = drag ? classifyGesture(pose.x, pose.y, gesture) : null
  const dragAction = current?.direction ? byDirection(current.direction) : undefined

  const decide = async (
    direction: ReviewDirection,
    source: ReviewDecision<T, A>["source"],
    from: Pose = REST
  ) => {
    const action = byDirection(direction)
    if (!action || action.disabled || locked || active === undefined || activeId === undefined) return
    const item = active
    const vector = unit[direction]
    const length = Math.hypot(from.x, from.y)
    const along = length > 0 ? { x: from.x / length, y: from.y / length } : vector
    const flight: Pose = {
      x: from.x + along.x * tuning.flightDistance,
      y: from.y + along.y * tuning.flightDistance,
      rotation: from.rotation + along.x * 6,
      opacity: 0,
      animate: true,
    }
    setError(undefined)
    setBusy(true)
    setDecidedId(activeId)
    if (!reduceMotion) {
      setOutgoing({ item, pose: from })
      requestAnimationFrame(() => setOutgoing({ item, pose: flight }))
      window.setTimeout(() => setOutgoing(null), tuning.flightMs)
    }
    setPose(REST)
    try {
      await onDecision({
        item,
        itemId: activeId,
        action: action.id,
        value: action.value === undefined ? defaultValue[direction] : action.value,
        direction,
        source,
      })
      setAnnouncement(copy.decided(action.label))
    } catch {
      setDecidedId(undefined)
      setOutgoing(null)
      setError(copy.error)
      setAnnouncement(copy.error)
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!onUndo || !canUndo || busy) return
    setBusy(true)
    setError(undefined)
    try {
      await onUndo()
      setAnnouncement(`${copy.undo}.`)
    } catch {
      setError(copy.undoError)
      setAnnouncement(copy.undoError)
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat || event.nativeEvent.isComposing) return
    if (event.ctrlKey || event.altKey || event.metaKey || isEditable(event.target)) return
    if (event.key === "Escape" && drag) {
      setDrag(null)
      setPose({ ...REST, animate: true })
      return
    }
    const key = event.key.toLowerCase()
    if (onUndo && key === "z") {
      event.preventDefault()
      void undo()
      return
    }
    const action = actions.find((candidate) => candidate.shortcut?.toLowerCase() === key)
    if (action) {
      event.preventDefault()
      void decide(action.direction, "keyboard")
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked || event.button !== 0 || isInteractive(event.target)) return
    // Touch and pen drag only from the grip, so card content keeps native scrolling.
    if (event.pointerType !== "mouse" && !(event.target as HTMLElement).closest("[data-review-grip]"))
      return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ id: event.pointerId, startX: event.clientX, startY: event.clientY })
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.id !== event.pointerId) return
    const x = event.clientX - drag.startX
    const y = event.clientY - drag.startY
    setPose({ x, y, rotation: renderedPose(x, y).rotation, opacity: 1, animate: false })
  }
  const endDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!drag || drag.id !== event.pointerId) return
    setDrag(null)
    const result = classifyGesture(pose.x, pose.y, gesture)
    if (!cancelled && result.ready && result.direction) {
      const rendered = renderedPose(pose.x, pose.y)
      void decide(result.direction, "drag", { ...rendered, opacity: 1, animate: false })
    } else {
      setPose({ ...REST, animate: true })
    }
  }

  React.useEffect(() => {
    if (!drag) return
    const cancel = () => {
      setDrag(null)
      setPose({ ...REST, animate: true })
    }
    window.addEventListener("blur", cancel)
    return () => window.removeEventListener("blur", cancel)
  }, [drag])

  const rendered = renderedPose(pose.x, pose.y)
  const cardStyle = (p: Pose): React.CSSProperties => ({
    transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`,
    opacity: p.opacity,
    transition:
      p.animate && !reduceMotion
        ? `transform ${tuning.flightMs}ms ${tuning.flightEase}, opacity ${tuning.flightMs}ms ease-out`
        : undefined,
  })

  const ring = 2 * Math.PI * 22

  return (
    <div
      role="region"
      aria-label={copy.region}
      aria-describedby={instructionsId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-slot="review-deck"
      className={cn(
        "flex min-h-[30rem] flex-col gap-4 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <p id={instructionsId} className="sr-only">
        {copy.instructions}
      </p>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>

      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground tabular-nums">
          {items.length > 0 ? copy.remaining(items.length) : null}
        </span>
        {onUndo ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canUndo || busy}
            onClick={() => void undo()}
          >
            <Undo2Icon data-icon="inline-start" />
            {copy.undo}
            <Kbd className="ml-1 max-sm:hidden">Z</Kbd>
          </Button>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1">
        {active === undefined && !outgoing ? (
          emptyState ?? (
            <Empty className="h-full border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckIcon />
                </EmptyMedia>
                <EmptyTitle>All done</EmptyTitle>
                <EmptyDescription>{copy.empty}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        ) : null}

        {items.length > 1 ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 translate-y-2 scale-[0.97] rounded-xl border bg-muted/60"
          />
        ) : null}

        {active !== undefined && !waiting ? (
          <Card
            key={activeId}
            data-dragging={drag ? true : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            onLostPointerCapture={(event) => endDrag(event, true)}
            className="absolute inset-0 cursor-grab touch-pan-y gap-0 overflow-hidden py-0 select-none data-dragging:cursor-grabbing"
            style={cardStyle({ ...pose, ...(drag ? rendered : {}) })}
          >
            <div
              data-review-grip
              aria-hidden="true"
              className="flex h-8 shrink-0 touch-none items-center justify-center text-muted-foreground"
              title={copy.dragHandle}
            >
              <GripHorizontalIcon className="size-4" />
            </div>
            <CardContent className="min-h-0 flex-1 overflow-y-auto pb-6">
              {renderCard(active)}
            </CardContent>
            {current && current.direction ? (
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-0 grid place-items-center",
                  tone[current.direction].tint
                )}
                style={{ opacity: current.progress }}
              >
                <span className={cn("relative grid size-14 place-items-center", tone[current.direction].ink)}>
                  <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
                    <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
                    <circle
                      cx="24"
                      cy="24"
                      r="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={ring}
                      strokeDashoffset={ring * (1 - current.progress)}
                    />
                  </svg>
                  <span className="[&_svg]:size-6">{dragAction?.icon}</span>
                </span>
              </div>
            ) : null}
          </Card>
        ) : null}

        {waiting && !outgoing ? (
          <div className="absolute inset-0 grid place-items-center rounded-xl border text-sm text-muted-foreground">
            {copy.waiting}
          </div>
        ) : null}

        {outgoing ? (
          <Card
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 gap-0 overflow-hidden py-0"
            style={cardStyle(outgoing.pose)}
          >
            <div className="h-8" />
            <CardContent className="min-h-0 flex-1 overflow-hidden">{renderCard(outgoing.item)}</CardContent>
          </Card>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {(["left", "down", "right"] as const).map((direction) => {
          const action = byDirection(direction)
          if (!action) return <span key={direction} />
          return (
            <Button
              key={action.id}
              type="button"
              size="lg"
              variant={tone[direction].button}
              disabled={action.disabled || locked || active === undefined}
              onClick={() => void decide(direction, "button")}
              className="h-auto min-h-12 min-w-0 py-2 whitespace-normal"
            >
              <span className="leading-tight text-balance">{action.label}</span>
              {action.shortcut ? (
                <Kbd className="max-sm:hidden">{action.shortcut.toUpperCase()}</Kbd>
              ) : null}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export { ReviewDeck }
