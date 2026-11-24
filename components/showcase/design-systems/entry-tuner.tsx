"use client"

import * as React from "react"
import { PlusIcon, RotateCcwIcon, SparklesIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useTokens } from "@/components/showcase/token-overrides"
import { resolveValue } from "@/lib/design-systems/resolve"
import {
  emptyEntryTuning,
  paletteRef,
  parsePaletteRef,
  parseTokenRef,
  type EntryTuningFile,
  type Knob,
  type KnobValue,
  type ScopedThemeVar,
} from "@/lib/design-systems/schema"
import { entryKnobs } from "@/lib/entry-knobs"
import { toCss, toHex } from "@/lib/palette"
import { colorGroups, easings } from "@/lib/tokens"
import { InspectorPanel, InspectorRow, InspectorSection } from "@/registry/unending/inspector-panel/inspector-panel"

import { useDesignSystems } from "./provider"

const single = (value: number | readonly number[]) => (Array.isArray(value) ? value[0] : value) as number
const colorTokens = colorGroups.flatMap((group) => group.roles.flatMap((role) => [role.token, ...(role.on ? [role.on] : [])]))

function useEntry(name: string) {
  const ds = useDesignSystems()
  const tuning = ds.active?.entries[name] ?? emptyEntryTuning(name)
  const change = React.useCallback(
    (recipe: (tuning: EntryTuningFile) => EntryTuningFile, mergeKey?: string) =>
      ds.update(
        (w) => ({ ...w, entries: { ...w.entries, [name]: recipe(w.entries[name] ?? emptyEntryTuning(name)) } }),
        mergeKey && `entry:${name}:${mergeKey}`
      ),
    [ds, name]
  )
  return { ds, tuning, change }
}

function ResetButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button size="icon-xs" variant="ghost" aria-label={`Reset ${label}`} disabled={disabled} onClick={onClick}>
      <RotateCcwIcon />
    </Button>
  )
}

