"use client"

import * as React from "react"
import { cn } from "cn"
import { PlusIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Switch } from "@/components/ui/switch"
import { breakpoints, radiusSteps, shadowSteps, spacingSteps } from "@/lib/tokens"
import { useTokens } from "@/components/showcase/token-overrides"

import { formatPx, Readout, Section, Subsection, toPx } from "./section"

const radiusUse: Record<string, string> = {
  sm: "Tooltips, small items",
  md: "Menu items, tab triggers",
  lg: "Buttons, inputs, selects, code blocks",
  xl: "Cards, chat bubbles",
  "2xl": "Large panels",
  "3xl": "Hero surfaces",
  "4xl": "Badges (pill)",
}

const shadowValues: Record<string, string> = {
  "2xs": "0 1px rgb(0 0 0 / 5%)",
  xs: "0 1px 2px 0 rgb(0 0 0 / 5%)",
  sm: "0 1px 3px 0 rgb(0 0 0 / 10%), 0 1px 2px -1px …",
  md: "0 4px 6px -1px rgb(0 0 0 / 10%), 0 2px 4px -2px …",
  lg: "0 10px 15px -3px rgb(0 0 0 / 10%), 0 4px 6px -4px …",
  xl: "0 20px 25px -5px rgb(0 0 0 / 10%), 0 8px 10px -6px …",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 25%)",
}

const shadowUse: Record<string, string> = {
  sm: "Active tab",
  md: "Menus, selects, popovers",
  lg: "Sheets, submenus",
}

