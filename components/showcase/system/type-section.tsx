"use client"

import { cn } from "cn"

import { leading, tracking, typeSteps, weights } from "@/lib/tokens"
import { tunedScale } from "@/lib/design-systems/type-scale"
import { useTokens } from "@/components/showcase/token-overrides"

import { Readout, Section, Subsection } from "./section"

const usage: Record<string, string> = {
  xs: "Badges, meta, kbd, code blocks (sm)",
  sm: "Default UI text: buttons, inputs, menus, table cells",
  base: "Reading text, inputs on touch",
  lg: "Lead paragraphs",
  xl: "Card titles in roomy layouts",
  "2xl": "Section headings",
  "3xl": "Page titles",
}

const roleInfo = {
  heading: { className: "font-heading", utility: "font-heading · h1–h6, card and dialog titles", sample: "Rotation settings and handoffs" },
  sans: { className: "font-sans", utility: "font-sans · body and UI text", sample: "Alex covers Primary until Sat 03:07. 1d 15h left, 2 lanes, 0 gaps." },
  mono: { className: "font-mono", utility: "font-mono · code, times, data", sample: "Fri 20 Nov 17:00 · +24 hr · 0x1f4e · npx shadcn add" },
} as const

function FamilyCard({ role, family, label }: { role: "sans" | "heading" | "mono"; family: string; label: string }) {
  const info = roleInfo[role]
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <Readout value={info.utility} />
      </div>
      <p className={cn(info.className, "text-5xl leading-none tracking-tight")}>Aa Gg 0123</p>
      <p className={cn(info.className, "text-sm break-words")}>
        ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 &amp;@#%→—“”
      </p>
      <p className={cn(info.className, role === "heading" ? "text-xl font-semibold tracking-tight" : "text-sm text-muted-foreground tabular-nums")}>
        {info.sample}
      </p>
      <Readout value={family || "default"} className="truncate" />
    </div>
  )
}

export function TypeSection() {
  const { theme, fonts } = useTokens()
  const scale = tunedScale({ "--text-sm": theme["--text-sm"], "--leading-body": theme["--leading-body"] || undefined })
  const px = (n: number) => `${Number(n.toFixed(1))}px`
  const readout = (step: string) => {
    const { rem, leading: lh } = scale[step]
    return `${px(rem * 16)} / ${lh === 1 ? "1" : px(rem * 16 * lh)}`
  }
  const pick = (role: "sans" | "heading" | "mono") =>
    fonts[role].find((font) => font.family === theme[`--font-${role}`]) ?? fonts[role][0]

  return (
    <Section
      id="type"
      title="Type"
      description="Three families and Tailwind's size scale. shadcn sets UI text at text-sm, so most of the interface lives in three sizes: xs, sm and base. Size in the tuner sets text-sm and the scale follows it."
    >
      <Subsection title="Families">
        <div className="grid gap-4 lg:grid-cols-3">
          {(["heading", "sans", "mono"] as const).map((role) => (
            <FamilyCard key={role} role={role} family={pick(role).family} label={pick(role).label} />
          ))}
        </div>
      </Subsection>

      <Subsection title="Scale" description="Size and line height per step. Line heights shrink as sizes grow, so headings stay tight.">
        <div className="flex flex-col divide-y rounded-xl border">
          {typeSteps.map((step) => (
            <div key={step.name} className="grid items-baseline gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <div className="flex flex-col">
                <code className="font-mono text-xs">{step.className}</code>
                <Readout value={readout(step.name)} />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={cn(step.className, "truncate font-medium tracking-tight")}>
                  Coverage, at a glance
                </span>
                {usage[step.name] ? <span className="text-xs text-muted-foreground">{usage[step.name]}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </Subsection>

      <Subsection
        title="Flow"
        description={`Space between paragraphs of running text: space-y-flow on the parent, or mt-flow. ${theme["--spacing-flow"]}, so it follows the text size.`}
      >
        <div className="max-w-prose space-y-flow rounded-xl border p-5 text-sm">
          <p>
            Mateo’s override splits his shift in two. He hands off to Alex at 23:00 and is back on at 03:07, so the
            rotation continues without a gap.
          </p>
          <p>
            If Alex can’t cover the middle, the shift stays unassigned and the schedule flags it before the handoff. Assign
            someone or accept the gap.
          </p>
        </div>
      </Subsection>

      <div className="grid gap-6 lg:grid-cols-3">
        <Subsection title="Weights" description="shadcn uses medium for labels and titles, semibold for headings.">
          <div className="flex flex-col gap-2">
            {weights.map((weight) => (
              <div key={weight.name} className="flex items-baseline justify-between gap-3">
                <span className={cn(weight.className, "text-lg")}>Shift handoff</span>
                <Readout value={`${weight.className} · ${weight.value}`} />
              </div>
            ))}
          </div>
        </Subsection>
        <Subsection title="Tracking" description="Tight for large headings; wide for small caps labels.">
          <div className="flex flex-col gap-2">
            {tracking.map((step) => (
              <div key={step.name} className="flex items-baseline justify-between gap-3">
                <span className={cn(step.className, "text-lg")}>Shift handoff</span>
                <Readout value={step.value} />
              </div>
            ))}
          </div>
        </Subsection>
        <Subsection title="Leading" description="Line height for running text. relaxed is used in chat answers.">
          <div className="flex flex-col gap-3">
            {leading.map((step) => (
              <div key={step.name} className="flex flex-col gap-1">
                <Readout value={`${step.className} · ${step.value}`} />
                <p className={cn(step.className, "text-sm text-muted-foreground")}>
                  The override splits Mateo’s shift in two, so he is back on at 03:07 and the rotation continues.
                </p>
              </div>
            ))}
          </div>
        </Subsection>
      </div>
    </Section>
  )
}
