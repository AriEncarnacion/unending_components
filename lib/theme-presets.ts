// Theme presets: map palette scales onto every stock shadcn colour token, for
// light and dark, following shadcn's recipe (one neutral for surfaces, lines
// and text; one brand colour for primary, ring and charts) and Radix step
// roles, then enforce contrast by walking along the scale until each pair passes.

import { deltaE, oklchToOklab, STEPS, toCss, wcag, type Oklch, type Scale } from "./palette"

export type Recipe = {
  id: string
  name: string
  /** One line on the look. */
  description: string
  /** Why the colours belong together. */
  theory: string
  neutral: string
  /** Scale for primary, or "mono" for shadcn's near-black primary. */
  primary: string | "mono"
  /** Tints hover and highlight surfaces. Defaults to the neutral. */
  accent?: string
  danger: string
  charts: [string, string, string, string, string]
  /** Light background from a step instead of the neutral's lightest. */
  surface?: { scale: string; step: number }
  /** 0-based primary step per scheme, when the brand colour should be exact. */
  primaryStep?: { light?: number; dark?: number }
}

export const recipes: Recipe[] = [
  {
    id: "jade",
    name: "Jade",
    description: "Jade actions on a jade-tinted neutral.",
    theory:
      "Analogous: every surface carries a trace of the primary's hue, so the page reads as one material. Gold and blue in the charts sit far enough round the wheel to tell apart.",
    neutral: "neutral",
    primary: "jade",
    accent: "jade",
    danger: "danger",
    charts: ["jade", "info", "vein-gold", "aqua", "warning"],
  },
  {
    id: "mutton-fat",
    name: "Mutton-fat",
    description: "Your current direction: mutton-fat paper, obsidian greys, imperial jade.",
    theory:
      "Monochromatic: background, lines and text all come from the jade family at different lightness, so the only contrast is value. Calm and archival; gold carries the highlights in data.",
    neutral: "obsidian",
    primary: "jade",
    accent: "obsidian",
    danger: "danger",
    charts: ["jade", "info", "vein-gold", "aqua", "warning"],
    surface: { scale: "jade", step: 0 },
    primaryStep: { light: 9 },
  },
  {
    id: "imperial-gold",
    name: "Imperial and gold",
    description: "Imperial jade actions, vein-gold highlights.",
    theory:
      "Complementary accent: warm gold opposite cool green. Gold is kept to hover and highlight surfaces so it reads as warmth, not noise, and the green stays the one call to action.",
    neutral: "obsidian",
    primary: "jade",
    accent: "vein-gold",
    danger: "danger",
    charts: ["jade", "info", "vein-gold", "aqua", "warning"],
    surface: { scale: "jade", step: 0 },
    primaryStep: { light: 9 },
  },
  {
    id: "aqua",
    name: "Aqua jadeite",
    description: "Cooler: aqua actions, neutral surfaces.",
    theory:
      "Analogous and cool: aqua sits next to jade on the wheel, so the palette stays related while the interface feels quieter and more technical.",
    neutral: "neutral",
    primary: "aqua",
    accent: "aqua",
    danger: "danger",
    charts: ["aqua", "jade", "vein-gold", "info", "warning"],
  },
  {
    id: "verdant",
    name: "Verdant",
    description: "Bright green on jet. Light mode deepens the green so buttons hold 3:1 on the page; dark uses the key colour as is.",
    theory:
      "High-energy complement of a bright green against a blue-grey neutral. The green is light, so it takes dark text; jet keeps the surfaces cool so the green carries all the colour.",
    neutral: "jet",
    primary: "verdant",
    accent: "jet",
    danger: "danger",
    charts: ["verdant", "info", "warning", "aqua", "danger"],
    primaryStep: { light: 3, dark: 3 },
  },
  {
    id: "ink",
    name: "Ink",
    description: "Stock shadcn: near-black primary, colour only for data and status.",
    theory:
      "Achromatic controls on a barely-tinted neutral, the shadcn default. Nothing competes with content; the palette appears only in charts and status, where it carries meaning.",
    neutral: "neutral",
    primary: "mono",
    danger: "danger",
    charts: ["jade", "info", "vein-gold", "aqua", "warning"],
  },
]

export type Check = {
  scheme: "light" | "dark"
  label: string
  value: number
  min: number
  unit: "ratio" | "ΔE"
  pass: boolean
}

