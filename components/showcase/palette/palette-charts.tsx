"use client"

import * as React from "react"
import { CheckIcon, SearchIcon } from "lucide-react"
import { cn } from "cn"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  apca,
  inkOn,
  maxChroma,
  paint,
  perceived,
  STEPS,
  stepRoles,
  wcag,
  type Oklch,
  type Scale,
  type Vision,
} from "@/lib/palette"

// ── Curves ──────────────────────────────────────────────────────────────────

type Channel = "l" | "c" | "h"

const W = 360
const H = 200
const PAD = { left: 34, right: 10, top: 10, bottom: 24 }
const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (STEPS - 1)

type Range = { min: number; max: number; ticks: number[]; format: (n: number) => string }

function rangeFor(channel: Channel, scales: Scale[]): Range {
  if (channel === "l")
    return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], format: (n) => n.toFixed(2) }
  if (channel === "c") {
    const peak = Math.max(0, ...scales.flatMap((s) => s.steps.map((c) => c.c)))
    const max = peak <= 0.12 ? 0.12 : peak <= 0.2 ? 0.2 : peak <= 0.28 ? 0.28 : 0.37
    return { min: 0, max, ticks: [0, max / 2, max], format: (n) => n.toFixed(2) }
  }
  const hues = scales.flatMap((s) => s.steps.filter((c) => c.c > 0.008).map((c) => c.h))
  const lo = hues.length ? Math.max(0, Math.floor((Math.min(...hues) - 10) / 30) * 30) : 0
  const hi = hues.length ? Math.min(360, Math.ceil((Math.max(...hues) + 10) / 30) * 30) : 360
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  return { min: lo, max: hi, ticks, format: (n) => `${Math.round(n)}°` }
}

