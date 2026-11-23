"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useTokens } from "@/components/showcase/token-overrides"
import { deltaE, parseColor, toCss, toHex, type Oklch } from "@/lib/palette"
import { buildPreset, recipes, type PresetResult, type Recipe } from "@/lib/theme-presets"

import { usePalette } from "./use-palette"

function PresetPreview({ colors, label, className }: { colors: Record<string, string>; label: string; className?: string }) {
  const c = (token: string) => colors[token]
  return (
    <div
      aria-hidden
      title={label}
      className={cn("flex min-w-0 flex-1 flex-col gap-1.5 rounded-md p-2", className)}
      style={{ background: c("background"), color: c("foreground"), boxShadow: `inset 0 0 0 1px ${c("border")}` }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-heading text-xs leading-none font-semibold">Aa</span>
        <span className="text-[0.55rem] leading-none" style={{ color: c("muted-foreground") }}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span
          className="rounded-sm px-1.5 py-0.5 text-[0.55rem] leading-none font-medium"
          style={{ background: c("primary"), color: c("primary-foreground") }}
        >
          Save
        </span>
        <span
          className="rounded-sm px-1.5 py-0.5 text-[0.55rem] leading-none"
          style={{ background: c("accent"), color: c("accent-foreground") }}
        >
          Hover
        </span>
        <span className="ml-auto flex items-center gap-0.5">
          {["destructive", "warning", "success", "info"].map((token) => (
            <span key={token} className="size-1.5 rounded-full" style={{ background: c(token) }} />
          ))}
        </span>
      </div>
      <div className="flex h-3 items-end gap-0.5">
        {[0.6, 1, 0.45, 0.8, 0.7].map((h, i) => (
          <span key={i} className="flex-1 rounded-[1px]" style={{ height: `${h * 100}%`, background: c(`chart-${i + 1}`) }} />
        ))}
      </div>
    </div>
  )
}

function ChecksList({ result }: { result: PresetResult }) {
  return (
    <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
      {result.checks.map((check) => (
        <li key={`${check.scheme}-${check.label}`} className="flex items-center gap-1.5">
          {check.pass ? (
            <CheckIcon className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <TriangleAlertIcon className="size-3 shrink-0 text-destructive" />
          )}
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted-foreground">{check.scheme === "light" ? "Light" : "Dark"} · </span>
            {check.label}
          </span>
          <span className="font-mono text-muted-foreground tabular-nums">
            {check.unit === "ratio" ? check.value.toFixed(1) : `ΔE ${check.value.toFixed(0)}`}
            <span className="opacity-60"> / {check.min}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function useApplied(result: PresetResult) {
  const { light, dark } = useTokens()
  const same = (a: string | undefined, b: string) => {
    if (a === b) return true
    const [x, y] = [parseColor(a ?? ""), parseColor(b)]
    return !!x && !!y && deltaE(x, y) < 0.05 && a?.includes("/") === b.includes("/")
  }
  return (
    !result.missing.length &&
    Object.entries(result.light).every(([token, value]) => same(light[token], value)) &&
    Object.entries(result.dark).every(([token, value]) => same(dark[token], value))
  )
}

function PresetRow({ recipe, result, compact }: { recipe: Recipe; result: PresetResult; compact?: boolean }) {
  const tokens = useTokens()
  const applied = useApplied(result)
  const failing = result.checks.filter((c) => !c.pass).length
  const apply = () => {
    const previous = { light: tokens.overrides.light, dark: tokens.overrides.dark }
    tokens.setColors({ light: result.light, dark: result.dark })
    toast(`Applied the ${recipe.name} preset to both schemes`, {
      description: failing ? `${failing} checks below target` : `All ${result.checks.length} contrast checks pass`,
      action: { label: "Undo", onClick: () => tokens.setColors(previous) },
    })
  }

  return (
    <div className={cn("flex flex-col gap-2", !compact && "rounded-xl border p-3")}>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {recipe.name}
            {applied ? <Badge variant="secondary">Applied</Badge> : null}
          </span>
          <span className="text-xs text-muted-foreground text-pretty">{recipe.description}</span>
        </div>
        <Button size="sm" variant={applied ? "ghost" : "outline"} disabled={!!result.missing.length || applied} onClick={apply}>
          {applied ? "In use" : "Apply"}
        </Button>
      </div>
      {result.missing.length ? (
        <p className="text-xs text-destructive">Needs scales that were deleted: {result.missing.join(", ")}. Reset the palette to bring them back.</p>
      ) : (
        <>
          <div className="flex gap-1.5">
            <PresetPreview colors={result.light} label="Light" />
            <PresetPreview colors={result.dark} label="Dark" />
          </div>
          {!compact ? <p className="text-xs text-muted-foreground text-pretty">{recipe.theory}</p> : null}
          <Collapsible>
            <CollapsibleTrigger className="group/checks flex items-center gap-1 rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
              <ChevronRightIcon className="size-3 transition-transform group-aria-expanded/checks:rotate-90" />
              {failing ? `${failing} of ${result.checks.length} checks below target` : `All ${result.checks.length} checks pass`}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {compact ? <p className="mb-2 text-xs text-muted-foreground text-pretty">{recipe.theory}</p> : null}
              <ChecksList result={result} />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  )
}

export function PresetList({ compact, className }: { compact?: boolean; className?: string }) {
  const { state } = usePalette()
  const results = React.useMemo(() => recipes.map((recipe) => ({ recipe, result: buildPreset(recipe, state.scales) })), [state.scales])
  return (
    <div className={cn(compact ? "flex flex-col divide-y [&>*]:py-3 [&>*:first-child]:pt-0" : "grid gap-3 md:grid-cols-2 2xl:grid-cols-3", className)}>
      {results.map(({ recipe, result }) => (
        <PresetRow key={recipe.id} recipe={recipe} result={result} compact={compact} />
      ))}
    </div>
  )
}

export function PaletteSwatches({ token, scheme }: { token: string; scheme: "light" | "dark" }) {
  const tokens = useTokens()
  const { state } = usePalette()
  const current = parseColor(tokens[scheme][token] ?? "")
  const match = (c: Oklch) => !!current && deltaE(c, current) < 0.3
  const set = (c: Oklch) => tokens.setColor(scheme, token, toCss(c))
  const scales = state.scales.filter((s) => !s.hidden)
  const keys = state.keys.filter((k) => !k.hidden)
  const swatch = (c: Oklch, name: string) => (
    <button
      key={name}
      type="button"
      aria-label={`Set ${token} to ${name}, ${toHex(c)}`}
      aria-pressed={match(c)}
      title={`${name} · ${toHex(c)}`}
      onClick={() => set(c)}
      className={cn(
        "aspect-square min-w-0 rounded-[3px] outline-none ring-offset-1 ring-offset-card hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-transform",
        match(c) && "ring-2 ring-foreground"
      )}
      style={{ background: toCss(c), boxShadow: "inset 0 0 0 1px color-mix(in oklch, currentColor 12%, transparent)" }}
    />
  )
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">From the palette</span>
      <div className="flex flex-col gap-1">
        {scales.map((scale) => (
          <div key={scale.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-1.5">
            <span className="truncate text-[0.6875rem] text-muted-foreground" title={scale.name}>
              {scale.name}
            </span>
            <div className="grid grid-cols-12 gap-0.5">{scale.steps.map((c, i) => swatch(c, `${scale.name} ${i + 1}`))}</div>
          </div>
        ))}
        {keys.length ? (
          <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-1.5">
            <span className="text-[0.6875rem] text-muted-foreground">Keys</span>
            <div className="grid grid-cols-12 gap-0.5">{keys.map((k) => swatch(k.color, k.name))}</div>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Hidden scales on /palette are left out here.</p>
    </div>
  )
}
