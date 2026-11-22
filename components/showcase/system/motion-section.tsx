"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronRightIcon, PlayIcon, RotateCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { durations, easings, sampleEasing, type Easing } from "@/lib/tokens"
import { useTokens } from "@/components/showcase/token-overrides"

import { Readout, Section, Subsection } from "./section"

function CurvePlot({ value, className }: { value: string; className?: string }) {
  const points = sampleEasing(value)
  const ys = points.map(([, y]) => y)
  const min = Math.min(0, ...ys)
  const max = Math.max(1, ...ys)
  const pad = 4
  const size = 64
  const sx = (x: number) => pad + x * (size - pad * 2)
  const sy = (y: number) => size - pad - ((y - min) / (max - min)) * (size - pad * 2)
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={cn("size-16 shrink-0", className)} aria-hidden="true">
      <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} fill="none" className="stroke-border" strokeDasharray="2 2" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="stroke-border" />
      <path d={path} fill="none" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CurveCard({ easing, isDefault, onUse, duration }: { easing: Easing; isDefault: boolean; onUse: () => void; duration: number }) {
  const [at, setAt] = React.useState(false)
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 rounded-xl border p-4", isDefault && "border-primary ring-1 ring-primary")}>
      <div className="flex items-start gap-3">
        <CurvePlot value={easing.value} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{easing.name}</span>
            <Badge variant={easing.inSystem ? "secondary" : "outline"} className="font-normal">
              {easing.inSystem ? "in system" : "option"}
            </Badge>
          </div>
          {easing.token ? <Readout value={easing.token} /> : null}
          <p className="text-xs text-muted-foreground text-pretty">{easing.use}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setAt((value) => !value)}
        className="relative h-6 w-full rounded-full bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`Play ${easing.name}`}
      >
        <span
          className="absolute top-1 size-4 rounded-full bg-primary"
          style={{
            left: at ? "calc(100% - 1.25rem)" : "0.25rem",
            transition: `left ${duration}ms ${easing.value}`,
          }}
        />
      </button>
      <div className="flex items-center justify-between gap-2">
        <Readout value={easing.value.length > 40 ? "linear(…spring stops)" : easing.value} className="truncate" />
        <Button size="xs" variant={isDefault ? "secondary" : "ghost"} onClick={onUse} disabled={isDefault}>
          {isDefault ? "Default" : "Use as default"}
        </Button>
      </div>
    </div>
  )
}

function Playground({ duration, curve }: { duration: number; curve: string }) {
  const [open, setOpen] = React.useState(false)
  const transition = (props: string) =>
    props
      .split(",")
      .map((prop) => `${prop.trim()} ${duration}ms ${curve}`)
      .join(", ")
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="relative flex h-40 items-start justify-center overflow-hidden rounded-xl border bg-muted/30 p-4">
          <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>Options</Button>
          <div
            className="absolute top-14 w-40 rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "scale(1)" : "scale(0.95)",
              transformOrigin: "top center",
              transition: transition("opacity, transform"),
            }}
          >
            {["Rename", "Duplicate", "Delete"].map((item) => (
              <div key={item} className="rounded-md px-2 py-1 text-sm">{item}</div>
            ))}
          </div>
          <Readout value="Popover · fade + scale 95%" className="absolute bottom-2 left-3" />
        </div>
        <div className="relative h-40 overflow-hidden rounded-xl border bg-muted/30">
          <div
            className="absolute inset-y-0 right-0 flex w-2/3 flex-col gap-2 border-l bg-background p-3 shadow-lg"
            style={{ transform: open ? "translateX(0)" : "translateX(101%)", transition: transition("transform") }}
          >
            <span className="text-sm font-medium">Sheet</span>
            <span className="h-2 w-3/4 rounded-full bg-muted" />
            <span className="h-2 w-1/2 rounded-full bg-muted" />
          </div>
          <Readout value="Sheet · slide in" className="absolute bottom-2 left-3" />
        </div>
        <div className="relative flex h-40 items-center justify-center rounded-xl border bg-muted/30">
          <div
            className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm"
            style={{
              transform: open ? "translateY(0)" : "translateY(12px)",
              opacity: open ? 1 : 0.4,
              transition: transition("transform, opacity"),
            }}
          >
            Saved just now
          </div>
          <Readout value="Toast · rise + fade" className="absolute bottom-2 left-3" />
        </div>
      </div>
      <Button className="self-start" onClick={() => setOpen((value) => !value)}>
        <PlayIcon data-icon="inline-start" />
        {open ? "Play out" : "Play in"}
      </Button>
    </div>
  )
}

