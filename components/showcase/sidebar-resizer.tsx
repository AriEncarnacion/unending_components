"use client"

import * as React from "react"
import { cn } from "cn"

import { useSidebar } from "@/components/ui/sidebar"

const STORAGE_KEY = "unending:sidebar-width"
const MIN = 200
const MAX = 480
const STEP = 16

export function useSidebarWidth() {
  const [width, setWidth] = React.useState<number | null>(null)
  React.useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (saved >= MIN && saved <= MAX) setWidth(saved)
    } catch {}
  }, [])
  const save = React.useCallback((next: number | null) => {
    setWidth(next)
    try {
      if (next === null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, String(next))
    } catch {}
  }, [])
  return [width, setWidth, save] as const
}

const clamp = (value: number) => Math.round(Math.min(MAX, Math.max(MIN, value)))

export function SidebarResizer({
  width,
  onWidthChange,
  onWidthCommit,
}: {
  width: number | null
  onWidthChange: (width: number | null) => void
  onWidthCommit: (width: number | null) => void
}) {
  const { state, isMobile } = useSidebar()
  const ref = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  if (isMobile || state === "collapsed") return null

  const current = () => width ?? ref.current?.getBoundingClientRect().left ?? 256

  const setTransitions = (on: boolean) => {
    const wrapper = ref.current?.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')
    wrapper
      ?.querySelectorAll<HTMLElement>('[data-slot="sidebar-gap"], [data-slot="sidebar-container"]')
      .forEach((element) => (element.style.transition = on ? "" : "none"))
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget
    try {
      target.setPointerCapture(event.pointerId)
    } catch {}
    setDragging(true)
    setTransitions(false)
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = "col-resize"
    let next = current()
    const move = (moveEvent: PointerEvent) => {
      next = clamp(moveEvent.clientX)
      onWidthChange(next)
    }
    const up = () => {
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", up)
      target.removeEventListener("pointercancel", up)
      document.body.style.cursor = previousCursor
      setTransitions(true)
      setDragging(false)
      onWidthCommit(next)
    }
    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", up)
    target.addEventListener("pointercancel", up)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === "ArrowLeft" ? -STEP : event.key === "ArrowRight" ? STEP : 0
    if (event.key === "Home") onWidthCommit(MIN)
    else if (event.key === "End") onWidthCommit(MAX)
    else if (event.key === "Enter") onWidthCommit(null)
    else if (delta) onWidthCommit(clamp(current() + delta))
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={Math.round(width ?? 256)}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      onPointerDown={onPointerDown}
      onDoubleClick={() => onWidthCommit(null)}
      onKeyDown={onKeyDown}
      data-dragging={dragging || undefined}
      className={cn(
        "fixed inset-y-0 z-20 hidden w-2 -translate-x-1/2 cursor-col-resize touch-none outline-none md:block",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-transparent after:transition-colors",
        "hover:after:bg-ring/60 focus-visible:after:bg-ring data-dragging:after:bg-ring"
      )}
      style={{ left: "var(--sidebar-width)" }}
    />
  )
}
