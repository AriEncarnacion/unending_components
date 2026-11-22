"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyPlusIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTokens } from "@/components/showcase/token-overrides"
import {
  apca,
  BLACK,
  clampToGamut,
  deltaE,
  generate,
  parseColor,
  scaleFromKey,
  seedKeys,
  seedScales,
  slug,
  smooth,
  STEPS,
  stepRoles,
  toCss,
  toHex,
  wcag,
  WHITE,
  type Generator,
  type Oklch,
  type Scale,
} from "@/lib/palette"
import { colorGroups } from "@/lib/tokens"
import { InspectorPanel, InspectorRow, InspectorSection } from "@/registry/unending/inspector-panel/inspector-panel"

import { copy, OklchControl } from "./oklch-control"
import { useDesignSystems } from "@/components/showcase/design-systems/provider"
import { safeScaleId, scaleReferences } from "@/lib/design-systems/schema"

import { mapKey, mapScale, uniqueId, type PaletteApi } from "./use-palette"

export type ThemeToken = "background" | "primary" | "foreground"
export const themeTokens: { token: ThemeToken; label: string }[] = [
  { token: "background", label: "Background" },
  { token: "primary", label: "Primary" },
  { token: "foreground", label: "Foreground" },
]

export type Target =
  | { kind: "step"; scale: string; step: number }
  | { kind: "key"; id: string }
  | { kind: "token"; token: ThemeToken }

type Reference = { lightness: number[]; chroma: number[] }

const single = (value: number | readonly number[]) => (Array.isArray(value) ? value[0] : value) as number

/** The scheme being edited is whatever the site is showing. */
export function useScheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === "dark" ? "dark" : "light"
}

/** Steps across visible scales nearest a colour, best first. */
export function nearestSteps(color: Oklch, scales: Scale[], count = 3) {
  return scales
    .filter((scale) => !scale.hidden)
    .flatMap((scale) => scale.steps.map((step, i) => ({ scale, i, step, delta: deltaE(color, step) })))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, count)
}