export type PresetResult = {
  light: Record<string, string>
  dark: Record<string, string>
  checks: Check[]
  /** Scales the recipe needs that the palette no longer has. */
  missing: string[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Blend in OKLab, t = 0 gives a, 1 gives b. */
function mix(a: Oklch, b: Oklch, t: number): Oklch {
  const [l1, a1, b1] = oklchToOklab(a)
  const [l2, a2, b2] = oklchToOklab(b)
  const [l, x, y] = [l1 + (l2 - l1) * t, a1 + (a2 - a1) * t, b1 + (b2 - b1) * t]
  const c = Math.hypot(x, y)
  return { l, c, h: c < 0.0002 ? a.h : ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 }
}

function nearestL(scale: Scale, l: number) {
  let best = 0
  scale.steps.forEach((step, i) => {
    if (Math.abs(step.l - l) < Math.abs(scale.steps[best].l - l)) best = i
  })
  return best
}

/** From `start`, step toward darker (+1) or lighter (-1) until `ok` holds. */
function walk(scale: Scale, start: number, direction: 1 | -1, ok: (color: Oklch) => boolean) {
  for (let i = start; i >= 0 && i < STEPS; i += direction) if (ok(scale.steps[i])) return scale.steps[i]
  return scale.steps[direction === 1 ? STEPS - 1 : 0]
}

/** The candidate with the most contrast against the background. */
function bestInk(background: Oklch, candidates: Oklch[]) {
  return candidates.reduce((best, c) => (wcag(c, background) > wcag(best, background) ? c : best))
}

type Colors = Record<string, Oklch | string>

function build(scheme: "light" | "dark", recipe: Recipe, get: (id: string) => Scale): Colors {
  const N = get(recipe.neutral)
  const A = recipe.accent && recipe.accent !== recipe.neutral ? get(recipe.accent) : null
  const P = recipe.primary === "mono" ? null : get(recipe.primary)
  const D = get(recipe.danger)
  const n = N.steps
  const light = scheme === "light"
  const darker: 1 | -1 = light ? 1 : -1

  const background = light
    ? recipe.surface
      ? get(recipe.surface.scale).steps[recipe.surface.step]
      : n[0]
    : n[STEPS - 1]
  const foreground = light ? n[STEPS - 1] : n[0]
  const raised = light ? background : mix(n[STEPS - 1], n[STEPS - 2], 0.5)
  const quiet = light ? mix(background, n[1], 0.4) : n[STEPS - 2]

  // Primary: the brand step, then moved along the scale until it stands off
  // the page (3:1) and carries its own text (4.5:1).
  let primary: Oklch
  if (!P) primary = light ? n[STEPS - 1] : n[1]
  else {
    const start = light ? (recipe.primaryStep?.light ?? 8) : (recipe.primaryStep?.dark ?? nearestL(P, 0.72))
    primary = walk(P, start, darker, (c) => {
      const ink = bestInk(c, [P.steps[0], P.steps[STEPS - 1], n[0], n[STEPS - 1]])
      return wcag(c, background) >= 3 && wcag(ink, c) >= 4.5
    })
  }
  const primaryInk = P
    ? bestInk(primary, [P.steps[0], P.steps[STEPS - 1], n[0], n[STEPS - 1]])
    : light
      ? n[0]
      : n[STEPS - 1]

  const mutedInk = walk(N, light ? 6 : 4, darker, (c) => wcag(c, background) >= 4.5 && wcag(c, quiet) >= 4.5)
  const accent = A ? (light ? A.steps[1] : A.steps[STEPS - 2]) : quiet
  const accentInk = A ? bestInk(accent, [A.steps[0], A.steps[STEPS - 1], foreground]) : foreground
  const destructive = walk(D, nearestL(D, light ? 0.55 : 0.7), darker, (c) => wcag(c, background) >= 4.5)
  // Status colours work like destructive: text and tints on the page.
  const status = (id: string) => walk(get(id), nearestL(get(id), light ? 0.55 : 0.75), darker, (c) => wcag(c, background) >= 4.5)
  const ringScale = P ?? N
  const ring = walk(ringScale, nearestL(ringScale, light ? 0.62 : 0.55), darker, (c) => wcag(c, background) >= 3)
  // Charts: each series takes the step (3:1 against the page) furthest from
  // the series before it, so a muted palette still separates by lightness
  // as well as hue. That also helps readers with colour-vision deficiency.
  const target = light ? 0.58 : 0.72
  const charts: Oklch[] = []
  for (const id of recipe.charts) {
    const options = get(id).steps.filter((c) => wcag(c, background) >= 3)
    const pool = options.length ? options : [walk(get(id), nearestL(get(id), target), darker, () => false)]
    const score = (c: Oklch) =>
      (charts.length ? Math.min(...charts.map((prev) => deltaE(c, prev))) : 0) - 25 * Math.abs(c.l - target)
    charts.push(pool.reduce((best, c) => (score(c) > score(best) ? c : best)))
  }
  const line = (alpha: number) => toCss(n[0]).replace(/\)$/, ` / ${Math.round(alpha * 100)}%)`)
  const sidebar = light ? mix(background, n[1], 0.2) : raised
  const sidebarAccent = A ? accent : light ? mix(background, n[1], 0.55) : n[STEPS - 2]

  return {
    background,
    foreground,
    card: raised,
    "card-foreground": foreground,
    popover: raised,
    "popover-foreground": foreground,
    primary,
    "primary-foreground": primaryInk,
    secondary: quiet,
    "secondary-foreground": foreground,
    muted: quiet,
    "muted-foreground": mutedInk,
    accent,
    "accent-foreground": accentInk,
    destructive,
    success: status("success"),
    warning: status("warning"),
    info: status("info"),
    // shadcn draws dark-mode lines as translucent light, so they suit any surface.
    border: light ? n[1] : line(0.1),
    input: light ? mix(n[1], n[2], 0.5) : line(0.15),
    ring,
    ...Object.fromEntries(charts.map((c, i) => [`chart-${i + 1}`, c])),
    sidebar,
    "sidebar-foreground": foreground,
    "sidebar-primary": primary,
    "sidebar-primary-foreground": primaryInk,
    "sidebar-accent": sidebarAccent,
    "sidebar-accent-foreground": A ? accentInk : foreground,
    "sidebar-border": light ? n[1] : line(0.1),
    "sidebar-ring": ring,
  }
}

const pairs: [string, string, number, string][] = [
  ["foreground", "background", 7, "Body text"],
  ["card-foreground", "card", 4.5, "Text on cards"],
  ["popover-foreground", "popover", 4.5, "Text in menus"],
  ["primary-foreground", "primary", 4.5, "Primary button label"],
  ["primary", "background", 3, "Primary stands off the page"],
  ["secondary-foreground", "secondary", 4.5, "Secondary button label"],
  ["muted-foreground", "background", 4.5, "Captions on the page"],
  ["muted-foreground", "muted", 4.5, "Captions in wells"],
  ["accent-foreground", "accent", 4.5, "Text on hover"],
  ["destructive", "background", 4.5, "Error text"],
  ["success", "background", 4.5, "Success text"],
  ["warning", "background", 4.5, "Warning text"],
  ["info", "background", 4.5, "Info text"],
  ["ring", "background", 3, "Focus ring"],
  ["sidebar-foreground", "sidebar", 4.5, "Sidebar text"],
  ["sidebar-accent-foreground", "sidebar-accent", 4.5, "Sidebar hover text"],
  ["chart-1", "background", 3, "Chart 1 on the page"],
  ["chart-2", "background", 3, "Chart 2 on the page"],
  ["chart-3", "background", 3, "Chart 3 on the page"],
  ["chart-4", "background", 3, "Chart 4 on the page"],
  ["chart-5", "background", 3, "Chart 5 on the page"],
]

function checksFor(scheme: "light" | "dark", colors: Colors): Check[] {
  const out: Check[] = pairs.flatMap(([fg, bg, min, label]) => {
    const a = colors[fg]
    const b = colors[bg]
    if (typeof a === "string" || typeof b === "string") return []
    const value = wcag(a, b)
    return [{ scheme, label, value, min, unit: "ratio" as const, pass: value >= min }]
  })
  // Chart series should be told apart from each other, not just the page.
  const series = [1, 2, 3, 4, 5].map((i) => colors[`chart-${i}`]).filter((c): c is Oklch => typeof c !== "string")
  let closest = Infinity
  for (let i = 0; i < series.length; i++)
    for (let j = i + 1; j < series.length; j++) closest = Math.min(closest, deltaE(series[i], series[j]))
  out.push({ scheme, label: "Chart series apart", value: closest, min: 10, unit: "ΔE", pass: closest >= 10 })
  return out
}

const css = (colors: Colors) =>
  Object.fromEntries(Object.entries(colors).map(([token, value]) => [token, typeof value === "string" ? value : toCss(value)]))

const statusScales = ["success", "warning", "info"]

export function buildPreset(recipe: Recipe, scales: Scale[]): PresetResult {
  const needed = [
    recipe.neutral,
    recipe.primary,
    recipe.accent,
    recipe.danger,
    ...statusScales,
    ...recipe.charts,
    recipe.surface?.scale,
  ].filter((id): id is string => !!id && id !== "mono")
  const missing = [...new Set(needed.filter((id) => !scales.some((s) => s.id === id)))]
  if (missing.length) return { light: {}, dark: {}, checks: [], missing }
  const get = (id: string) => scales.find((s) => s.id === id)!
  const light = build("light", recipe, get)
  const dark = build("dark", recipe, get)
  return { light: css(light), dark: css(dark), checks: [...checksFor("light", light), ...checksFor("dark", dark)], missing }
}
