"use client"

import * as React from "react"
import { CopyIcon } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { clampToGamut, gamutOf, parseColor, toCss, toHex, type Oklch } from "@/lib/palette"

const single = (value: number | readonly number[]) => (Array.isArray(value) ? value[0] : value) as number

export function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast(`Copied ${text}`),
    () => toast.error("Couldn’t copy to the clipboard")
  )
}

/** Gamut label for a colour: fits sRGB, needs a P3 screen, or is outside both. */
export function GamutNote({ color, onFit }: { color: Oklch; onFit?: () => void }) {
  const gamut = gamutOf(color)
  if (gamut === "srgb") return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-xs">
      <span className="text-muted-foreground">
        {gamut === "p3"
          ? "Outside sRGB. Shows on P3 screens and clips elsewhere."
          : "Outside sRGB and P3. Every screen clips it."}
      </span>
      {onFit ? (
        <Button size="xs" variant="outline" onClick={onFit}>
          Fit to sRGB
        </Button>
      ) : null}
    </div>
  )
}

/** Text field that takes hex or oklch() and only commits valid colours. */
function ColorText({ value, onChange, label }: { value: Oklch; onChange: (next: Oklch) => void; label: string }) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const shown = draft ?? toHex(value)
  return (
    <Input
      aria-label={`${label} hex or oklch`}
      className={cn("h-8 font-mono text-xs", draft !== null && !parseColor(draft) && "border-destructive")}
      value={shown}
      spellCheck={false}
      onChange={(event) => {
        setDraft(event.target.value)
        const parsed = parseColor(event.target.value)
        if (parsed) onChange(parsed)
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") setDraft(null)
      }}
    />
  )
}

type Channel = "l" | "c" | "h"

const channels: Record<Channel, { label: string; max: number; step: number; places: number }> = {
  l: { label: "Lightness", max: 1, step: 0.001, places: 3 },
  c: { label: "Chroma", max: 0.37, step: 0.001, places: 3 },
  h: { label: "Hue", max: 360, step: 0.5, places: 1 },
}

function track(color: Oklch, channel: Channel) {
  const stop = (next: Partial<Oklch>) => toCss({ ...color, ...next })
  if (channel === "l") return `linear-gradient(to right in oklch, ${stop({ l: 0 })}, ${stop({ l: 0.5 })}, ${stop({ l: 1 })})`
  if (channel === "c") return `linear-gradient(to right in oklch, ${stop({ c: 0 })}, ${stop({ c: 0.37 })})`
  const hues = Array.from({ length: 13 }, (_, i) => stop({ h: i * 30 }))
  return `linear-gradient(to right, ${hues.join(", ")})`
}

function ChannelRow({
  color,
  channel,
  label,
  onChange,
}: {
  color: Oklch
  channel: Channel
  label: string
  onChange: (next: Oklch, channel: Channel) => void
}) {
  const spec = channels[channel]
  const id = React.useId()
  const [draft, setDraft] = React.useState<string | null>(null)
  const value = color[channel]
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.25rem] items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {spec.label}
      </label>
      <Slider
        id={id}
        aria-label={`${label} ${spec.label.toLowerCase()}`}
        min={0}
        max={spec.max}
        step={spec.step}
        value={Math.min(value, spec.max)}
        onValueChange={(next) => onChange({ ...color, [channel]: single(next) }, channel)}
        className="[&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-track]]:h-2.5 [&_[data-slot=slider-track]]:bg-(image:--track) [&_[data-slot=slider-track]]:ring-1 [&_[data-slot=slider-track]]:ring-foreground/10"
        style={{ "--track": track(color, channel) } as React.CSSProperties}
      />
      <Input
        aria-label={`${label} ${spec.label.toLowerCase()} value`}
        inputMode="decimal"
        className="h-7 px-1.5 text-right font-mono text-xs tabular-nums"
        value={draft ?? value.toFixed(spec.places)}
        onChange={(event) => {
          setDraft(event.target.value)
          const next = parseFloat(event.target.value)
          if (!Number.isNaN(next)) onChange({ ...color, [channel]: Math.min(spec.max, Math.max(0, next)) }, channel)
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
          event.preventDefault()
          const delta = (event.key === "ArrowUp" ? 1 : -1) * spec.step * (event.shiftKey ? 10 : 1) * (channel === "h" ? 2 : 5)
          setDraft(null)
          onChange({ ...color, [channel]: Math.min(spec.max, Math.max(0, value + delta)) }, channel)
        }}
      />
    </div>
  )
}

/**
 * OKLCH editor: swatch with a native picker, hex/oklch field, copy buttons and
 * L, C, H sliders whose tracks show where each channel goes.
 */
export function OklchControl({
  value,
  onChange,
  label,
  swatch,
}: {
  value: Oklch
  /** `channel` says which slider moved, so callers can merge a drag into one undo step. */
  onChange: (next: Oklch, channel?: Channel | "text" | "picker" | "fit") => void
  label: string
  swatch?: string
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <label
          className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border focus-within:ring-3 focus-within:ring-ring/50"
          style={{ background: swatch ?? toCss(value) }}
        >
          <span className="sr-only">Pick {label}</span>
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={toHex(value)}
            onChange={(event) => {
              const parsed = parseColor(event.target.value)
              if (parsed) onChange(parsed, "picker")
            }}
          />
        </label>
        <ColorText key={toHex(value)} value={value} onChange={(next) => onChange(next, "text")} label={label} />
        <Button size="icon-sm" variant="ghost" aria-label={`Copy ${label} hex`} onClick={() => copy(toHex(value))}>
          <CopyIcon />
        </Button>
      </div>
      <button
        type="button"
        className="-mt-1 self-start rounded font-mono text-[0.7rem] text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={() => copy(toCss(value))}
        title="Copy oklch()"
      >
        {toCss(value)}
      </button>
      {(["l", "c", "h"] as const).map((channel) => (
        <ChannelRow key={channel} color={value} channel={channel} label={label} onChange={onChange} />
      ))}
      <GamutNote color={value} onFit={() => onChange(clampToGamut(value), "fit")} />
    </div>
  )
}
