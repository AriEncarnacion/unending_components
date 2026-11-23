"use client"

import * as React from "react"
import { CopyIcon, RotateCcwIcon } from "lucide-react"

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
import { formatOklch, hexToOklch, parseOklch, toHex, toRGBA } from "@/lib/color"
import { colorGroups, easings } from "@/lib/tokens"
import { exportCss, themeDefaults, useTokens, type ThemeVar } from "@/components/showcase/token-overrides"
import { InspectorPanel, InspectorRow, InspectorSection } from "@/registry/unending/inspector-panel/inspector-panel"
import { PaletteSwatches, PresetList } from "@/components/showcase/palette/theme-presets"
import { recipes } from "@/lib/theme-presets"
import { useDesignSystems } from "@/components/showcase/design-systems/provider"
import { flowOptions, leadingOptions } from "@/lib/design-systems/type-scale"

import { formatPx, Readout, toPx, useMounted } from "./section"

const single = (value: number | readonly number[]) => (Array.isArray(value) ? value[0] : value) as number

function ColorEditor({ token, scheme }: { token: string; scheme: "light" | "dark" }) {
  const tokens = useTokens()
  const values = scheme === "dark" ? tokens.dark : tokens.light
  const value = values[token] ?? ""
  const parsed = parseOklch(value)
  const rgba = toRGBA(value)
  const changed = tokens.overrides[scheme][token] !== undefined
  const set = (next: string | undefined) => tokens.setColor(scheme, token, next)
  const id = (part: string) => `tune-${scheme}-${token}-${part}`
  const channel = (name: "l" | "c" | "h" | "alpha", label: string, max: number, step: number, display: (n: number) => string) =>
    parsed ? (
      <InspectorRow label={label} htmlFor={id(name)}>
        <div className="flex items-center gap-3">
          <Slider
            id={id(name)}
            aria-label={`${token} ${label}`}
            min={0}
            max={max}
            step={step}
            value={parsed[name]}
            onValueChange={(next) => set(formatOklch({ ...parsed, [name]: single(next) }))}
          />
          <Readout value={display(parsed[name])} className="w-12 text-right" />
        </div>
      </InspectorRow>
    ) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label
          className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border focus-within:ring-3 focus-within:ring-ring/50"
          style={{ background: value }}
        >
          <span className="sr-only">Pick {token}</span>
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={rgba ? toHex(rgba) : "#000000"}
            onChange={(event) => set(hexToOklch(event.target.value))}
          />
        </label>
        <Input
          aria-label={`${token} value`}
          className="font-mono text-xs"
          value={value}
          onChange={(event) => set(event.target.value)}
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Reset ${token}`}
          disabled={!changed}
          onClick={() => set(undefined)}
        >
          <RotateCcwIcon />
        </Button>
      </div>
      {channel("l", "Lightness", 1, 0.005, (n) => n.toFixed(3))}
      {channel("c", "Chroma", 0.37, 0.002, (n) => n.toFixed(3))}
      {channel("h", "Hue", 360, 1, (n) => `${Math.round(n)}°`)}
      {parsed && parsed.alpha < 1 ? channel("alpha", "Alpha", 1, 0.01, (n) => `${Math.round(n * 100)}%`) : null}
      {!parsed ? (
        <p className="text-xs text-muted-foreground">Not an oklch() value, so only the picker and text field apply.</p>
      ) : null}
    </div>
  )
}

function ThemeSlider({
  name,
  label,
  min,
  max,
  step,
  unit,
  display,
}: {
  name: ThemeVar
  label: string
  min: number
  max: number
  step: number
  unit: "rem" | "ms"
  display: (value: string) => string
}) {
  const { theme, setTheme, overrides } = useTokens()
  const current = parseFloat(theme[name])
  const id = `tune-${name.slice(2)}`
  return (
    <InspectorRow label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <Slider
          id={id}
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={current}
          onValueChange={(next) => setTheme(name, `${Number(single(next).toFixed(4))}${unit}`)}
        />
        <Readout value={display(theme[name])} className="w-14 text-right" />
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Reset ${label}`}
          disabled={overrides.theme[name] === undefined}
          onClick={() => setTheme(name, undefined)}
        >
          <RotateCcwIcon />
        </Button>
      </div>
    </InspectorRow>
  )
}

