"use client"

import * as React from "react"

import { stockPalette, useDesignSystems } from "@/components/showcase/design-systems/provider"
import { paletteVars, resolveValue, scopedCss, type Palette } from "@/lib/design-systems/resolve"
import { paletteRef } from "@/lib/design-systems/schema"
import { deltaE, parseColor } from "@/lib/palette"
import { baseTokens } from "@/lib/tokens"
import { EntryTuningContext } from "@/lib/tuning"

export type FontOption = { id: string; label: string; family: string }

/** Theme-wide variables that can be tuned live. */
export type ThemeVar =
  | "--radius"
  | "--spacing"
  | "--font-sans"
  | "--font-heading"
  | "--font-mono"
  | "--default-transition-duration"
  | "--default-transition-timing-function"

export type Overrides = {
  light: Record<string, string>
  dark: Record<string, string>
  theme: Partial<Record<ThemeVar, string>>
}

export const themeDefaults: Record<ThemeVar, string> = {
  "--radius": baseTokens.light.radius ?? "0.625rem",
  "--spacing": "0.25rem",
  "--font-sans": "",
  "--font-heading": "",
  "--font-mono": "",
  "--default-transition-duration": "150ms",
  "--default-transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
}

const STORAGE_KEY = "unending:token-overrides"

type Context = {
  /** The active system's differences from stock, resolved to CSS values. */
  overrides: Overrides
  /** Base values merged with overrides, per scheme. */
  light: Record<string, string>
  dark: Record<string, string>
  theme: Record<ThemeVar, string>
  fonts: { sans: FontOption[]; heading: FontOption[]; mono: FontOption[] }
  /** Sets a colour token in the active system. A value that is exactly a palette step is stored as a reference to it. */
  setColor: (scheme: "light" | "dark", token: string, value: string | undefined) => void
  setTheme: (name: ThemeVar, value: string | undefined) => void
  /** Replaces every colour override in both schemes at once (a preset). Theme variables are kept. */
  setColors: (colors: { light: Record<string, string>; dark: Record<string, string> }) => void
  reset: () => void
  changed: number
  /** The raw stored values (palette refs kept), for undoing a preset. */
  stored: { light: Record<string, string>; dark: Record<string, string> }
}

const TokenContext = React.createContext<Context | null>(null)

export function useTokens() {
  const context = React.useContext(TokenContext)
  if (!context) throw new Error("useTokens must be used inside TokenOverridesProvider")
  return context
}

function block(selector: string, vars: Record<string, string | undefined>) {
  const body = Object.entries(vars)
    .filter(([, value]) => value)
    .map(([name, value]) => `  ${name.startsWith("--") ? name : `--${name}`}: ${value};`)
    .join("\n")
  return body ? `${selector} {\n${body}\n}` : ""
}

/** A colour that is exactly one of the palette's steps becomes a reference to that step. */
export function toStored(value: string, palette: Palette): string {
  if (value.startsWith("palette:") || value.startsWith("token:")) return value
  // Translucent values (dark-mode lines) keep their alpha, so they stay raw.
  if (value.includes("/")) return value
  const color = parseColor(value)
  if (!color) return value
  for (const scale of [...palette.scales].sort((a, b) => Number(a.hidden) - Number(b.hidden))) {
    const i = scale.steps.findIndex((step) => deltaE(step, color) < 0.25)
    if (i >= 0) return paletteRef(scale.id, i + 1)
  }
  return value
}

