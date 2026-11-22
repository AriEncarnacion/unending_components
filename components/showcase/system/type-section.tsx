"use client"

import { cn } from "cn"

import { leading, tracking, typeSteps, weights } from "@/lib/tokens"
import { useTokens } from "@/components/showcase/token-overrides"

import { Readout, Section, Subsection } from "./section"

// Tailwind v4 defaults: size and line height for each text step.
const scale: Record<string, [string, string]> = {
  xs: ["12px", "16px"],
  sm: ["14px", "20px"],
  base: ["16px", "24px"],
  lg: ["18px", "28px"],
  xl: ["20px", "28px"],
  "2xl": ["24px", "32px"],
  "3xl": ["30px", "36px"],
  "4xl": ["36px", "40px"],
  "5xl": ["48px", "1"],
  "6xl": ["60px", "1"],
}

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
  const pick = (role: "sans" | "heading" | "mono") =>
    fonts[role].find((font) => font.family === theme[`--font-${role}`]) ?? fonts[role][0]

  return (
    <Section
      id="type"
      title="Type"
      description="Three families and Tailwind's default size scale. shadcn sets UI text at text-sm, so most of the interface lives in three sizes: xs, sm and base."
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
                <Readout value={`${scale[step.name][0]} / ${scale[step.name][1]}`} />
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