function KnobControl({ entry, knob }: { entry: string; knob: Knob }) {
  const { tuning, change } = useEntry(entry)
  const tuned = tuning.knobs[knob.key]
  const value = tuned ?? knob.default
  const id = `knob-${entry}-${knob.key}`
  const set = (next: KnobValue | undefined) =>
    change((t) => {
      const knobs = { ...t.knobs }
      if (next === undefined || next === knob.default) delete knobs[knob.key]
      else knobs[knob.key] = next
      return { ...t, knobs }
    }, knob.key)
  const reset = <ResetButton label={knob.label} disabled={tuned === undefined} onClick={() => set(undefined)} />

  let control: React.ReactNode
  if (knob.kind === "boolean")
    control = <Switch id={id} checked={value === true} onCheckedChange={(checked) => set(checked)} />
  else if (knob.kind === "enum" || knob.kind === "easing") {
    const options =
      knob.kind === "enum"
        ? (knob.options ?? []).map((option) => ({ value: option, label: option }))
        : [
            ...(easings.some((e) => e.value === knob.default) ? [] : [{ value: String(knob.default), label: "entry default" }]),
            ...easings.map((e) => ({ value: e.value, label: e.name })),
          ]
    control = (
      <Select value={String(value)} onValueChange={(next) => next && set(next)}>
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue>{(v: string) => options.find((o) => o.value === v)?.label ?? v}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  } else if (knob.kind === "text")
    control = <Input id={id} value={String(value)} onChange={(event) => set(event.target.value)} />
  else
    control = (
      <Slider
        id={id}
        aria-label={knob.label}
        min={knob.min ?? 0}
        max={knob.max ?? 1000}
        step={knob.step ?? 1}
        value={Number(value)}
        onValueChange={(next) => set(single(next))}
      />
    )

  return (
    <InspectorRow label={knob.label} htmlFor={id} hint={knob.description}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{control}</div>
        {knob.kind === "duration" || knob.kind === "distance" || knob.kind === "number" ? (
          <span
            className={cn(
              "w-14 text-right font-mono text-xs tabular-nums",
              tuned === undefined ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {String(value)}
            {knob.unit ? (knob.unit === "%" || knob.unit === "ms" || knob.unit === "px" ? knob.unit : ` ${knob.unit}`) : ""}
          </span>
        ) : null}
        {reset}
      </div>
    </InspectorRow>
  )
}

const scopedSliders: { name: ScopedThemeVar; label: string; min: number; max: number; step: number; unit: "rem" | "ms" }[] = [
  { name: "--radius", label: "Radius", min: 0, max: 1.5, step: 0.025, unit: "rem" },
  { name: "--spacing", label: "Spacing unit", min: 0.1875, max: 0.3125, step: 0.0078125, unit: "rem" },
  { name: "--default-transition-duration", label: "Transitions", min: 0, max: 600, step: 10, unit: "ms" },
]

function ScopedShape({ entry }: { entry: string }) {
  const { tuning, change } = useEntry(entry)
  const tokens = useTokens()
  const set = (name: ScopedThemeVar, next: string | undefined) =>
    change((t) => {
      const theme = { ...t.tokens.theme }
      if (next === undefined) delete theme[name]
      else theme[name] = next
      return { ...t, tokens: { ...t.tokens, theme } }
    }, name)
  return (
    <>
      {scopedSliders.map((slider) => {
        const tuned = tuning.tokens.theme[slider.name]
        const value = parseFloat(tuned ?? tokens.theme[slider.name])
        const id = `scoped-${entry}-${slider.name.slice(2)}`
        return (
          <InspectorRow key={slider.name} label={slider.label} htmlFor={id}>
            <div className="flex items-center gap-2">
              <Slider
                id={id}
                aria-label={slider.label}
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={value}
                onValueChange={(next) => set(slider.name, `${Number(single(next).toFixed(4))}${slider.unit}`)}
              />
              <span className={cn("w-14 text-right font-mono text-xs tabular-nums", !tuned && "text-muted-foreground")}>
                {slider.unit === "rem" ? `${Math.round(value * 16 * 10) / 10}px` : `${value}ms`}
              </span>
              <ResetButton label={slider.label} disabled={!tuned} onClick={() => set(slider.name, undefined)} />
            </div>
          </InspectorRow>
        )
      })}
      <InspectorRow label="Easing" htmlFor={`scoped-${entry}-ease`}>
        <div className="flex items-center gap-2">
          <Select
            value={tuning.tokens.theme["--default-transition-timing-function"] ?? tokens.theme["--default-transition-timing-function"]}
            onValueChange={(next) => next && set("--default-transition-timing-function", next)}
          >
            <SelectTrigger id={`scoped-${entry}-ease`} className="w-full min-w-0">
              <SelectValue>{(v: string) => easings.find((e) => e.value === v)?.name ?? "custom"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {easings.map((easing) => (
                <SelectItem key={easing.value} value={easing.value}>
                  {easing.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ResetButton
            label="Easing"
            disabled={!tuning.tokens.theme["--default-transition-timing-function"]}
            onClick={() => set("--default-transition-timing-function", undefined)}
          />
        </div>
      </InspectorRow>
    </>
  )
}

function RefPicker({
  label,
  value,
  scheme,
  onChange,
}: {
  label: string
  value: string | undefined
  scheme: "light" | "dark"
  onChange: (value: string | undefined) => void
}) {
  const ds = useDesignSystems()
  const tokens = useTokens()
  const palette = ds.active?.system.palette
  if (!palette) return null
  const shown = value ? resolveValue(value, palette) : undefined
  const swatch = (color: string) =>
    color.startsWith("var(--") ? tokens[scheme][color.slice(6, -1)] : color
  const describe = (v: string) => {
    const ref = parsePaletteRef(v)
    if (ref) return `${palette.scales.find((s) => s.id === ref.scale)?.name ?? ref.scale} ${ref.step}`
    return parseTokenRef(v) ?? v
  }
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="min-w-0 flex-1 justify-start gap-1.5 px-1.5 font-mono text-xs" />}
        aria-label={`${label}: ${value ? describe(value) : "inherits"}`}
      >
        <span
          className="size-4 shrink-0 rounded-sm ring-1 ring-foreground/15"
          style={{ background: shown ? swatch(shown) : "transparent" }}
        />
        <span className="truncate">{value ? describe(value) : "inherits"}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Palette · {scheme}</span>
          {palette.scales
            .filter((s) => !s.hidden)
            .map((scale) => (
              <div key={scale.id} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-1.5">
                <span className="truncate text-[0.6875rem] text-muted-foreground">{scale.name}</span>
                <div className="grid grid-cols-12 gap-0.5">
                  {scale.steps.map((step, i) => {
                    const ref = paletteRef(scale.id, i + 1)
                    return (
                      <button
                        key={ref}
                        type="button"
                        title={`${scale.name} ${i + 1} · ${toHex(step)}`}
                        aria-label={`${scale.name} ${i + 1}`}
                        aria-pressed={value === ref}
                        onClick={() => onChange(ref)}
                        className={cn(
                          "aspect-square rounded-[3px] outline-none ring-offset-1 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring",
                          value === ref && "ring-2 ring-foreground"
                        )}
                        style={{ background: toCss(step) }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
        <Select value={parseTokenRef(value ?? "") ?? ""} onValueChange={(next) => next && onChange(`token:${next}`)}>
          <SelectTrigger className="w-full font-mono text-xs" aria-label="Use another token">
            <SelectValue placeholder="Or use another token…" />
          </SelectTrigger>
          <SelectContent>
            {colorTokens.map((token) => (
              <SelectItem key={token} value={token} className="font-mono text-xs">
                {token}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" disabled={!value} onClick={() => onChange(undefined)}>
          Inherit from the system
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function ScopedColours({ entry }: { entry: string }) {
  const { tuning, change } = useEntry(entry)
  const [adding, setAdding] = React.useState<string[]>([])
  const overridden = [...new Set([...Object.keys(tuning.tokens.light), ...Object.keys(tuning.tokens.dark), ...adding])].sort()
  const set = (scheme: "light" | "dark", token: string, next: string | undefined) =>
    change((t) => {
      const values = { ...t.tokens[scheme] }
      if (next === undefined) delete values[token]
      else values[token] = next
      return { ...t, tokens: { ...t.tokens, [scheme]: values } }
    })
  const remove = (token: string) => {
    setAdding((list) => list.filter((t) => t !== token))
    change((t) => {
      const light = { ...t.tokens.light }
      const dark = { ...t.tokens.dark }
      delete light[token]
      delete dark[token]
      return { ...t, tokens: { ...t.tokens, light, dark } }
    })
  }
  const available = colorTokens.filter((token) => !overridden.includes(token))
  return (
    <div className="flex flex-col gap-2">
      {overridden.length ? (
        <div className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1.5 text-xs">
          <span />
          <span className="text-muted-foreground">Light</span>
          <span className="text-muted-foreground">Dark</span>
          <span />
          {overridden.map((token) => (
            <React.Fragment key={token}>
              <span className="truncate font-mono" title={token}>
                {token}
              </span>
              <RefPicker label={`${token}, light`} value={tuning.tokens.light[token]} scheme="light" onChange={(v) => set("light", token, v)} />
              <RefPicker label={`${token}, dark`} value={tuning.tokens.dark[token]} scheme="dark" onChange={(v) => set("dark", token, v)} />
              <Button size="icon-xs" variant="ghost" aria-label={`Stop overriding ${token}`} onClick={() => remove(token)}>
                <XIcon />
              </Button>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-pretty">
          This entry uses the system&apos;s colours. Override a token inside it with a palette step or another token.
        </p>
      )}
      <Select value="" onValueChange={(token) => token && setAdding((list) => [...list, token as string])}>
        <SelectTrigger size="sm" className="w-full" aria-label="Override a colour token">
          <PlusIcon />
          <SelectValue placeholder="Override a colour…" />
        </SelectTrigger>
        <SelectContent>
          {colorGroups.map((group) => {
            const names = group.roles
              .flatMap((role) => [role.token, ...(role.on ? [role.on] : [])])
              .filter((name) => available.includes(name))
            return names.length ? (
              <SelectGroup key={group.title}>
                <SelectLabel>{group.title}</SelectLabel>
                {names.map((name) => (
                  <SelectItem key={name} value={name} className="font-mono text-xs">
                    {name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null
          })}
        </SelectContent>
      </Select>
    </div>
  )
}

function ProposalBanner({ entry }: { entry: string }) {
  const ds = useDesignSystems()
  const proposal = ds.proposals[entry]
  if (!proposal) return null
  const run = async (accept: boolean) => {
    const result = accept ? await ds.acceptProposal(entry) : await ds.rejectProposal(entry)
    if (!result.ok) toast.error(result.error)
    else toast(accept ? "Proposal added to your draft" : "Proposal rejected; the entry stays as it was")
  }
  return (
    <div className="m-4 flex flex-col gap-2 rounded-lg bg-muted p-4 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <SparklesIcon className="size-4 text-muted-foreground" />
        Claude proposed a tuning
      </span>
      <p className="text-muted-foreground text-pretty">{proposal.note}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => run(true)}>
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={() => run(false)}>
          Reject
        </Button>
      </div>
    </div>
  )
}

export function EntryTuner({ name, className }: { name: string; className?: string }) {
  const { ds, tuning, change } = useEntry(name)
  const knobs = entryKnobs[name] ?? []
  const count =
    Object.keys(tuning.knobs).length +
    Object.keys(tuning.tokens.theme).length +
    new Set([...Object.keys(tuning.tokens.light), ...Object.keys(tuning.tokens.dark)]).size
  const system = ds.active?.system.name

  if (!ds.restored) return <div className={className} />

  if (!ds.active)
    return (
      <InspectorPanel className={className} kind="Tuning" title="Stock shadcn">
        <p className="p-4 text-sm text-muted-foreground text-pretty">
          Stock is read-only. Pick or create a design system in the sidebar to tune this entry for it.
        </p>
      </InspectorPanel>
    )

  return (
    <InspectorPanel
      className={className}
      kind={`Tuning for ${system}`}
      title={count ? `${count} change${count === 1 ? "" : "s"}` : "Untuned"}
      dirty={count > 0}
      onRevert={() => change(() => emptyEntryTuning(name))}
    >
      <ProposalBanner entry={name} />
      <div className="flex shrink-0 items-center gap-1.5 px-4 pt-4 pb-2 text-xs text-muted-foreground">
        <Badge variant={count ? "default" : "outline"}>{count ? `Tuned for ${system}` : "Untuned"}</Badge>
        <span className="text-pretty">{count ? "Only these differences are saved." : "Ships as it is on this system's tokens."}</span>
      </div>
      {knobs.length ? (
        <InspectorSection title="Feel" summary={`${knobs.length} knob${knobs.length === 1 ? "" : "s"}`}>
          {knobs.map((knob) => (
            <KnobControl key={knob.key} entry={name} knob={knob} />
          ))}
        </InspectorSection>
      ) : null}
      <InspectorSection title="Shape and motion" summary="radius, spacing, transitions">
        <ScopedShape entry={name} />
      </InspectorSection>
      <InspectorSection title="Colours" summary="palette steps or tokens">
        <ScopedColours entry={name} />
      </InspectorSection>
    </InspectorPanel>
  )
}
