"use client"

import * as React from "react"
import { cn } from "cn"

export function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export function Section({
  id,
  title,
  description,
  aside,
  className,
  children,
}: {
  id: string
  title: string
  description?: React.ReactNode
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={cn("flex scroll-mt-16 flex-col gap-6", className)}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex max-w-2xl min-w-0 flex-1 basis-72 flex-col gap-1.5">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground text-pretty">{description}</p> : null}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}

export function Subsection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function Readout({ label, value, className }: { label?: string; value: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-xs text-muted-foreground tabular-nums", className)}>
      {label ? <span className="text-foreground">{label} </span> : null}
      {value}
    </span>
  )
}

export function toPx(value: string) {
  const number = parseFloat(value)
  if (Number.isNaN(number)) return 0
  return value.trim().endsWith("px") ? number : number * 16
}

export function formatPx(px: number) {
  return `${Number(px.toFixed(1))}px`
}