export function MotionSection() {
  const { theme, setTheme } = useTokens()
  const [duration, setDuration] = React.useState(300)
  const [curve, setCurve] = React.useState(easings[0].value)
  const [race, setRace] = React.useState(false)
  const [toggled, setToggled] = React.useState(false)
  const defaultCurve = theme["--default-transition-timing-function"]
  const defaultDuration = theme["--default-transition-duration"]
  const label = (value: string) => easings.find((easing) => easing.value === value)?.name ?? value

  return (
    <Section
      id="motion"
      title="Motion"
      description="Short, eased, and only where it explains a change. Tailwind gives three curves and a default for every transition-* utility; enter and exit animations (popovers, menus) come from tw-animate-css. Options below are worth trying before they’re adopted."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Subsection title="Defaults" description="What a component gets when it doesn’t choose: transition-colors on a button, transition-all on a panel.">
          <div className="flex flex-col divide-y rounded-xl border text-sm">
            {[
              ["Default transition", `${defaultDuration} · ${label(defaultCurve)}`, "Tunable"],
              ["Enter / exit (animate-in/out)", "150ms · ease", "Compiled"],
              ["Menus, selects", "100ms · fade + zoom 95%", "Component"],
              ["Collapsible, sheet, sidebar", "200ms · ease / linear", "Component"],
              ["Reduced motion", "motion-reduce: variants; entries switch to instant", "Rule"],
            ].map(([name, value, kind]) => (
              <div key={name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>{name}</span>
                <span className="flex items-center gap-2">
                  <Readout value={value} />
                  <Badge variant="outline" className="font-normal">{kind}</Badge>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
            <button
              type="button"
              onClick={() => setToggled((value) => !value)}
              className={cn(
                "h-10 rounded-lg px-4 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                toggled ? "translate-x-6 bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              transition-all
            </button>
            <span className="text-xs text-muted-foreground">Click to toggle. Uses the default duration and curve, so it follows the tuner.</span>
          </div>
        </Subsection>
        <Subsection title="Durations" description="Faster for small, frequent things; slower for big surfaces. Anything blocking input should finish within 300ms.">
          <div className="flex flex-col gap-2">
            {durations.map((step) => (
              <div key={step.ms} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
                <Readout value={`${step.ms}ms`} />
                <div className="flex flex-col gap-1">
                  <span className="h-2 rounded-full bg-primary/80" style={{ width: `${(step.ms / 500) * 100}%` }} />
                  <span className="text-xs text-muted-foreground">{step.where}</span>
                </div>
              </div>
            ))}
          </div>
        </Subsection>
      </div>

      <Subsection
        title="Curves"
        description="Click a track to play it at the race duration below. The highlighted card is the current default for transition-* utilities."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {easings.map((easing) => (
            <CurveCard
              key={easing.name}
              easing={easing}
              duration={duration}
              isDefault={easing.value === defaultCurve}
              onUse={() => setTheme("--default-transition-timing-function", easing.value)}
            />
          ))}
        </div>
      </Subsection>

      <Subsection title="Race" description="Every curve over the same distance and time. The differences are in how the motion is spent, not how long it takes.">
        <div className="flex flex-col gap-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" onClick={() => setRace((value) => !value)}>
              {race ? <RotateCcwIcon data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
              {race ? "Run back" : "Run"}
            </Button>
            <label htmlFor="race-duration" className="text-sm text-muted-foreground">Duration</label>
            <Slider
              id="race-duration"
              aria-label="Race duration in milliseconds"
              className="max-w-56"
              min={100}
              max={1500}
              step={50}
              value={duration}
              onValueChange={(value) => setDuration(Array.isArray(value) ? value[0] : value)}
            />
            <Readout value={`${duration}ms`} />
          </div>
          <div className="flex flex-col gap-1.5">
            {easings.map((easing) => (
              <div key={easing.name} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
                <span className="truncate text-xs">{easing.name}</span>
                <div className="relative h-5 rounded-full bg-muted">
                  <span
                    className="absolute top-0.5 size-4 rounded-full bg-primary"
                    style={{ left: race ? "calc(100% - 1.125rem)" : "0.125rem", transition: `left ${duration}ms ${easing.value}` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Subsection>

      <Subsection title="Playground" description="Real UI moves with a duration and curve you choose.">
        <div className="flex flex-col gap-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={curve} onValueChange={(value) => value && setCurve(value)}>
              <SelectTrigger className="w-48" aria-label="Curve">
                <SelectValue>{(value: string) => label(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {easings.map((easing) => (
                  <SelectItem key={easing.name} value={easing.value}>{easing.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">at</span>
            <Readout value={`${duration}ms`} />
            <span className="text-xs text-muted-foreground">(set with the race slider)</span>
          </div>
          <Playground duration={duration} curve={curve} />
        </div>
      </Subsection>

      <Subsection title="Stock component motion" description="What ships today. These durations are set inside each component, not by tokens.">
        <div className="flex flex-wrap items-start gap-4 rounded-xl border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>Dropdown menu</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Rename</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" size="sm" />}>Tooltip</TooltipTrigger>
            <TooltipContent>Fade and zoom, 150ms</TooltipContent>
          </Tooltip>
          <Collapsible className="min-w-56 rounded-lg border">
            <CollapsibleTrigger className="group/collapse flex w-full items-center gap-2 px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <ChevronRightIcon className="size-4 transition-transform group-aria-expanded/collapse:rotate-90" />
              Collapsible
            </CollapsibleTrigger>
            <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0">
              <p className="px-3 pb-3 text-sm text-muted-foreground">Height animates over 200ms, the same as the inspector and trace.</p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </Subsection>
    </Section>
  )
}
