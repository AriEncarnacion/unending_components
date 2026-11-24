"use client"

import * as React from "react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { contrast, grade, toRGBA } from "@/lib/color"
import { colorGroups, type ColorRole } from "@/lib/tokens"
import { useTokens } from "@/components/showcase/token-overrides"

import { Section, Subsection, useMounted } from "./section"

type Scheme = "light" | "dark"

function ContrastBadge({ fg, bg, mounted }: { fg: string; bg: string; mounted: boolean }) {
  if (!mounted) return <Badge variant="outline" className="font-mono font-normal">—</Badge>
  const f = toRGBA(fg)
  const b = toRGBA(bg)
  if (!f || !b) return null
  const ratio = contrast(f, b)
  const level = grade(ratio)
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent bg-background font-mono font-normal tabular-nums shadow-xs",
        level === "Fail" ? "text-destructive" : "text-foreground"
      )}
      title={`WCAG contrast ${ratio.toFixed(2)}:1`}
    >
      {ratio.toFixed(1)} {level}
    </Badge>
  )
}

function Swatch({
  role,
  scheme,
  values,
  mounted,
  selected,
  onSelect,
}: {
  role: ColorRole
  scheme: Scheme
  values: Record<string, string>
  mounted: boolean
  selected: boolean
  onSelect: () => void
}) {
  const scope = scheme === "dark" ? "dark ds-dark" : "ds-light"
  const against = role.on ? values[role.on] : values.background
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        scope,
        "group/swatch flex min-w-0 flex-col overflow-hidden rounded-xl border border-border text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-ring"
      )}
      style={{ background: "var(--background)" }}
    >
      <span
        className="flex h-20 items-end justify-between gap-2 p-3"
        style={{ background: `var(--${role.token})`, color: role.on ? `var(--${role.on})` : undefined }}
      >
        {role.on ? <span className="text-sm font-medium">Aa</span> : <span />}
        <ContrastBadge fg={role.on ? values[role.on] : values[role.token]} bg={role.on ? values[role.token] : against} mounted={mounted} />
      </span>
      <span className="flex flex-col gap-0.5 px-3 py-2" style={{ color: "var(--foreground)" }}>
        <span className="font-mono text-[0.6875rem] break-all" style={{ color: "var(--muted-foreground)" }}>
          {values[role.token]}
        </span>
        {role.on ? (
          <span className="font-mono text-[0.6875rem] break-all" style={{ color: "var(--muted-foreground)" }}>
            on: {values[role.on]}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function ColorSection({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (token: string) => void
}) {
  const { light, dark, overrides } = useTokens()
  const mounted = useMounted()
  const all = colorGroups.flatMap((group) => group.roles.flatMap((role) => [role.token, ...(role.on ? [role.on] : [])]))

  return (
    <Section
      id="color"
      title="Colour"
      description={
        <>
          Semantic tokens in OKLCH, one set per scheme. Components only ever use these names, so
          changing a value restyles everything that plays that role. Badges show WCAG contrast:
          a fill against its foreground, or a line against the page. Click a token to tune it.
        </>
      }
    >
      <Subsection title="Palette" description="Every colour token, light then dark. Changed tokens are marked.">
        <div className="flex flex-col gap-1.5">
          {(["light", "dark"] as const).map((scheme) => (
            <div
              key={scheme}
              className={cn(scheme === "dark" ? "dark ds-dark" : "ds-light", "flex overflow-hidden rounded-lg border border-border")}
            >
              {all.map((token) => (
                <button
                  key={token}
                  type="button"
                  title={`${token} (${scheme})`}
                  aria-label={`${token}, ${scheme}`}
                  onClick={() => onSelect(token)}
                  className="relative h-12 min-w-0 flex-1 outline-none focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50"
                  style={{ background: `var(--${token})` }}
                >
                  {overrides[scheme][token] ? (
                    <span className="absolute top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-ring ring-2 ring-background" />
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Subsection>

      {colorGroups.map((group) => (
        <Subsection key={group.title} title={group.title} description={group.description}>
          <div className="flex flex-col gap-4">
            {group.roles.map((role) => (
              <div key={role.token} className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-1 md:pt-1">
                  <code className="font-mono text-sm">
                    {role.token}
                    {role.on ? <span className="text-muted-foreground"> / {role.on}</span> : null}
                  </code>
                  <p className="text-xs text-muted-foreground text-pretty">{role.use}</p>
                </div>
                {(["light", "dark"] as const).map((scheme) => (
                  <Swatch
                    key={scheme}
                    role={role}
                    scheme={scheme}
                    values={scheme === "dark" ? dark : light}
                    mounted={mounted}
                    selected={selected === role.token}
                    onSelect={() => onSelect(role.token)}
                  />
                ))}
              </div>
            ))}
          </div>
        </Subsection>
      ))}
    </Section>
  )
}