function CurveChart({
  title,
  description,
  channel,
  scales,
  selected,
  vision,
  reference,
  onSelect,
  onChange,
}: {
  title: string
  description: string
  channel: Channel
  scales: Scale[]
  selected?: string
  vision: Vision
  reference?: number[]
  onSelect: (scale: string, step: number) => void
  onChange: (scale: string, step: number, channel: Channel, value: number) => void
}) {
  const svg = React.useRef<SVGSVGElement>(null)
  const [drag, setDrag] = React.useState<{ step: number; range: Range } | null>(null)
  const live = rangeFor(channel, scales)
  const range = drag?.range ?? live
  const y = (v: number) => PAD.top + (1 - (v - range.min) / (range.max - range.min)) * (H - PAD.top - PAD.bottom)
  const active = scales.find((s) => s.id === selected)
  // Draw the selected scale last so it sits on top.
  const ordered = [...scales.filter((s) => s.id !== selected), ...(active ? [active] : [])]
  const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const valueAt = (clientY: number) => {
    const rect = svg.current!.getBoundingClientRect()
    const py = ((clientY - rect.top) / rect.height) * H
    const v = range.max - ((py - PAD.top) / (H - PAD.top - PAD.bottom)) * (range.max - range.min)
    return Math.min(channel === "l" ? 1 : channel === "c" ? 0.37 : 360, Math.max(0, v))
  }

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground text-pretty">{description}</span>
      </figcaption>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none overflow-visible rounded-lg border bg-card select-none"
        role="group"
        aria-label={`${title} by step`}
        onPointerMove={(event) => {
          if (!drag || !active) return
          onChange(active.id, drag.step, channel, valueAt(event.clientY))
        }}
        onPointerUp={(event) => {
          if (!drag) return
          svg.current?.releasePointerCapture(event.pointerId)
          setDrag(null)
        }}
      >
        {range.ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
              {range.format(tick)}
            </text>
          </g>
        ))}
        {Array.from({ length: STEPS }, (_, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
            {i + 1}
          </text>
        ))}
        {reference ? (
          <path d={path(reference)} fill="none" className="stroke-muted-foreground" strokeWidth={1} strokeDasharray="3 3">
            <title>Mean of the visible scales</title>
          </path>
        ) : null}
        {channel === "c" && active ? (
          <path
            d={path(active.steps.map((c) => Math.min(range.max, maxChroma(c.l, c.h))))}
            fill="none"
            className="stroke-destructive/60"
            strokeWidth={1}
            strokeDasharray="1 3"
          >
            <title>{`Most chroma sRGB allows at each step of ${active.name}`}</title>
          </path>
        ) : null}
        {ordered.map((scale) => {
          const isActive = scale.id === selected
          const stroke = paint(scale.steps[8], vision)
          return (
            <g key={scale.id} opacity={active && !isActive ? 0.35 : 1}>
              <path
                d={path(scale.steps.map((c) => c[channel]))}
                fill="none"
                stroke={stroke}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeLinejoin="round"
                className={cn(!isActive && "cursor-pointer")}
                onClick={() => onSelect(scale.id, 0)}
              >
                <title>{scale.name}</title>
              </path>
              {scale.steps.map((c, i) =>
                isActive ? (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(Math.min(range.max, Math.max(range.min, c[channel])))}
                    r={5}
                    fill={paint(c, vision)}
                    className="cursor-ns-resize stroke-foreground outline-none focus-visible:stroke-ring focus-visible:stroke-[3px]"
                    strokeWidth={1.25}
                    tabIndex={0}
                    role="slider"
                    aria-label={`${scale.name} ${i + 1} ${title.toLowerCase()}`}
                    aria-valuemin={0}
                    aria-valuemax={channel === "l" ? 1 : channel === "c" ? 0.37 : 360}
                    aria-valuenow={Number(c[channel].toFixed(3))}
                    onPointerDown={(event) => {
                      // Keep text from selecting, but still take focus for arrow keys.
                      event.preventDefault()
                      event.currentTarget.focus()
                      svg.current?.setPointerCapture(event.pointerId)
                      setDrag({ step: i, range: live })
                      onSelect(scale.id, i)
                    }}
                    onKeyDown={(event) => {
                      const delta = { l: 0.005, c: 0.002, h: 1 }[channel] * (event.shiftKey ? 5 : 1)
                      const by = event.key === "ArrowUp" ? delta : event.key === "ArrowDown" ? -delta : 0
                      if (!by) return
                      event.preventDefault()
                      onChange(scale.id, i, channel, Math.max(0, c[channel] + by))
                    }}
                    onFocus={() => onSelect(scale.id, i)}
                  >
                    <title>{`${scale.name} ${i + 1} · ${range.format(c[channel])}`}</title>
                  </circle>
                ) : null
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export function Curves({
  scales,
  selected,
  vision,
  reference,
  onSelect,
  onChange,
}: {
  scales: Scale[]
  selected?: string
  vision: Vision
  reference: number[]
  onSelect: (scale: string, step: number) => void
  onChange: (scale: string, step: number, channel: Channel, value: number) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <CurveChart
        title="Lightness"
        description="Steps with the same number should sit at about the same height across scales. Dashed: the mean."
        channel="l"
        scales={scales}
        selected={selected}
        vision={vision}
        reference={reference}
        onSelect={onSelect}
        onChange={onChange}
      />
      <CurveChart
        title="Chroma"
        description="Usually peaks around the solid steps and falls off at both ends. Red dots: the sRGB ceiling for the selected scale."
        channel="c"
        scales={scales}
        selected={selected}
        vision={vision}
        onSelect={onSelect}
        onChange={onChange}
      />
      <CurveChart
        title="Hue"
        description="Flat lines keep a scale one colour. A gentle drift can warm the lights or deepen the darks."
        channel="h"
        scales={scales}
        selected={selected}
        vision={vision}
        onSelect={onSelect}
        onChange={onChange}
      />
    </div>
  )
}

// ── Contrast matrix ─────────────────────────────────────────────────────────

type Method = "wcag" | "apca"
const thresholds: Record<Method, { value: number; label: string }[]> = {
  wcag: [
    { value: 3, label: "3 · large text, UI" },
    { value: 4.5, label: "4.5 · AA body" },
    { value: 7, label: "7 · AAA" },
  ],
  apca: [
    { value: 45, label: "45 · headlines" },
    { value: 60, label: "60 · content" },
    { value: 75, label: "75 · body" },
  ],
}

export function ContrastMatrix({ scale, vision }: { scale: Scale; vision: Vision }) {
  const [method, setMethod] = React.useState<Method>("wcag")
  const [threshold, setThreshold] = React.useState(4.5)
  const score = (text: Oklch, bg: Oklch) =>
    method === "wcag" ? wcag(perceived(text, vision), perceived(bg, vision)) : Math.abs(apca(perceived(text, vision), perceived(bg, vision)))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[method]}
          onValueChange={(value) => {
            const next = value[0] as Method | undefined
            if (!next) return
            setMethod(next)
            setThreshold(next === "wcag" ? 4.5 : 60)
          }}
          aria-label="Contrast method"
        >
          <ToggleGroupItem value="wcag">WCAG 2</ToggleGroupItem>
          <ToggleGroupItem value="apca">APCA</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[String(threshold)]}
          onValueChange={(value) => value[0] && setThreshold(Number(value[0]))}
          aria-label="Pass mark"
        >
          {thresholds[method].map((t) => (
            <ToggleGroupItem key={t.value} value={String(t.value)}>
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0.5 text-[0.7rem]">
          <caption className="sr-only">
            {scale.name}: text step (rows) on background step (columns), {method === "wcag" ? "WCAG ratio" : "APCA Lc"}
          </caption>
          <thead>
            <tr>
              <th className="w-16 text-left font-normal text-muted-foreground">text ↓ bg →</th>
              {scale.steps.map((_, i) => (
                <th key={i} className="font-mono font-normal text-muted-foreground">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scale.steps.map((text, row) => (
              <tr key={row}>
                <th className="text-left font-mono font-normal text-muted-foreground">{row + 1}</th>
                {scale.steps.map((bg, col) => {
                  const value = score(text, bg)
                  const pass = value >= threshold
                  return (
                    <td
                      key={col}
                      className="h-8 rounded-sm text-center font-mono tabular-nums"
                      style={{ background: paint(bg, vision), color: paint(text, vision) }}
                      title={`${scale.name} ${row + 1} on ${col + 1}: ${value.toFixed(method === "wcag" ? 2 : 0)}`}
                    >
                      {row === col ? "" : pass ? (method === "wcag" ? value.toFixed(1) : Math.round(value)) : <span className="opacity-40">·</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Pairs that meet the pass mark show their score, written in the text colour on the background colour. Dots don’t pass.
      </p>
    </div>
  )
}

// ── In use ──────────────────────────────────────────────────────────────────

/** A small screen painted only from one scale, step by step, the Radix way. */
export function UsagePreview({ scale, vision }: { scale: Scale; vision: Vision }) {
  const s = (i: number) => paint(scale.steps[i - 1], vision)
  const ink9 = inkOn(perceived(scale.steps[8], vision))
  const [picked, setPicked] = React.useState(1)
  const rows = ["Quarterly review", "Shift handover", "Release notes"]
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border p-4 sm:p-6" style={{ background: s(1), color: s(12) }}>
        <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg p-4" style={{ background: s(2), boxShadow: `inset 0 0 0 1px ${s(6)}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-heading text-lg font-semibold">Documents</span>
              <span className="text-sm" style={{ color: s(11) }}>
                Step 11 for secondary text, 12 for the rest.
              </span>
            </div>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: s(3), color: s(11) }}>
              3 open
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm" style={{ boxShadow: `inset 0 0 0 1px ${s(7)}`, color: s(11) }}>
            <SearchIcon className="size-4" />
            Search
          </div>
          <ul className="flex flex-col gap-1">
            {rows.map((row, i) => (
              <li key={row}>
                <button
                  type="button"
                  onClick={() => setPicked(i)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-(--hover) focus-visible:outline-2 focus-visible:outline-(--ring)"
                  style={
                    {
                      background: picked === i ? s(5) : s(3),
                      "--hover": s(4),
                      "--ring": s(8),
                    } as React.CSSProperties
                  }
                >
                  {row}
                  {picked === i ? <CheckIcon className="size-4" /> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="h-px" style={{ background: s(6) }} />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--hover)"
              style={{ boxShadow: `inset 0 0 0 1px ${s(7)}`, color: s(12), "--hover": s(4) } as React.CSSProperties}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--hover)"
              style={{ background: s(9), color: ink9, "--hover": s(10) } as React.CSSProperties}
            >
              Open document
            </button>
          </div>
        </div>
      </div>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3 lg:grid-cols-4">
        {stepRoles.map((role, i) => (
          <li key={role} className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-sm border" style={{ background: s(i + 1) }} />
            <span className="font-mono">{i + 1}</span> {role}
          </li>
        ))}
      </ol>
    </div>
  )
}