export function SpacingSection() {
  const { theme } = useTokens()
  const unit = toPx(theme["--spacing"])
  return (
    <Section
      id="spacing"
      title="Spacing"
      description={
        <>
          One unit, <code className="font-mono">--spacing</code> ({theme["--spacing"]} = {formatPx(unit)}),
          multiplied. Every padding, gap, margin, width and height utility is a multiple of it, so
          tuning the unit scales the whole layout’s density.
        </>
      }
    >
      <div className="flex flex-col gap-1.5 rounded-xl border p-4">
        {spacingSteps.map((step) => (
          <div key={step} className="grid grid-cols-[3rem_4.5rem_minmax(0,1fr)] items-center gap-3">
            <code className="font-mono text-xs">{step}</code>
            <Readout value={formatPx(step * unit)} />
            <span className="h-3 rounded-sm bg-primary/80" style={{ width: `calc(var(--spacing) * ${step})` }} />
          </div>
        ))}
      </div>
      <Subsection title="Rhythm in practice" description="Stock components mostly use 1, 1.5, 2, 2.5, 3 and 4. Cards pad at 6, page sections gap at 10 or more.">
        <div className="flex flex-wrap items-start gap-6">
          {[
            { label: "gap-1.5 · badge row", className: "gap-1.5" },
            { label: "gap-2 · button group", className: "gap-2" },
            { label: "gap-4 · form fields", className: "gap-4" },
          ].map((row) => (
            <div key={row.label} className="flex flex-col gap-2">
              <Readout value={row.label} />
              <div className={cn("flex", row.className)}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-8 w-12 rounded-md border bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Subsection>
    </Section>
  )
}

export function RadiusSection() {
  const { theme } = useTokens()
  const base = toPx(theme["--radius"])
  return (
    <Section
      id="radius"
      title="Radius"
      description={
        <>
          One base, <code className="font-mono">--radius</code> ({theme["--radius"]} = {formatPx(base)}),
          and a ladder derived from it. Larger surfaces get larger radii so nested corners stay
          concentric. Pills and switches use rounded-full and never change.
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {radiusSteps.map((step) => (
          <div key={step.name} className="flex flex-col gap-2">
            <div className={cn(step.className, "aspect-square border-2 border-primary/70 bg-primary/5")} />
            <div className="flex flex-col">
              <code className="font-mono text-xs">{step.className}</code>
              <Readout value={`${formatPx(base * step.factor)} · ×${step.factor}`} />
              <span className="text-xs text-muted-foreground">{radiusUse[step.name]}</span>
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <div className="aspect-square rounded-full border-2 border-primary/70 bg-primary/5" />
          <div className="flex flex-col">
            <code className="font-mono text-xs">rounded-full</code>
            <Readout value="9999px" />
            <span className="text-xs text-muted-foreground">Switches, avatars</span>
          </div>
        </div>
      </div>
      <Subsection title="Nesting" description="A card (xl) holding a code block (lg) holding a button (lg, capped at 12px for sm). The steps keep inner corners from looking pinched.">
        <div className="max-w-md rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 p-3">
            <code className="font-mono text-xs">npx shadcn add …/review-deck</code>
            <Button size="sm" variant="outline">Copy</Button>
          </div>
        </div>
      </Subsection>
    </Section>
  )
}

export function ElevationSection() {
  return (
    <Section
      id="elevation"
      title="Elevation"
      description="Tailwind’s shadow ladder. base-nova is mostly flat: cards use a hairline ring (ring-1 ring-foreground/10) instead of a shadow, and shadows are kept for things floating above the page. In dark mode the shadows all but vanish, so elevation there comes from the ring and the lighter card and popover surfaces. Shadow values are compiled into each utility, so they can’t be tuned live."
    >
      <div className="grid grid-cols-2 gap-6 rounded-xl bg-muted/40 p-6 sm:grid-cols-4 lg:grid-cols-7">
        {shadowSteps.map((step) => (
          <div key={step.name} className="flex flex-col gap-3">
            <div className={cn(step.className, "grid aspect-[4/3] place-items-center rounded-xl bg-card text-xs text-muted-foreground")}>
              {shadowUse[step.name] ?? ""}
            </div>
            <div className="flex flex-col">
              <code className="font-mono text-xs">{step.className}</code>
              <Readout value={shadowValues[step.name]} className="text-[0.625rem] leading-tight" />
            </div>
          </div>
        ))}
      </div>
      <Subsection title="Layers in practice">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <div className="h-24 rounded-xl bg-card ring-1 ring-foreground/10" />
            <Readout value="Card · ring-1 ring-foreground/10" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-24 rounded-lg bg-popover shadow-md ring-1 ring-foreground/10" />
            <Readout value="Menu · shadow-md + ring" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-24 rounded-xl border bg-background shadow-lg" />
            <Readout value="Sheet · shadow-lg" />
          </div>
        </div>
      </Subsection>
    </Section>
  )
}

export function SizingSection() {
  return (
    <Section
      id="sizing"
      title="Controls, focus and borders"
      description="Control heights come from the button and input sizes; everything that sits in a row with them shares the height. Focus is a 3px ring at 50% of --ring plus a ring-coloured border."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Subsection title="Heights">
          <div className="flex flex-col gap-3">
            {[
              { label: "xs · h-6 · 24px", node: <Button size="xs">Button</Button> },
              { label: "sm · h-7 · 28px", node: <Button size="sm">Button</Button> },
              { label: "default · h-8 · 32px", node: <><Button>Button</Button><Input className="w-40" placeholder="Input" /></> },
              { label: "lg · h-9 · 36px", node: <Button size="lg">Button</Button> },
              { label: "icon · size-8", node: <><Button size="icon" aria-label="Add"><PlusIcon /></Button><Button size="icon-sm" variant="outline" aria-label="Search"><SearchIcon /></Button></> },
            ].map((row) => (
              <div key={row.label} className="flex flex-wrap items-center gap-3">
                <Readout value={row.label} className="w-40" />
                {row.node}
              </div>
            ))}
          </div>
        </Subsection>
        <Subsection title="Focus, selection and borders">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="border-ring ring-3 ring-ring/50">Focused</Button>
              <Input className="w-40 border-ring ring-3 ring-ring/50" defaultValue="Focused input" aria-label="Focused input example" />
              <Readout value="ring-3 ring-ring/50 border-ring" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input aria-invalid className="w-40" defaultValue="Invalid" aria-label="Invalid input example" />
              <Readout value="aria-invalid · destructive ring" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Switch defaultChecked aria-label="Example switch" />
              <Badge>Badge</Badge>
              <Kbd>⌘K</Kbd>
              <Readout value="icons size-4 (16px) · 3.5 in sm" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="h-10 w-24 rounded-md border" />
              <span className="h-10 w-24 rounded-md border-2" />
              <Readout value="border = 1px (default), 2px for emphasis" />
            </div>
            <p className="text-sm">
              <span className="bg-primary text-primary-foreground">Selected text</span> uses the
              browser default; disabled controls drop to 50% opacity.
            </p>
          </div>
        </Subsection>
      </div>
    </Section>
  )
}

function subscribeWidth(notify: () => void) {
  window.addEventListener("resize", notify)
  return () => window.removeEventListener("resize", notify)
}

export function BreakpointSection() {
  const width = React.useSyncExternalStore(subscribeWidth, () => window.innerWidth, () => 0)
  return (
    <Section
      id="layout"
      title="Breakpoints"
      description="Tailwind’s defaults, mobile first: an sm: class applies from 640px up."
    >
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        {breakpoints.map((point) => (
          <div key={point.name} className="grid grid-cols-[3rem_7rem_minmax(0,1fr)] items-center gap-3">
            <code className="font-mono text-xs">{point.name}</code>
            <Readout value={`${point.value} · ${point.px}px`} />
            <div className="flex items-center gap-2">
              <span
                className={cn("h-2 rounded-full", width >= point.px ? "bg-primary" : "bg-muted")}
                style={{ width: `${(point.px / 1536) * 100}%` }}
              />
              {"note" in point ? <span className="text-xs text-muted-foreground">{point.note}</span> : null}
            </div>
          </div>
        ))}
        <Readout value={width ? `This window: ${width}px` : " "} className="pt-1" />
      </div>
    </Section>
  )
}