export function TokenOverridesProvider({
  fonts,
  children,
}: {
  fonts: { sans: FontOption[]; heading: FontOption[]; mono: FontOption[] }
  children: React.ReactNode
}) {
  const ds = useDesignSystems()
  const { active, update } = ds
  const palette = active?.system.palette ?? stockPalette
  const stored = React.useMemo(
    () => ({ light: active?.system.tokens.light ?? {}, dark: active?.system.tokens.dark ?? {} }),
    [active]
  )

  const allFonts = React.useMemo(() => [...fonts.sans, ...fonts.heading, ...fonts.mono], [fonts])
  const familyOf = React.useCallback((id: string) => allFonts.find((font) => font.id === id)?.family ?? id, [allFonts])
  const idOf = React.useCallback((family: string) => allFonts.find((font) => font.family === family)?.id ?? family, [allFonts])

  const resolve = (values: Record<string, string>) =>
    Object.fromEntries(Object.entries(values).map(([token, value]) => [token, resolveValue(value, palette)]))
  const themeStored = active?.system.tokens.theme ?? {}
  const overrides: Overrides = {
    light: resolve(stored.light),
    dark: resolve(stored.dark),
    theme: Object.fromEntries(
      Object.entries(themeStored).map(([name, value]) => [name, name.startsWith("--font-") ? familyOf(value!) : value])
    ) as Overrides["theme"],
  }

  const light = { ...baseTokens.light, ...overrides.light }
  const dark = { ...baseTokens.dark, ...overrides.dark }
  const theme = { ...themeDefaults, ...overrides.theme } as Record<ThemeVar, string>

  // Light overrides go on the root only when it isn't dark; dark overrides
  // follow the .dark class wherever it is. .ds-light and .ds-dark are full
  // scopes the system page uses to show both schemes side by side. The
  // palette's steps are variables too, and each tuned entry gets rules scoped
  // to its data-slot.
  const css = [
    active ? block("html:root", paletteVars(palette)) : "",
    block("html:root:not(.dark)", overrides.light),
    block(".dark", overrides.dark),
    block("html:root", overrides.theme),
    block(".ds-light", light),
    block(".ds-dark", dark),
    ...Object.entries(active?.entries ?? {}).map(([entry, tuning]) => scopedCss(entry, tuning, palette)),
  ]
    .filter(Boolean)
    .join("\n")

  const setScheme = (scheme: "light" | "dark", values: Record<string, string>, token: string, next: string | undefined) => {
    const copy = { ...values }
    if (next === undefined) delete copy[token]
    else {
      const value = toStored(next, palette)
      if (resolveValue(value, palette) === baseTokens[scheme][token]) delete copy[token]
      else copy[token] = value
    }
    return copy
  }

  const value: Context = {
    overrides,
    stored,
    light,
    dark,
    theme,
    fonts,
    changed:
      Object.keys(overrides.light).length +
      Object.keys(overrides.dark).length +
      Object.keys(overrides.theme).length,
    setColor: (scheme, token, next) =>
      update(
        (w) => ({
          ...w,
          system: {
            ...w.system,
            tokens: { ...w.system.tokens, [scheme]: setScheme(scheme, w.system.tokens[scheme], token, next) },
          },
        }),
        `color:${scheme}:${token}`
      ),
    setTheme: (name, next) =>
      update((w) => {
        const values = { ...w.system.tokens.theme }
        const stock = name.startsWith("--font-") ? undefined : themeDefaults[name]
        const isDefault = name.startsWith("--font-") ? next === undefined : next === stock
        if (next === undefined || isDefault) delete values[name]
        else values[name] = name.startsWith("--font-") ? idOf(next) : next
        return { ...w, system: { ...w.system, tokens: { ...w.system.tokens, theme: values } } }
      }, `theme:${name}`),
    setColors: (colors) =>
      update((w) => {
        const diff = (scheme: "light" | "dark") =>
          Object.fromEntries(
            Object.entries(colors[scheme])
              .map(([token, raw]) => [token, toStored(raw, w.system.palette)] as const)
              .filter(([token, value]) => resolveValue(value, w.system.palette) !== baseTokens[scheme][token])
          )
        return { ...w, system: { ...w.system, tokens: { ...w.system.tokens, light: diff("light"), dark: diff("dark") } } }
      }),
    reset: () =>
      update((w) => ({ ...w, system: { ...w.system, tokens: { light: {}, dark: {}, theme: {} } } })),
  }

  const knobValues = React.useMemo(
    () =>
      active
        ? Object.fromEntries(Object.entries(active.entries).map(([entry, tuning]) => [entry, tuning.knobs]))
        : null,
    [active]
  )

  return (
    <TokenContext.Provider value={value}>
      <style data-token-overrides="">{css}</style>
      <EntryTuningContext.Provider value={knobValues}>{children}</EntryTuningContext.Provider>
    </TokenContext.Provider>
  )
}

/** The pre-design-systems tuner state in this browser, if any (migrated into a first system). */
export function readLegacyOverrides(): Overrides | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = { light: {}, dark: {}, theme: {}, ...JSON.parse(raw) } as Overrides
    const count = Object.keys(parsed.light).length + Object.keys(parsed.dark).length + Object.keys(parsed.theme).length
    return count ? parsed : null
  } catch {
    return null
  }
}

export function clearLegacyOverrides() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem("unending:palette")
  } catch {}
}

/** CSS to paste into app/globals.css: the full :root and .dark blocks. */
export function exportCss(context: Pick<Context, "light" | "dark" | "theme" | "fonts">) {
  const { light, dark, theme, fonts } = context
  const lines = [
    "/* Paste over the :root and .dark blocks in app/globals.css, then run npm run registry:build. */",
    block(":root", { ...light, radius: theme["--radius"] }),
    "",
    block(".dark", dark),
  ]
  const extras: string[] = []
  if (theme["--spacing"] !== themeDefaults["--spacing"])
    extras.push(`  --spacing: ${theme["--spacing"]};`)
  if (theme["--default-transition-duration"] !== themeDefaults["--default-transition-duration"])
    extras.push(`  --default-transition-duration: ${theme["--default-transition-duration"]};`)
  if (
    theme["--default-transition-timing-function"] !==
    themeDefaults["--default-transition-timing-function"]
  )
    extras.push(
      `  --default-transition-timing-function: ${theme["--default-transition-timing-function"]};`
    )
  if (extras.length)
    lines.push("", "/* Add to a @theme block (not @theme inline) in app/globals.css. */", `@theme {\n${extras.join("\n")}\n}`)
  const picked = (["sans", "heading", "mono"] as const).flatMap((role) => {
    const font = fonts[role].find((option) => option.family === theme[`--font-${role}`])
    return font ? [`${font.label} as --font-${role}`] : []
  })
  if (picked.length)
    lines.push(
      "",
      `/* Fonts: load ${picked.join(", ")} with next/font in app/fonts.ts, and update the font-* items in registry.json. */`
    )
  if (picked.some((label) => label.includes("(local)")))
    lines.push("/* Graphik is licensed and local only: it can't go in registry.json or ship to other projects. */")
  return lines.join("\n")
}