/** A theme variable picked from named presets, with its value shown. */
function PresetSelect({
  name,
  label,
  options,
  stock,
}: {
  name: ThemeVar
  label: string
  options: { name: string; value: string }[]
  /** The label for "not set", when stock has no single value. */
  stock?: string
}) {
  const { theme, setTheme, overrides } = useTokens()
  const id = `tune-${name.slice(2)}`
  const current = theme[name] || "stock"
  const describe = (value: string) => {
    if (value === "stock") return stock ?? "Stock"
    const option = options.find((o) => o.value === value)
    return option ? `${option.name} (${option.value})` : value
  }
  return (
    <InspectorRow label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <Select value={current} onValueChange={(value) => value && setTheme(name, value === "stock" ? undefined : value)}>
          <SelectTrigger id={id} className="min-w-0 flex-1">
            <SelectValue>{describe}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {stock ? <SelectItem value="stock">{stock}</SelectItem> : null}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.name}
                <span className="ml-auto font-mono text-xs text-muted-foreground">{option.value}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Reset ${label}`}
          disabled={overrides.theme[name] === undefined}
          onClick={() => setTheme(name, undefined)}
        >
          <RotateCcwIcon />
        </Button>
      </div>
    </InspectorRow>
  )
}

export function Tuner({
  token,
  onTokenChange,
  scheme,
  onSchemeChange,
  className,
}: {
  token: string
  onTokenChange: (token: string) => void
  scheme: "light" | "dark"
  onSchemeChange: (scheme: "light" | "dark") => void
  className?: string
}) {
  const tokens = useTokens()
  const ds = useDesignSystems()
  const mounted = useMounted()
  const { theme, fonts, setTheme, changed, reset } = tokens
  const css = exportCss(tokens)
  const fontValue = (role: "sans" | "heading" | "mono") => theme[`--font-${role}`] || fonts[role][0].family
  const fontLabel = (role: "sans" | "heading" | "mono") =>
    fonts[role].find((f) => f.family === fontValue(role))?.label

  return (
    <InspectorPanel
      className={className}
      kind={ds.active ? `${ds.active.system.name} tokens` : "Stock · read-only"}
      title={changed ? `${changed} change${changed === 1 ? "" : "s"} from stock` : "Matches stock"}
      dirty={changed > 0}
      onRevert={reset}
    >
      {!mounted ? (
        <p className="p-3 text-sm text-muted-foreground">Loading tuner…</p>
      ) : (
        <>
          <InspectorSection title="Presets" summary={`${recipes.length} built from /palette`} defaultOpen={false}>
            <p className="text-xs text-muted-foreground text-pretty">
              Each preset maps the palette scales onto every colour token in both schemes, shadcn-style, then moves along each
              scale until text, controls, focus rings and charts meet their contrast targets.
            </p>
            <PresetList compact />
          </InspectorSection>

          <InspectorSection title="Colour" summary={token}>
            <div className="flex items-center gap-2">
              <Select value={token} onValueChange={(value) => value && onTokenChange(value)}>
                <SelectTrigger className="min-w-0 flex-1 font-mono text-xs" aria-label="Token">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorGroups.map((group) => (
                    <SelectGroup key={group.title}>
                      <SelectLabel>{group.title}</SelectLabel>
                      {group.roles.flatMap((role) => [role.token, ...(role.on ? [role.on] : [])]).map((name) => (
                        <SelectItem key={name} value={name} className="font-mono text-xs">
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <ToggleGroup
                variant="outline"
                size="sm"
                value={[scheme]}
                onValueChange={(value) => value[0] && onSchemeChange(value[0] as "light" | "dark")}
                aria-label="Scheme"
              >
                <ToggleGroupItem value="light">Light</ToggleGroupItem>
                <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <ColorEditor key={`${scheme}-${token}`} token={token} scheme={scheme} />
            <PaletteSwatches token={token} scheme={scheme} />
          </InspectorSection>

          <InspectorSection title="Shape and space" summary={`${theme["--radius"]} · ${theme["--spacing"]}`}>
            <ThemeSlider name="--radius" label="Radius" min={0} max={1.5} step={0.025} unit="rem" display={(v) => formatPx(toPx(v))} />
            <ThemeSlider name="--spacing" label="Spacing unit" min={0.1875} max={0.3125} step={0.0078125} unit="rem" display={(v) => formatPx(toPx(v))} />
          </InspectorSection>

          <InspectorSection
            title="Type"
            summary={`${fontLabel("heading")} · ${fontLabel("sans")} · ${fontLabel("mono")}`}
          >
            {(["heading", "sans", "mono"] as const).map((role) => (
              <InspectorRow
                key={role}
                label={{ heading: "Headings", sans: "Body", mono: "Mono" }[role]}
                htmlFor={`tune-font-${role}`}
              >
                <Select
                  value={fontValue(role)}
                  onValueChange={(value) =>
                    value && setTheme(`--font-${role}`, value === fonts[role][0].family ? undefined : value)
                  }
                >
                  <SelectTrigger id={`tune-font-${role}`} className="w-full">
                    <SelectValue>{(value: string) => fonts[role].find((f) => f.family === value)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fonts[role].map((font) => (
                      <SelectItem key={font.id} value={font.family}>
                        <span style={{ fontFamily: font.family }}>{font.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InspectorRow>
            ))}
            <ThemeSlider
              name="--text-sm"
              label="Size"
              min={0.75}
              max={1.0625}
              step={0.03125}
              unit="rem"
              display={(v) => formatPx(toPx(v))}
            />
            <PresetSelect
              name="--leading-body"
              label="Leading"
              options={leadingOptions}
              stock="Stock (per size)"
            />
            <PresetSelect name="--spacing-flow" label="Flow" options={flowOptions} />
            <p className="text-xs text-muted-foreground text-pretty">
              Size is UI text (text-sm); the whole text scale follows it. Leading is the line height of running text, xs
              to lg. Flow is the space between paragraphs (space-y-flow).
            </p>
          </InspectorSection>

          <InspectorSection
            title="Motion"
            summary={`${theme["--default-transition-duration"]} · ${easings.find((e) => e.value === theme["--default-transition-timing-function"])?.name ?? "custom"}`}
          >
            <ThemeSlider
              name="--default-transition-duration"
              label="Duration"
              min={50}
              max={600}
              step={10}
              unit="ms"
              display={(v) => v}
            />
            <InspectorRow label="Curve" htmlFor="tune-curve">
              <Select
                value={theme["--default-transition-timing-function"]}
                onValueChange={(value) => value && setTheme("--default-transition-timing-function", value)}
              >
                <SelectTrigger id="tune-curve" className="w-full">
                  <SelectValue>{(value: string) => easings.find((e) => e.value === value)?.name ?? "custom"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {easings.map((easing) => (
                    <SelectItem key={easing.name} value={easing.value}>
                      {easing.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InspectorRow>
            <p className="text-xs text-muted-foreground">
              Applies to transition-* utilities without their own duration. Default {themeDefaults["--default-transition-duration"]}, ease-in-out.
            </p>
          </InspectorSection>

          <div className="flex flex-col gap-2 p-3">
            <Dialog>
              <DialogTrigger render={<Button className="w-full" />}>
                <CopyIcon data-icon="inline-start" />
                Export CSS
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Export the tuned tokens</DialogTitle>
                  <DialogDescription>
                    Paste over the :root and .dark blocks in app/globals.css, then run npm run registry:build so
                    every catalog entry picks them up.
                  </DialogDescription>
                </DialogHeader>
                <CodeBlock size="sm">
                  <CodeBlockActions>
                    <CodeBlockCopyButton value={css} />
                  </CodeBlockActions>
                  <CodeBlockContent className="max-h-[60svh]">{css}</CodeBlockContent>
                </CodeBlock>
              </DialogContent>
            </Dialog>
            <p className="text-xs text-muted-foreground">
              Changes are kept in this browser and apply across the catalog until you revert.
            </p>
          </div>
        </>
      )}
    </InspectorPanel>
  )
}
