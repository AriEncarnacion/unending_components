// Turns stored values (palette refs, token refs, font ids) into CSS, either
// as concrete colours for the showcase or as var() references for the
// installed theme. Shared by the showcase and the build scripts.
import { toCss, type Scale } from "../palette.ts"
import {
  parsePaletteRef,
  parseTokenRef,
  type EntryTuningFile,
  type SystemFile,
} from "./schema.ts"

export type Palette = SystemFile["palette"]

/** "palette:jade-8" → the step's colour; anything else is returned as is. */
export function resolveValue(value: string, palette: Palette): string {
  const ref = parsePaletteRef(value)
  if (ref) {
    const scale = palette.scales.find((s) => s.id === ref.scale)
    const step = scale?.steps[ref.step - 1]
    return step ? toCss(step) : value
  }
  const token = parseTokenRef(value)
  if (token) return `var(--${token})`
  return value
}

/** "palette:jade-8" → "var(--jade-8)", "token:accent" → "var(--accent)". For shipped CSS. */
export function toVar(value: string): string {
  const ref = parsePaletteRef(value)
  if (ref) return `var(--${ref.scale}-${ref.step})`
  const token = parseTokenRef(value)
  if (token) return `var(--${token})`
  return value
}

/** Every visible scale as --<id>-<n> variables. Hidden scales are exploratory and don't ship. */
export function paletteVars(palette: Palette): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const scale of palette.scales.filter((s: Scale) => !s.hidden))
    scale.steps.forEach((step, i) => (vars[`--${scale.id}-${i + 1}`] = toCss(step)))
  return vars
}

/** Colour tokens with stock underneath and the system's differences on top. */
export function effectiveTokens(
  stock: { light: Record<string, string>; dark: Record<string, string> },
  system: SystemFile | null,
  mode: "css" | "var"
) {
  const map = (values: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(values).map(([token, value]) => [
        token,
        mode === "var" ? toVar(value) : resolveValue(value, system!.palette),
      ])
    )
  return {
    light: { ...stock.light, ...(system ? map(system.tokens.light) : {}) },
    dark: { ...stock.dark, ...(system ? map(system.tokens.dark) : {}) },
  }
}

/** An entry's scoped overrides as CSS custom properties, per scheme. */
export function scopedVars(tuning: EntryTuningFile, palette: Palette, mode: "css" | "var") {
  const value = (v: string) => (mode === "var" ? toVar(v) : resolveValue(v, palette))
  const props = (values: Record<string, string>) =>
    Object.fromEntries(Object.entries(values).map(([token, v]) => [`--${token}`, value(v)]))
  return {
    light: props(tuning.tokens.light),
    dark: props(tuning.tokens.dark),
    theme: { ...tuning.tokens.theme } as Record<string, string>,
  }
}

/** Selectors for an entry's scoped rules. Light is guarded so it can't leak into dark. */
export function scopedSelectors(entry: string) {
  const slot = `[data-slot="${entry}"]`
  return { theme: slot, light: `:root:not(.dark) ${slot}`, dark: `.dark ${slot}` }
}

function block(selector: string, vars: Record<string, string>) {
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n")
  return body ? `${selector} {\n${body}\n}` : ""
}

/** The scoped rules as a CSS string (the showcase's live style tag). */
export function scopedCss(entry: string, tuning: EntryTuningFile, palette: Palette) {
  const vars = scopedVars(tuning, palette, "css")
  const selectors = scopedSelectors(entry)
  return [block(selectors.theme, vars.theme), block(selectors.light, vars.light), block(selectors.dark, vars.dark)]
    .filter(Boolean)
    .join("\n")
}
