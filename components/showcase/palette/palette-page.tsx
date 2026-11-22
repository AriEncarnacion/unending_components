"use client"

import * as React from "react"
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  Redo2Icon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  Undo2Icon,
} from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import { useTokens } from "@/components/showcase/token-overrides"
import { safeScaleId } from "@/lib/design-systems/schema"
import { Section } from "@/components/showcase/system/section"
import {
  BLACK,
  deltaE,
  gamutOf,
  inkOn,
  paint,
  parseColor,
  perceived,
  referenceCurves,
  scaleFromKey,
  slug,
  STEPS,
  stepRoles,
  toCss,
  toHex,
  wcag,
  WHITE,
  type KeyColor,
  type Oklch,
  type Scale,
  type Vision,
} from "@/lib/palette"

import { ContrastMatrix, Curves, UsagePreview } from "./palette-charts"
import { PresetList } from "./theme-presets"
import {
  nearestSteps,
  PaletteEditor,
  themeTokens,
  useScheme,
  type Target,
} from "./palette-editor"
import {
  mapKey,
  mapScale,
  seedState,
  uniqueId,
  usePalette,
  type PaletteApi,
  type PaletteState,
} from "./use-palette"

type LabelMode = "hex" | "oklch" | "lightness" | "contrast"
type Surface = "page" | "white" | "black"

const labelModes: { value: LabelMode; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "oklch", label: "OKLCH" },
  { value: "lightness", label: "Lightness" },
  { value: "contrast", label: "Contrast on white / black" },
]
const visions: { value: Vision; label: string }[] = [
  { value: "normal", label: "Normal vision" },
  { value: "grayscale", label: "Lightness only" },
  { value: "protanopia", label: "Protanopia (red-blind)" },
  { value: "deuteranopia", label: "Deuteranopia (green-blind)" },
  { value: "tritanopia", label: "Tritanopia (blue-blind)" },
]
const surfaces: { value: Surface; label: string }[] = [
  { value: "page", label: "On the page" },
  { value: "white", label: "On white" },
  { value: "black", label: "On black" },
]

function stepLabel(color: Oklch, mode: LabelMode, vision: Vision) {
  if (mode === "hex") return toHex(color)
  if (mode === "oklch")
    return `${(color.l * 100).toFixed(1)} ${color.c.toFixed(3)} ${Math.round(color.h)}`
  if (mode === "lightness") return `L ${(color.l * 100).toFixed(1)}`
  const seen = perceived(color, vision)
  return `${wcag(seen, WHITE).toFixed(1)} / ${wcag(seen, BLACK).toFixed(1)}`
}

// ── Export ──────────────────────────────────────────────────────────────────

function exportText(
  state: PaletteState,
  format: "css" | "tailwind" | "json",
  includeHidden: boolean
) {
  const scales = state.scales.filter((s) => includeHidden || !s.hidden)
  const keys = state.keys.filter((k) => includeHidden || !k.hidden)
  if (format === "json") {
    const out: Record<string, Record<string, string> | string> = {}
    for (const scale of scales)
      out[slug(scale.name)] = Object.fromEntries(
        scale.steps.map((c, i) => [String(i + 1), toHex(c)])
      )
    for (const key of keys) out[slug(key.name)] = toHex(key.color)
    return JSON.stringify(out, null, 2)
  }
  const prefix = format === "tailwind" ? "--color-" : "--"
  const lines = scales.flatMap((scale) => [
    `  /* ${scale.name} */`,
    ...scale.steps.map(
      (c, i) =>
        `  ${prefix}${slug(scale.name)}-${i + 1}: ${toCss(c)}; /* ${toHex(c)} */`
    ),
  ])
  if (keys.length)
    lines.push(
      "  /* Key colours */",
      ...keys.map(
        (k) =>
          `  ${prefix}${slug(k.name)}: ${toCss(k.color)}; /* ${toHex(k.color)} */`
      )
    )
  if (format === "tailwind")
    return [
      "/* Add to app/globals.css. Gives you bg-jade-9, text-jade-12, border-aqua-7 and so on. */",
      `@theme {\n${lines.join("\n")}\n}`,
    ].join("\n")
  return [
    "/* Raw palette variables. Point semantic tokens at them, e.g. --primary: var(--jade-9). */",
    `:root {\n${lines.join("\n")}\n}`,
  ].join("\n")
}

