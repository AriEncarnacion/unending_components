"use client"

import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

const MIN = 200
const STEP = 16

export function Example({
  title,
  description,
  className,
  children,
}: {
  title: string
  description?: string
  className?: string
  children: React.ReactNode
}) {
  const outerRef = React.useRef<HTMLDivElement>(null)
  const frameRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState<number | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const full = () => outerRef.current?.clientWidth ?? 0
  const settle = (next: number) => {
    const max = full()
    setWidth(next >= max - 1 ? null : Math.round(Math.max(MIN, next)))
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !frameRef.current) return
    event.preventDefault()
    const handle = event.currentTarget
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {}
    const left = frameRef.current.getBoundingClientRect().left
    setDragging(true)
    const move = (moveEvent: PointerEvent) => settle(Math.min(full(), moveEvent.clientX - left))
    const up = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", up)
      handle.removeEventListener("pointercancel", up)
      setDragging(false)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", up)
    handle.addEventListener("pointercancel", up)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = width ?? full()
    if (event.key === "ArrowLeft") settle(current - STEP)
    else if (event.key === "ArrowRight") settle(Math.min(full(), current + STEP))
    else if (event.key === "Home") settle(MIN)
    else if (event.key === "End" || event.key === "Enter") setWidth(null)
    else return
    event.preventDefault()
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <h2 className="font-medium">{title}</h2>
          {description ? (
            <p className="max-w-prose text-sm text-muted-foreground text-pretty">{description}</p>
          ) : null}
        </div>
        {width !== null ? (
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">{width}px wide</span>
            <Button variant="ghost" size="sm" onClick={() => setWidth(null)}>
              Reset
            </Button>
          </div>
        ) : null}
      </div>
      <div ref={outerRef} className="min-w-0">
        <div
          ref={frameRef}
          className={cn(
            "@container/example relative max-w-full min-w-0 rounded-xl border bg-background p-6 @max-sm/example:p-4",
            className
          )}
          style={width !== null ? { width } : undefined}
        >
          {children}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize the ${title} example`}
            aria-valuemin={MIN}
            aria-valuenow={width ?? undefined}
            tabIndex={0}
            title="Drag to try a narrower container. Double-click to reset."
            onPointerDown={onPointerDown}
            onDoubleClick={() => setWidth(null)}
            onKeyDown={onKeyDown}
            data-dragging={dragging || undefined}
            className={cn(
              "absolute inset-y-0 -right-2 z-10 w-4 cursor-col-resize touch-none outline-none",
              "after:absolute after:inset-y-3 after:left-1/2 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-transparent after:transition-colors",
              "hover:after:bg-ring/60 focus-visible:after:bg-ring data-dragging:after:bg-ring"
            )}
          />
        </div>
      </div>
    </section>
  )
}