function ContrastTable({ color, rows }: { color: Oklch; rows: { label: string; color: Oklch | null }[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-1 text-left font-normal">Against</th>
          <th className="py-1 text-right font-normal">WCAG</th>
          <th className="py-1 text-right font-normal">APCA Lc</th>
        </tr>
      </thead>
      <tbody className="font-mono tabular-nums">
        {rows.map(({ label, color: other }) =>
          other ? (
            <tr key={label} className="border-t">
              <td className="py-1.5 font-sans">
                <span className="flex items-center gap-2">
                  <span className="size-3.5 shrink-0 rounded-sm border" style={{ background: toCss(other) }} />
                  {label}
                </span>
              </td>
              <td className="py-1.5 text-right">
                {wcag(color, other).toFixed(2)}
                <span className="ml-1 text-muted-foreground">{wcagGrade(wcag(color, other))}</span>
              </td>
              <td className="py-1.5 text-right" title="Text in this colour on the other">
                {Math.round(apca(color, other))}
              </td>
            </tr>
          ) : null
        )}
      </tbody>
    </table>
  )
}

function wcagGrade(ratio: number) {
  return ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA18" : "–"
}

function NearestList({
  color,
  scales,
  onPick,
  action,
}: {
  color: Oklch
  scales: Scale[]
  onPick: (scale: Scale, i: number) => void
  action: string
}) {
  const nearest = nearestSteps(color, scales)
  if (!nearest.length) return <p className="text-xs text-muted-foreground">No visible scales.</p>
  return (
    <ul className="flex flex-col gap-1">
      {nearest.map(({ scale, i, step, delta }) => (
        <li key={`${scale.id}-${i}`} className="flex items-center gap-2 text-xs">
          <span className="size-4 shrink-0 rounded-sm border" style={{ background: toCss(step) }} />
          <span className="min-w-0 flex-1 truncate">
            {scale.name} {i + 1}
          </span>
          <span className="font-mono text-muted-foreground tabular-nums">ΔE {delta.toFixed(1)}</span>
          <Button size="xs" variant="outline" onClick={() => onPick(scale, i)}>
            {action}
          </Button>
        </li>
      ))}
    </ul>
  )
}

// ── Use in theme ────────────────────────────────────────────────────────────

const allTokens = colorGroups.map((group) => ({
  title: group.title,
  tokens: group.roles.flatMap((role) => [role.token, ...(role.on ? [role.on] : [])]),
}))

function UseInTheme({ color, name }: { color: Oklch; name: string }) {
  const tokens = useTokens()
  const scheme = useScheme()
  const [other, setOther] = React.useState("secondary")
  const apply = (token: string) => {
    const previous = tokens.overrides[scheme][token]
    tokens.setColor(scheme, token, toCss(color))
    toast(`${token} (${scheme}) is now ${name}`, {
      action: { label: "Undo", onClick: () => tokens.setColor(scheme, token, previous) },
    })
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Sets the token in the {scheme} scheme, the one the site is showing. The tuner on /system edits the same values.
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {themeTokens.map(({ token, label }) => (
          <Button key={token} size="sm" variant="outline" onClick={() => apply(token)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Select value={other} onValueChange={(value) => value && setOther(value)}>
          <SelectTrigger size="sm" className="min-w-0 flex-1 font-mono text-xs" aria-label="Other token">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allTokens.map((group) => (
              <SelectGroup key={group.title}>
                <SelectLabel>{group.title}</SelectLabel>
                {group.tokens.map((token) => (
                  <SelectItem key={token} value={token} className="font-mono text-xs">
                    {token}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => apply(other)}>
          Set
        </Button>
      </div>
    </div>
  )
}

// ── Scale tools ─────────────────────────────────────────────────────────────

function GeneratorControls({ scale, api, reference }: { scale: Scale; api: PaletteApi; reference: Reference }) {
  const generator = scale.generator!
  const set = (patch: Partial<Generator>, mergeKey: string) =>
    api.update(
      (state) =>
        mapScale(state, scale.id, (s) => {
          const next = { ...generator, ...patch }
          return { ...s, generator: next, steps: generate(next, reference) }
        }),
      `gen-${scale.id}-${mergeKey}`
    )
  const slider = (key: "lightest" | "darkest" | "chroma" | "hueShift", label: string, min: number, max: number, step: number, show: (n: number) => string) => (
    <InspectorRow label={label}>
      <div className="flex items-center gap-2">
        <Slider
          aria-label={`${scale.name} ${label.toLowerCase()}`}
          min={min}
          max={max}
          step={step}
          value={generator[key]}
          onValueChange={(next) => set({ [key]: single(next) }, key)}
        />
        <span className="w-12 text-right font-mono text-xs text-muted-foreground tabular-nums">{show(generator[key])}</span>
      </div>
    </InspectorRow>
  )
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Moving any of these rebuilds all 12 steps from the key colour, on the lightness and chroma curves of the visible scales.
        Hand edits to steps are replaced; ⌘Z brings them back.
      </p>
      <OklchControl
        label={`${scale.name} key`}
        value={generator.key}
        onChange={(key, channel) => set({ key }, `key-${channel}`)}
      />
      <InspectorRow label="Key sits on">
        <Select
          value={String(generator.index)}
          onValueChange={(value) => value !== null && set({ index: Number(value) }, "index")}
        >
          <SelectTrigger size="sm" className="w-full" aria-label="Key step">
            <SelectValue>{(value: string) => `Step ${Number(value) + 1}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {stepRoles.map((role, i) => (
              <SelectItem key={role} value={String(i)}>
                Step {i + 1} <span className="text-muted-foreground">· {role}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorRow>
      {slider("lightest", "Step 1 L", 0.6, 1, 0.001, (n) => n.toFixed(3))}
      {slider("darkest", "Step 12 L", 0, 0.5, 0.001, (n) => n.toFixed(3))}
      {slider("chroma", "Chroma ×", 0, 2.5, 0.01, (n) => `${n.toFixed(2)}×`)}
      {slider("hueShift", "Hue drift", -90, 90, 1, (n) => `${n > 0 ? "+" : ""}${Math.round(n)}°`)}
      <InspectorRow label="Gamut">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[generator.gamut]}
          onValueChange={(value) => value[0] && set({ gamut: value[0] as "srgb" | "p3" }, "gamut")}
          aria-label="Gamut"
        >
          <ToggleGroupItem value="srgb">sRGB</ToggleGroupItem>
          <ToggleGroupItem value="p3">P3</ToggleGroupItem>
        </ToggleGroup>
      </InspectorRow>
    </>
  )
}

function ScaleTools({
  scale,
  step,
  api,
  reference,
  onTarget,
}: {
  scale: Scale
  step: number
  api: PaletteApi
  reference: Reference
  onTarget: (target: Target | null) => void
}) {
  const ds = useDesignSystems()
  const { update, state } = api
  const index = state.scales.findIndex((s) => s.id === scale.id)
  const steps = (fn: (steps: Oklch[]) => Oklch[], mergeKey?: string) =>
    update((s) => mapScale(s, scale.id, (sc) => ({ ...sc, steps: fn(sc.steps) })), mergeKey && `${scale.id}-${mergeKey}`)
  const each = (fn: (step: Oklch) => Oklch, mergeKey?: string) => steps((list) => list.map(fn), mergeKey)
  const move = (by: number) =>
    update((s) => {
      const scales = [...s.scales]
      const [item] = scales.splice(index, 1)
      scales.splice(index + by, 0, item)
      return { ...s, scales }
    })

  const nudges: { label: string; title: string; fn: (step: Oklch) => Oklch; key: string }[] = [
    { label: "L −", title: "Darken every step by 0.01", fn: (c) => ({ ...c, l: Math.max(0, c.l - 0.01) }), key: "l-" },
    { label: "L +", title: "Lighten every step by 0.01", fn: (c) => ({ ...c, l: Math.min(1, c.l + 0.01) }), key: "l+" },
    { label: "C −", title: "Mute every step by 10%", fn: (c) => ({ ...c, c: c.c * 0.9 }), key: "c-" },
    { label: "C +", title: "Saturate every step by 10%", fn: (c) => ({ ...c, c: c.c * 1.1 }), key: "c+" },
    { label: "H −", title: "Rotate every hue by −2°", fn: (c) => ({ ...c, h: (c.h + 358) % 360 }), key: "h-" },
    { label: "H +", title: "Rotate every hue by +2°", fn: (c) => ({ ...c, h: (c.h + 2) % 360 }), key: "h+" },
  ]

  return (
    <>
      <InspectorSection title="Scale" summary={scale.name}>
        <InspectorRow label="Name" htmlFor={`scale-name-${scale.id}`}>
          <Input
            id={`scale-name-${scale.id}`}
            className="h-8"
            value={scale.name}
            onChange={(event) => update((s) => mapScale(s, scale.id, (sc) => ({ ...sc, name: event.target.value })), `name-${scale.id}`)}
          />
        </InspectorRow>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => move(-1)} disabled={index === 0} aria-label="Move scale up">
            <ArrowUpIcon />
          </Button>
          <Button size="sm" variant="outline" onClick={() => move(1)} disabled={index === state.scales.length - 1} aria-label="Move scale down">
            <ArrowDownIcon />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => update((s) => mapScale(s, scale.id, (sc) => ({ ...sc, hidden: !sc.hidden })))}
          >
            {scale.hidden ? <EyeIcon data-icon="inline-start" /> : <EyeOffIcon data-icon="inline-start" />}
            {scale.hidden ? "Show" : "Hide"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const id = uniqueId(`${scale.id}-copy`, state.scales.map((s) => s.id))
              update((s) => {
                const scales = [...s.scales]
                scales.splice(index + 1, 0, { ...scale, id, name: `${scale.name} copy`, original: scale.steps, hidden: false })
                return { ...s, scales }
              })
              onTarget({ kind: "step", scale: id, step })
            }}
          >
            <CopyPlusIcon data-icon="inline-start" />
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const seed = seedScales.find((s) => s.id === scale.id)
              update((s) =>
                mapScale(s, scale.id, (sc) => (seed ? { ...seed, name: sc.name, hidden: sc.hidden } : { ...sc, steps: sc.original }))
              )
            }}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Reset
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              const uses = ds.active ? scaleReferences(ds.active, scale.id) : []
              if (uses.length) {
                toast.error(`${scale.name} is in use`, {
                  description: `Point these at another colour first: ${uses.slice(0, 6).join(", ")}${uses.length > 6 ? `, and ${uses.length - 6} more` : ""}.`,
                })
                return
              }
              update((s) => ({ ...s, scales: s.scales.filter((sc) => sc.id !== scale.id) }))
              onTarget(null)
              toast(`Deleted ${scale.name}`, { action: { label: "Undo", onClick: api.undo } })
            }}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </InspectorSection>

      <InspectorSection title="Adjust the whole scale" defaultOpen>
        <div className="grid grid-cols-6 gap-1">
          {nudges.map((nudge) => (
            <Button key={nudge.key} size="xs" variant="outline" title={nudge.title} onClick={() => each(nudge.fn, `nudge-${nudge.key}`)}>
              {nudge.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            title="Set each step's lightness to the mean of the visible scales at that step"
            onClick={() => steps((list) => list.map((c, i) => ({ ...c, l: reference.lightness[i] })))}
          >
            Match lightness
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Pull every step into sRGB by lowering chroma"
            onClick={() => each((c) => clampToGamut(c))}
          >
            Fit to sRGB
          </Button>
          <Button size="sm" variant="outline" title="Average each step's lightness with its neighbours" onClick={() => steps((list) => smooth(list, "l"))}>
            Smooth L
          </Button>
          <Button size="sm" variant="outline" title="Average each step's chroma with its neighbours" onClick={() => steps((list) => smooth(list, "c"))}>
            Smooth C
          </Button>
          <Button size="sm" variant="outline" title="Average each step's hue with its neighbours" onClick={() => steps((list) => smooth(list, "h"))}>
            Smooth H
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Give every step the hue of the selected step"
            onClick={() => each((c) => ({ ...c, h: scale.steps[step].h }))}
          >
            One hue
          </Button>
        </div>
      </InspectorSection>

      <InspectorSection
        key={scale.generator ? "generated" : "hand-made"}
        title="Generator"
        summary={scale.generator ? `key on step ${scale.generator.index + 1}` : "hand-made"} defaultOpen={!!scale.generator}>
        {scale.generator ? (
          <GeneratorControls scale={scale} api={api} reference={reference} />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              This scale is hand-made, so each step is edited on its own. Build a generator to drive all 12 steps from one key
              colour with lightness, chroma and hue-drift controls.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const generator: Generator = {
                  key: scale.steps[step],
                  index: step,
                  lightest: scale.steps[0].l,
                  darkest: scale.steps[STEPS - 1].l,
                  chroma: 1,
                  hueShift: 0,
                  gamut: "srgb",
                }
                update((s) => mapScale(s, scale.id, (sc) => ({ ...sc, generator, steps: generate(generator, reference) })))
                toast(`Rebuilt ${scale.name} around step ${step + 1}`, { action: { label: "Undo", onClick: api.undo } })
              }}
            >
              <WandSparklesIcon data-icon="inline-start" />
              Build from step {step + 1}
            </Button>
          </div>
        )}
      </InspectorSection>
    </>
  )
}

// ── Editors per target ──────────────────────────────────────────────────────

function StepEditor({
  scale,
  step,
  api,
  reference,
  onTarget,
}: {
  scale: Scale
  step: number
  api: PaletteApi
  reference: Reference
  onTarget: (target: Target | null) => void
}) {
  const tokens = useTokens()
  const scheme = useScheme()
  const color = scale.steps[step]
  const original = scale.original[step]
  const changed = original && deltaE(color, original) > 0.05
  const setStep = (next: Oklch, channel?: string) =>
    api.update(
      (s) =>
        mapScale(s, scale.id, (sc) => ({
          ...sc,
          steps: sc.steps.map((c, i) => (i === step ? next : c)),
          // Editing the key step keeps the generator's key in step with it.
          generator: sc.generator && sc.generator.index === step ? { ...sc.generator, key: next } : sc.generator,
        })),
      `step-${scale.id}-${step}-${channel}`
    )
  const themeColor = (token: string) => parseColor(tokens[scheme][token] ?? "")

  return (
    <>
      <InspectorSection title="Colour" summary={toHex(color)}>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{stepRoles[step]}</Badge>
          {scale.generator?.index === step ? <Badge variant="secondary">Key</Badge> : null}
        </div>
        <OklchControl label={`${scale.name} ${step + 1}`} value={color} onChange={setStep} />
        {changed ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-4 shrink-0 rounded-sm border" style={{ background: toCss(original) }} />
            <span className="flex-1">
              Was {toHex(original)} · ΔE {deltaE(color, original).toFixed(1)}
            </span>
            <Button size="xs" variant="ghost" onClick={() => setStep(original, "reset")}>
              <RotateCcwIcon data-icon="inline-start" />
              Restore
            </Button>
          </div>
        ) : null}
      </InspectorSection>
      <InspectorSection title="Contrast" summary={`${wcag(color, WHITE).toFixed(1)} on white`}>
        <ContrastTable
          color={color}
          rows={[
            { label: "White", color: WHITE },
            { label: "Black", color: BLACK },
            { label: `${scale.name} 1`, color: scale.steps[0] },
            { label: `${scale.name} 2`, color: scale.steps[1] },
            { label: `${scale.name} 12`, color: scale.steps[STEPS - 1] },
            { label: `Theme background (${scheme})`, color: themeColor("background") },
            { label: `Theme foreground (${scheme})`, color: themeColor("foreground") },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          WCAG: AA body text needs 4.5, AAA 7, large text 3. APCA Lc: 75 for body text, 60 for content, 45 for headlines, 30
          for borders and placeholder.
        </p>
      </InspectorSection>
      <InspectorSection title="Use in theme">
        <UseInTheme color={color} name={`${scale.name} ${step + 1}`} />
      </InspectorSection>
      <ScaleTools scale={scale} step={step} api={api} reference={reference} onTarget={onTarget} />
    </>
  )
}

function KeyEditor({
  id,
  api,
  reference,
  onTarget,
}: {
  id: string
  api: PaletteApi
  reference: Reference
  onTarget: (target: Target | null) => void
}) {
  const { state, update } = api
  const key = state.keys.find((k) => k.id === id)!
  const set = (next: Oklch, channel?: string) => update((s) => mapKey(s, id, (k) => ({ ...k, color: next })), `key-${id}-${channel}`)
  return (
    <>
      <InspectorSection title="Colour" summary={toHex(key.color)}>
        <InspectorRow label="Name" htmlFor={`key-name-${id}`}>
          <Input
            id={`key-name-${id}`}
            className="h-8"
            value={key.name}
            onChange={(event) => update((s) => mapKey(s, id, (k) => ({ ...k, name: event.target.value })), `keyname-${id}`)}
          />
        </InspectorRow>
        <OklchControl label={key.name} value={key.color} onChange={set} />
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const scaleId = uniqueId(safeScaleId(slug(key.name)), state.scales.map((s) => s.id))
              update((s) => ({ ...s, scales: [...s.scales, scaleFromKey(scaleId, key.name, key.color, reference)] }))
              onTarget({ kind: "step", scale: scaleId, step: 0 })
              toast(`Made a ${key.name} scale`)
            }}
          >
            <SparklesIcon data-icon="inline-start" />
            Make a scale
          </Button>
          <Button size="sm" variant="outline" onClick={() => update((s) => mapKey(s, id, (k) => ({ ...k, hidden: !k.hidden })))}>
            {key.hidden ? <EyeIcon data-icon="inline-start" /> : <EyeOffIcon data-icon="inline-start" />}
            {key.hidden ? "Show" : "Hide"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={deltaE(key.color, key.original) < 0.05}
            onClick={() => set(key.original, "reset")}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Reset
          </Button>
          {!seedKeys.some((k) => k.id === id) ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                update((s) => ({ ...s, keys: s.keys.filter((k) => k.id !== id) }))
                onTarget(null)
              }}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete
            </Button>
          ) : null}
        </div>
      </InspectorSection>
      <InspectorSection title="Nearest steps">
        <NearestList
          color={key.color}
          scales={state.scales}
          action="Snap"
          onPick={(scale, i) => set(scale.steps[i], "snap")}
        />
        <p className="text-xs text-muted-foreground">Snap sets this key colour to the step. Click a step in the grid to edit it.</p>
      </InspectorSection>
      <InspectorSection title="Use in theme">
        <UseInTheme color={key.color} name={key.name} />
      </InspectorSection>
    </>
  )
}

function TokenEditor({ token, api }: { token: ThemeToken; api: PaletteApi }) {
  const tokens = useTokens()
  const scheme = useScheme()
  const value = tokens[scheme][token] ?? ""
  const color = parseColor(value)
  const changed = tokens.overrides[scheme][token] !== undefined
  return (
    <>
      <InspectorSection title={`${scheme === "dark" ? "Dark" : "Light"} scheme`} summary={color ? toHex(color) : value}>
        <p className="text-xs text-muted-foreground">
          Live theme value. Edits here are the same as the tuner on /system and apply across the catalog. Flip the site theme to
          edit the other scheme.
        </p>
        {color ? (
          <OklchControl label={token} value={color} onChange={(next) => tokens.setColor(scheme, token, toCss(next))} />
        ) : (
          <p className="font-mono text-xs">{value}</p>
        )}
        <Button size="sm" variant="outline" disabled={!changed} onClick={() => tokens.setColor(scheme, token, undefined)}>
          <RotateCcwIcon data-icon="inline-start" />
          Back to the stock theme value
        </Button>
      </InspectorSection>
      {color ? (
        <InspectorSection title="Nearest steps">
          <NearestList
            color={color}
            scales={api.state.scales}
            action="Use"
            onPick={(scale, i) => tokens.setColor(scheme, token, toCss(scale.steps[i]))}
          />
        </InspectorSection>
      ) : null}
    </>
  )
}

export function PaletteEditor({
  target,
  onTarget,
  api,
  reference,
  className,
}: {
  target: Target | null
  onTarget: (target: Target | null) => void
  api: PaletteApi
  reference: Reference
  className?: string
}) {
  const scheme = useScheme()
  const scale = target?.kind === "step" ? api.state.scales.find((s) => s.id === target.scale) : undefined
  const key = target?.kind === "key" ? api.state.keys.find((k) => k.id === target.id) : undefined

  if (target?.kind === "step" && scale)
    return (
      <InspectorPanel key={`${scale.id}-${target.step}`} className={className} kind="Scale step" title={`${scale.name} ${target.step + 1}`}>
        <StepEditor scale={scale} step={target.step} api={api} reference={reference} onTarget={onTarget} />
      </InspectorPanel>
    )
  if (target?.kind === "key" && key)
    return (
      <InspectorPanel key={key.id} className={className} kind="Key colour" title={key.name}>
        <KeyEditor id={key.id} api={api} reference={reference} onTarget={onTarget} />
      </InspectorPanel>
    )
  if (target?.kind === "token")
    return (
      <InspectorPanel
        key={`${target.token}-${scheme}`}
        className={className}
        kind="Theme token"
        title={`${themeTokens.find((t) => t.token === target.token)?.label} · ${scheme}`}
      >
        <TokenEditor token={target.token} api={api} />
      </InspectorPanel>
    )
  return (
    <InspectorPanel
      className={className}
      kind="Palette"
      empty={
        <p className="max-w-56 text-center text-sm text-muted-foreground text-pretty">
          Click a step, key colour or theme token to edit it in OKLCH.
        </p>
      }
    />
  )
}

export { copy }