function ExportDialog({ state }: { state: PaletteState }) {
  const [includeHidden, setIncludeHidden] = React.useState(false)
  const formats = [
    { value: "tailwind", label: "Tailwind @theme" },
    { value: "css", label: "CSS variables" },
    { value: "json", label: "JSON (hex)" },
  ] as const
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <CopyIcon data-icon="inline-start" />
        Export
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export the palette</DialogTitle>
          <DialogDescription>
            OKLCH values with hex alongside. The palette is raw colour; the
            theme’s semantic tokens (background, primary…) are set on /system or
            with “Use in theme”.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Switch
            id="export-hidden"
            checked={includeHidden}
            onCheckedChange={setIncludeHidden}
          />
          <Label htmlFor="export-hidden">
            Include hidden scales and colours
          </Label>
        </div>
        <Tabs defaultValue="tailwind" className="min-w-0">
          <TabsList>
            {formats.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {formats.map((f) => {
            const text = exportText(state, f.value, includeHidden)
            return (
              <TabsContent key={f.value} value={f.value}>
                <CodeBlock size="sm">
                  <CodeBlockActions>
                    <CodeBlockCopyButton value={text} />
                  </CodeBlockActions>
                  <CodeBlockContent className="max-h-[55svh]">
                    {text}
                  </CodeBlockContent>
                </CodeBlock>
              </TabsContent>
            )
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ── Add a scale ─────────────────────────────────────────────────────────────

function AddScale({
  api,
  reference,
  onAdded,
}: {
  api: PaletteApi
  reference: ReturnType<typeof referenceCurves>
  onAdded: (id: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [value, setValue] = React.useState("#26d150")
  const color = parseColor(value)
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!color) return
    const label = name.trim() || `Scale ${api.state.scales.length + 1}`
    const id = uniqueId(
      safeScaleId(slug(label)),
      api.state.scales.map((s) => s.id)
    )
    api.update((s) => ({
      ...s,
      scales: [...s.scales, scaleFromKey(id, label, color, reference)],
    }))
    onAdded(id)
    setOpen(false)
    setName("")
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" variant="outline" />}>
        <PlusIcon data-icon="inline-start" />
        Add scale
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Builds 12 steps around a key colour on the curves of the visible
            scales.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-name">Name</Label>
            <Input
              id="add-name"
              placeholder="Moss"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-color">Key colour</Label>
            <div className="flex items-center gap-2">
              <label
                className="relative size-8 shrink-0 overflow-hidden rounded-lg border"
                style={{ background: color ? toCss(color) : undefined }}
              >
                <span className="sr-only">Pick a key colour</span>
                <input
                  type="color"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={color ? toHex(color) : "#000000"}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              <Input
                id="add-color"
                className="font-mono text-xs"
                value={value}
                aria-invalid={!color}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={!color}>
            Add scale
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

// ── Key colours and theme tokens ────────────────────────────────────────────

function NearestHint({ color, scales }: { color: Oklch; scales: Scale[] }) {
  const [best] = nearestSteps(color, scales, 1)
  if (!best) return null
  return (
    <span className="text-xs text-muted-foreground">
      ≈ {best.scale.name} {best.i + 1} · ΔE {best.delta.toFixed(1)}
    </span>
  )
}

function KeyCard({
  item,
  scales,
  vision,
  selected,
  onSelect,
  onToggle,
}: {
  item: KeyColor
  scales: Scale[]
  vision: Vision
  selected: boolean
  onSelect: () => void
  onToggle: () => void
}) {
  return (
    <div className="group/key flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Edit ${item.name}`}
        className={cn(
          "h-24 rounded-xl border transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          selected &&
            "ring-2 ring-foreground ring-offset-2 ring-offset-background"
        )}
        style={{ background: paint(item.color, vision) }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-heading text-base leading-snug font-medium text-balance">
            {item.name}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {toHex(item.color)}
          </span>
          <NearestHint color={item.color} scales={scales} />
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Hide ${item.name}`}
          onClick={onToggle}
        >
          <EyeOffIcon />
        </Button>
      </div>
    </div>
  )
}

function TokenCard({
  token,
  label,
  scales,
  vision,
  selected,
  onSelect,
}: {
  token: string
  label: string
  scales: Scale[]
  vision: Vision
  selected: boolean
  onSelect: () => void
}) {
  const tokens = useTokens()
  const scheme = useScheme()
  const light = parseColor(tokens.light[token] ?? "")
  const dark = parseColor(tokens.dark[token] ?? "")
  const current = scheme === "dark" ? dark : light
  const tuned =
    tokens.overrides.light[token] !== undefined ||
    tokens.overrides.dark[token] !== undefined
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Edit theme ${label.toLowerCase()}`}
        className={cn(
          "grid h-24 grid-cols-2 overflow-hidden rounded-xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          selected &&
            "ring-2 ring-foreground ring-offset-2 ring-offset-background"
        )}
      >
        {[
          { name: "Light", color: light },
          { name: "Dark", color: dark },
        ].map(({ name, color }) => (
          <span
            key={name}
            className="flex items-end p-2 text-[0.65rem] font-medium"
            style={
              color
                ? {
                    background: paint(color, vision),
                    color: inkOn(perceived(color, vision)),
                  }
                : undefined
            }
          >
            {name}
          </span>
        ))}
      </button>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 truncate font-heading text-base font-medium">
          {label}
          {tuned ? (
            <Badge variant="secondary" className="h-4 px-1.5 text-[0.6rem]">
              tuned
            </Badge>
          ) : null}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {light ? toHex(light) : "—"} · {dark ? toHex(dark) : "—"}
        </span>
        {current ? <NearestHint color={current} scales={scales} /> : null}
      </div>
    </div>
  )
}

// ── Grid ────────────────────────────────────────────────────────────────────

function ScaleGrid({
  scales,
  target,
  onTarget,
  onToggle,
  label,
  vision,
  showRoles,
  showOriginal,
  surface,
}: {
  scales: Scale[]
  target: Target | null
  onTarget: (target: Target) => void
  onToggle: (id: string) => void
  label: LabelMode
  vision: Vision
  showRoles: boolean
  showOriginal: boolean
  surface: Surface
}) {
  const grid = React.useRef<HTMLDivElement>(null)
  const columns = "grid-cols-[8.5rem_repeat(12,minmax(4rem,1fr))]"
  // Fixed surfaces get fixed ink; on the page the theme decides.
  const ink =
    surface === "white"
      ? { color: "#171717", background: "#ffffff" }
      : surface === "black"
        ? { color: "#f5f5f5", background: "#000000" }
        : undefined
  const muted =
    surface === "white"
      ? { color: "#737373" }
      : surface === "black"
        ? { color: "#a3a3a3" }
        : undefined
  const move = (row: number, step: number) => {
    const scale = scales[row]
    if (!scale) return
    onTarget({ kind: "step", scale: scale.id, step })
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-cell="${row}-${step}"]`)
      ?.focus()
  }
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border",
        surface === "white" && "border-transparent",
        surface === "black" && "border-transparent"
      )}
      style={
        surface === "white"
          ? { background: "#ffffff" }
          : surface === "black"
            ? { background: "#000000" }
            : undefined
      }
    >
      <div
        ref={grid}
        className="flex min-w-[60rem] flex-col gap-1.5 p-3"
        role="grid"
        aria-label="Colour scales"
      >
        <div role="row" className={cn("grid gap-1.5", columns)}>
          <span
            role="columnheader"
            className="sticky left-0 z-20 -ml-3 bg-background pl-3"
            style={ink}
          >
            <span className="sr-only">Scale</span>
          </span>
          {stepRoles.map((role, i) => (
            <span
              key={role}
              role="columnheader"
              className="flex flex-col px-1 font-mono text-xs text-muted-foreground"
              style={muted}
            >
              {i + 1}
              {showRoles ? (
                <span className="font-sans text-[0.6rem] leading-tight">
                  {role}
                </span>
              ) : null}
            </span>
          ))}
        </div>
        {scales.map((scale, row) => (
          <React.Fragment key={scale.id}>
            {scale.semantic && !scales[row - 1]?.semantic ? (
              <div role="row" className="pt-3">
                <span
                  role="rowheader"
                  className="sticky left-0 -ml-3 bg-background pl-3 text-xs font-medium text-muted-foreground"
                  style={ink}
                >
                  Neutral and status
                </span>
              </div>
            ) : null}
            <div
              role="row"
              className={cn("grid items-stretch gap-1.5", columns)}
            >
              <div
                role="rowheader"
                className="sticky left-0 z-20 -ml-3 flex min-w-0 items-center gap-1 bg-background pr-1 pl-3 text-foreground"
                style={ink}
              >
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Hide ${scale.name}`}
                  className="shrink-0 opacity-60 hover:opacity-100"
                  onClick={() => onToggle(scale.id)}
                >
                  <EyeOffIcon />
                </Button>
                <button
                  type="button"
                  className="line-clamp-2 min-w-0 rounded text-left text-sm leading-tight font-medium break-words outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() =>
                    onTarget({
                      kind: "step",
                      scale: scale.id,
                      step: target?.kind === "step" ? target.step : 8,
                    })
                  }
                >
                  {scale.name}
                  {scale.generator ? (
                    <span className="ml-1 text-[0.6rem] font-normal opacity-60">
                      gen
                    </span>
                  ) : null}
                </button>
              </div>
              {scale.steps.map((color, step) => {
                const selected =
                  target?.kind === "step" &&
                  target.scale === scale.id &&
                  target.step === step
                const seen = perceived(color, vision)
                const ink = inkOn(seen)
                const original = scale.original[step]
                const moved =
                  showOriginal && original && deltaE(color, original) > 0.5
                const gamut = gamutOf(color)
                return (
                  <button
                    key={step}
                    type="button"
                    role="gridcell"
                    data-cell={`${row}-${step}`}
                    aria-selected={selected}
                    aria-label={`${scale.name} ${step + 1}, ${toHex(color)}`}
                    tabIndex={
                      selected || (!target && row === 0 && step === 0) ? 0 : -1
                    }
                    onClick={() =>
                      onTarget({ kind: "step", scale: scale.id, step })
                    }
                    onKeyDown={(event) => {
                      const delta = {
                        ArrowLeft: [0, -1],
                        ArrowRight: [0, 1],
                        ArrowUp: [-1, 0],
                        ArrowDown: [1, 0],
                      }[event.key]
                      if (!delta) return
                      event.preventDefault()
                      move(
                        Math.min(
                          scales.length - 1,
                          Math.max(0, row + delta[0])
                        ),
                        Math.min(STEPS - 1, Math.max(0, step + delta[1]))
                      )
                    }}
                    className={cn(
                      "relative flex h-16 flex-col justify-between overflow-hidden rounded-md p-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring",
                      selected && "z-10 ring-2 ring-offset-2",
                      selected &&
                        (surface === "black"
                          ? "ring-white ring-offset-black"
                          : surface === "white"
                            ? "ring-black ring-offset-white"
                            : "ring-foreground ring-offset-background")
                    )}
                    style={{ background: paint(color, vision), color: ink }}
                  >
                    <span className="flex items-start justify-between font-mono text-[0.65rem] leading-none font-medium">
                      {step + 1}
                      {gamut !== "srgb" ? (
                        <span
                          className="rounded-sm px-0.5 text-[0.55rem] ring-1 ring-current"
                          title={
                            gamut === "p3"
                              ? "Outside sRGB"
                              : "Outside sRGB and P3"
                          }
                        >
                          {gamut === "p3" ? "P3" : "!"}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "truncate font-mono text-[0.6rem] leading-none tabular-nums opacity-80",
                        moved && "mb-2"
                      )}
                    >
                      {stepLabel(color, label, vision)}
                    </span>
                    {moved ? (
                      <span
                        className="absolute inset-x-0 bottom-0 h-1.5"
                        style={{ background: paint(original, vision) }}
                        title={`Started as ${toHex(original)}`}
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export function PalettePage() {
  const api = usePalette()
  const { state, update, undo, redo, canUndo, canRedo } = api
  const [target, setTarget] = React.useState<Target | null>(null)
  const [label, setLabel] = React.useState<LabelMode>("hex")
  const [vision, setVision] = React.useState<Vision>("normal")
  const [surface, setSurface] = React.useState<Surface>("page")
  const [showRoles, setShowRoles] = React.useState(false)
  const [showOriginal, setShowOriginal] = React.useState(true)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const wide = React.useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia("(min-width: 80rem)")
      media.addEventListener("change", notify)
      return () => media.removeEventListener("change", notify)
    },
    () => window.matchMedia("(min-width: 80rem)").matches,
    () => true
  )

  const visible = state.scales.filter((s) => !s.hidden)
  const hiddenScales = state.scales.filter((s) => s.hidden)
  const visibleKeys = state.keys.filter((k) => !k.hidden)
  const hiddenKeys = state.keys.filter((k) => k.hidden)
  const reference = React.useMemo(() => {
    const shown = state.scales.filter((s) => !s.hidden)
    return referenceCurves(shown.length ? shown : state.scales)
  }, [state.scales])
  const activeScale =
    (target?.kind === "step" &&
      state.scales.find((s) => s.id === target.scale)) ||
    visible[0] ||
    state.scales[0]

  const select = (next: Target | null) => {
    setTarget(next)
    if (next && !wide) setSheetOpen(true)
  }
  const toggleScale = (id: string) =>
    update((s) => mapScale(s, id, (sc) => ({ ...sc, hidden: !sc.hidden })))
  const toggleKey = (id: string) =>
    update((s) => mapKey(s, id, (k) => ({ ...k, hidden: !k.hidden })))
  const setAll = (hidden: boolean) =>
    update((s) => ({
      ...s,
      scales: s.scales.map((sc) => ({ ...sc, hidden })),
      keys: s.keys.map((k) => ({ ...k, hidden })),
    }))

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z")
        return
      // Text fields keep their own undo; sliders, buttons and swatches don't.
      const el = event.target as HTMLElement | null
      const typing =
        el instanceof HTMLInputElement
          ? !["range", "checkbox", "radio", "color", "button"].includes(el.type)
          : el?.tagName === "TEXTAREA" || el?.isContentEditable
      if (typing) return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo])

  // The palette lives in this browser, so render once it's restored: no flash
  // of the seed colours and no server/client float drift in the charts.
  if (!api.restored)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <h1 className="text-3xl font-semibold tracking-tight">Palette</h1>
        <p className="text-sm text-muted-foreground">Loading your palette…</p>
      </div>
    )

  const editor = (className: string) => (
    <PaletteEditor
      target={target}
      onTarget={select}
      api={api}
      reference={reference}
      className={className}
    />
  )

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="flex min-w-0 flex-col gap-14">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Palette
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
            Grade and refine the jade palette in OKLCH. Edit any step, drag the
            curves, check contrast and colour-vision, then export the scales or
            push a step into the theme.
          </p>
          <div
            role="toolbar"
            aria-label="Palette tools"
            className="flex flex-wrap items-center gap-2"
          >
            <div className="flex">
              <Button
                size="icon-sm"
                variant="outline"
                className="rounded-r-none"
                aria-label="Undo"
                title="Undo (⌘Z)"
                disabled={!canUndo}
                onClick={undo}
              >
                <Undo2Icon />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                className="-ml-px rounded-l-none"
                aria-label="Redo"
                title="Redo (⇧⌘Z)"
                disabled={!canRedo}
                onClick={redo}
              >
                <Redo2Icon />
              </Button>
            </div>
            <Select
              value={label}
              onValueChange={(value) => value && setLabel(value as LabelMode)}
            >
              <SelectTrigger size="sm" aria-label="Step labels">
                <SelectValue>
                  {(value: string) =>
                    `Label: ${labelModes.find((m) => m.value === value)?.label}`
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {labelModes.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={vision}
              onValueChange={(value) => value && setVision(value as Vision)}
            >
              <SelectTrigger size="sm" aria-label="Vision">
                <SelectValue>
                  {(value: string) =>
                    visions.find((v) => v.value === value)?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {visions.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={surface}
              onValueChange={(value) => value && setSurface(value as Surface)}
            >
              <SelectTrigger size="sm" aria-label="Surface">
                <SelectValue>
                  {(value: string) =>
                    surfaces.find((s) => s.value === value)?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {surfaces.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Toggle
              size="sm"
              variant="outline"
              pressed={showRoles}
              onPressedChange={setShowRoles}
            >
              Step roles
            </Toggle>
            <Toggle
              size="sm"
              variant="outline"
              pressed={showOriginal}
              onPressedChange={setShowOriginal}
            >
              Show originals
            </Toggle>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="sm" variant="outline" />}
              >
                <EyeIcon data-icon="inline-start" />
                Visible {visible.length + visibleKeys.length}/
                {state.scales.length + state.keys.length}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Scales</DropdownMenuLabel>
                  {state.scales.map((scale) => (
                    <DropdownMenuCheckboxItem
                      key={scale.id}
                      checked={!scale.hidden}
                      onCheckedChange={() => toggleScale(scale.id)}
                    >
                      <span
                        className="size-3 rounded-sm border"
                        style={{ background: toCss(scale.steps[8]) }}
                      />
                      {scale.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Key colours</DropdownMenuLabel>
                  {state.keys.map((key) => (
                    <DropdownMenuCheckboxItem
                      key={key.id}
                      checked={!key.hidden}
                      onCheckedChange={() => toggleKey(key.id)}
                    >
                      <span
                        className="size-3 rounded-sm border"
                        style={{ background: toCss(key.color) }}
                      />
                      {key.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAll(false)}>
                  Show all
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAll(true)}>
                  Hide all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AddScale
              api={api}
              reference={reference}
              onAdded={(id) => select({ kind: "step", scale: id, step: 0 })}
            />
            <ExportDialog state={state} />
            <Button
              size="sm"
              variant="ghost"
              disabled={api.readOnly || JSON.stringify(state) === JSON.stringify(seedState)}
              onClick={() => {
                update(() => seedState)
                setTarget(null)
                toast("Palette reset to the starting colours", {
                  action: { label: "Undo", onClick: undo },
                })
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reset all
            </Button>
          </div>
        </header>

        <Section
          id="keys"
          title="Key colours"
          description="The named colours the palette grows from, with your live theme tokens beside them. ≈ is the nearest step in the visible scales."
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {visibleKeys.map((item) => (
              <KeyCard
                key={item.id}
                item={item}
                scales={state.scales}
                vision={vision}
                selected={target?.kind === "key" && target.id === item.id}
                onSelect={() => select({ kind: "key", id: item.id })}
                onToggle={() => toggleKey(item.id)}
              />
            ))}
          </div>
          {hiddenKeys.length ? (
            <HiddenLine items={hiddenKeys} onShow={toggleKey} noun="colours" />
          ) : null}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">In the theme now</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {themeTokens.map(({ token, label: name }) => (
                <TokenCard
                  key={token}
                  token={token}
                  label={name}
                  scales={state.scales}
                  vision={vision}
                  selected={target?.kind === "token" && target.token === token}
                  onSelect={() => select({ kind: "token", token })}
                />
              ))}
            </div>
          </div>
        </Section>

        <Section
          id="scales"
          title="Scales"
          description="Twelve steps per colour, light to dark. Click a step to edit it; arrow keys move around the grid. A strip under a step shows where it started."
        >
          {visible.length ? (
            <ScaleGrid
              scales={visible}
              target={target}
              onTarget={select}
              onToggle={toggleScale}
              label={label}
              vision={vision}
              showRoles={showRoles}
              showOriginal={showOriginal}
              surface={surface}
            />
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Every scale is hidden.
            </p>
          )}
          {hiddenScales.length ? (
            <HiddenLine
              items={hiddenScales}
              onShow={toggleScale}
              noun="scales"
            />
          ) : null}
        </Section>

        <Section
          id="presets"
          title="Theme presets"
          description="Each preset maps these scales onto every shadcn colour token in light and dark: one neutral for surfaces, lines and text, one brand scale for primary, focus and charts, the danger, success, warning and info scales for the status tokens. It then moves along each scale until every pair meets its contrast target. Applying one changes the theme across the catalog, the same as the tuner on /system."
        >
          <PresetList />
        </Section>

        <Section
          id="analyse"
          title="Grade"
          description={`Curves across the visible scales, and contrast and usage for ${activeScale?.name ?? "the selected scale"}.`}
        >
          <Tabs defaultValue="curves" className="min-w-0 gap-4">
            <TabsList>
              <TabsTrigger value="curves">Curves</TabsTrigger>
              <TabsTrigger value="contrast">Contrast pairs</TabsTrigger>
              <TabsTrigger value="usage">In use</TabsTrigger>
            </TabsList>
            <TabsContent value="curves">
              <Curves
                scales={visible}
                selected={activeScale?.id}
                vision={vision}
                reference={reference.lightness}
                onSelect={(scale, step) =>
                  setTarget({ kind: "step", scale, step })
                }
                onChange={(scale, step, channel, value) =>
                  update(
                    (s) =>
                      mapScale(s, scale, (sc) => ({
                        ...sc,
                        steps: sc.steps.map((c, i) =>
                          i === step ? { ...c, [channel]: value } : c
                        ),
                      })),
                    `curve-${scale}-${step}-${channel}`
                  )
                }
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Drag a point of the selected scale, or focus it and use the
                arrow keys (Shift for bigger steps). Click a line to select its
                scale.
              </p>
            </TabsContent>
            <TabsContent value="contrast">
              {activeScale ? (
                <ContrastMatrix scale={activeScale} vision={vision} />
              ) : null}
            </TabsContent>
            <TabsContent value="usage">
              {activeScale ? (
                <UsagePreview scale={activeScale} vision={vision} />
              ) : null}
            </TabsContent>
          </Tabs>
        </Section>
      </div>

      {wide ? (
        <aside aria-label="Palette editor" className="hidden xl:block">
          <div className="sticky top-16">{editor("h-[calc(100svh-5rem)]")}</div>
        </aside>
      ) : (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          {target ? (
            <Button
              className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-20 shadow-lg"
              onClick={() => setSheetOpen(true)}
            >
              <SlidersHorizontalIcon data-icon="inline-start" />
              Edit
            </Button>
          ) : null}
          <SheetContent className="w-full gap-0 p-0 sm:max-w-sm">
            <SheetHeader className="sr-only">
              <SheetTitle>Palette editor</SheetTitle>
              <SheetDescription>
                Edit the selected step, key colour or theme token in OKLCH.
              </SheetDescription>
            </SheetHeader>
            {editor("h-full rounded-none border-0")}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function HiddenLine({
  items,
  onShow,
  noun,
}: {
  items: { id: string; name: string }[]
  onShow: (id: string) => void
  noun: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <span>Hidden {noun}:</span>
      {items.map((item) => (
        <Button
          key={item.id}
          size="xs"
          variant="outline"
          onClick={() => onShow(item.id)}
        >
          <EyeIcon data-icon="inline-start" />
          {item.name}
        </Button>
      ))}
    </div>
  )
}
