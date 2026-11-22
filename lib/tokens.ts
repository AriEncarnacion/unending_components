import registry from "@/registry.json"

/** The catalog theme as committed: the `theme` item, synced from app/globals.css. */
const themeItem = registry.items.find((item) => item.name === "theme") as {
  cssVars: { theme: Record<string, string>; light: Record<string, string>; dark: Record<string, string> }
}
export const baseTokens = themeItem.cssVars

export type ColorRole = {
  token: string
  /** The token drawn on top of it, if it has one. */
  on?: string
  use: string
}

export type ColorGroup = { title: string; description: string; roles: ColorRole[] }

export const colorGroups: ColorGroup[] = [
  {
    title: "Surfaces",
    description: "Where content sits. Page, raised cards, and floating layers like menus and popovers.",
    roles: [
      { token: "background", on: "foreground", use: "The page and most text." },
      { token: "card", on: "card-foreground", use: "Raised, bounded content: cards, panels." },
      { token: "popover", on: "popover-foreground", use: "Floating layers: dropdown menus, select lists, popovers, dialogs and sheets. Tooltips are inverted instead (foreground on background)." },
    ],
  },
  {
    title: "Actions",
    description: "What can be pressed, from the one main thing to the quiet alternatives.",
    roles: [
      { token: "primary", on: "primary-foreground", use: "The main action, selection, the playhead." },
      { token: "secondary", on: "secondary-foreground", use: "Alternative actions next to a primary one." },
      { token: "accent", on: "accent-foreground", use: "Hover and highlight backgrounds in menus and lists." },
    ],
  },
  {
    title: "Status",
    description: "What happened or needs attention. Each is used as text, icons and tints (bg-success/10), not a solid fill, the way shadcn uses destructive.",
    roles: [
      { token: "destructive", use: "Errors and actions that delete." },
      { token: "success", use: "Done, saved, passed. Added by the catalog; not in stock shadcn." },
      { token: "warning", use: "Needs attention but nothing is broken yet. Added by the catalog." },
      { token: "info", use: "Neutral notices and tips. Added by the catalog." },
    ],
  },
  {
    title: "Quiet",
    description: "Supporting surfaces and secondary text.",
    roles: [{ token: "muted", on: "muted-foreground", use: "Wells, placeholders; muted-foreground for captions and meta." }],
  },
  {
    title: "Lines and focus",
    description: "Boundaries and the keyboard focus ring.",
    roles: [
      { token: "border", use: "Dividers and component outlines." },
      { token: "input", use: "Form control borders (and fills in dark mode)." },
      { token: "ring", use: "Focus rings, usually at 50% (ring-ring/50)." },
    ],
  },
  {
    title: "Charts",
    description: "An ordered series for data. In base-nova neutral these are greys.",
    roles: [1, 2, 3, 4, 5].map((n) => ({ token: `chart-${n}`, use: `Series ${n}.` })),
  },
  {
    title: "Sidebar",
    description: "A parallel set so app navigation can differ from the page.",
    roles: [
      { token: "sidebar", on: "sidebar-foreground", use: "Sidebar surface and text." },
      { token: "sidebar-primary", on: "sidebar-primary-foreground", use: "Active or branded item." },
      { token: "sidebar-accent", on: "sidebar-accent-foreground", use: "Hover and current item." },
      { token: "sidebar-border", use: "Sidebar dividers." },
      { token: "sidebar-ring", use: "Sidebar focus ring." },
    ],
  },
]

export const radiusSteps = [
  { name: "sm", className: "rounded-sm", factor: 0.6 },
  { name: "md", className: "rounded-md", factor: 0.8 },
  { name: "lg", className: "rounded-lg", factor: 1 },
  { name: "xl", className: "rounded-xl", factor: 1.4 },
  { name: "2xl", className: "rounded-2xl", factor: 1.8 },
  { name: "3xl", className: "rounded-3xl", factor: 2.2 },
  { name: "4xl", className: "rounded-4xl", factor: 2.6 },
] as const

export const shadowSteps = [
  { name: "2xs", className: "shadow-2xs" },
  { name: "xs", className: "shadow-xs" },
  { name: "sm", className: "shadow-sm" },
  { name: "md", className: "shadow-md" },
  { name: "lg", className: "shadow-lg" },
  { name: "xl", className: "shadow-xl" },
  { name: "2xl", className: "shadow-2xl" },
] as const

export const typeSteps = [
  { name: "xs", className: "text-xs" },
  { name: "sm", className: "text-sm" },
  { name: "base", className: "text-base" },
  { name: "lg", className: "text-lg" },
  { name: "xl", className: "text-xl" },
  { name: "2xl", className: "text-2xl" },
  { name: "3xl", className: "text-3xl" },
  { name: "4xl", className: "text-4xl" },
  { name: "5xl", className: "text-5xl" },
  { name: "6xl", className: "text-6xl" },
] as const

export const weights = [
  { name: "normal", className: "font-normal", value: 400 },
  { name: "medium", className: "font-medium", value: 500 },
  { name: "semibold", className: "font-semibold", value: 600 },
  { name: "bold", className: "font-bold", value: 700 },
] as const

export const tracking = [
  { name: "tighter", className: "tracking-tighter", value: "-0.05em" },
  { name: "tight", className: "tracking-tight", value: "-0.025em" },
  { name: "normal", className: "tracking-normal", value: "0" },
  { name: "wide", className: "tracking-wide", value: "0.025em" },
  { name: "widest", className: "tracking-widest", value: "0.1em" },
] as const

export const leading = [
  { name: "tight", className: "leading-tight", value: "1.25" },
  { name: "snug", className: "leading-snug", value: "1.375" },
  { name: "normal", className: "leading-normal", value: "1.5" },
  { name: "relaxed", className: "leading-relaxed", value: "1.625" },
  { name: "loose", className: "leading-loose", value: "2" },
] as const

export const spacingSteps = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32] as const

export const breakpoints = [
  { name: "sm", value: "40rem", px: 640 },
  { name: "md", value: "48rem", px: 768, note: "Sidebar switches to a sheet below this" },
  { name: "lg", value: "64rem", px: 1024 },
  { name: "xl", value: "80rem", px: 1280 },
  { name: "2xl", value: "96rem", px: 1536 },
] as const

export type Easing = {
  name: string
  value: string
  /** A Tailwind token or default that uses it, if any. */
  token?: string
  use: string
  /** In the current system, or an option to consider. */
  inSystem: boolean
}

export const easings: Easing[] = [
  { name: "ease-out", value: "cubic-bezier(0, 0, 0.2, 1)", token: "ease-out", use: "Things arriving: popovers, toasts, entering content.", inSystem: true },
  { name: "ease-in-out", value: "cubic-bezier(0.4, 0, 0.2, 1)", token: "ease-in-out · default transition", use: "Things moving while on screen. The default for every transition-* utility.", inSystem: true },
  { name: "ease-in", value: "cubic-bezier(0.4, 0, 1, 1)", token: "ease-in", use: "Things leaving. Rarely right on its own; feels sluggish at the start.", inSystem: true },
  { name: "linear", value: "linear", token: "ease-linear", use: "Progress, spinners, the sidebar's width change.", inSystem: true },
  { name: "ease (CSS)", value: "ease", token: "tw-animate default", use: "What animate-in/out uses unless a component overrides it.", inSystem: true },
  { name: "out-quart", value: "cubic-bezier(0.25, 1, 0.5, 1)", use: "Confident entrances with a soft landing.", inSystem: false },
  { name: "out-expo", value: "cubic-bezier(0.16, 1, 0.3, 1)", use: "Fast start, long settle. Sheets and big panels.", inSystem: false },
  { name: "snap", value: "cubic-bezier(0.23, 1, 0.32, 1)", token: "MessageScroller button", use: "Snappy UI feedback; shadcn uses it for the jump-to-latest button.", inSystem: false },
  { name: "drawer", value: "cubic-bezier(0.32, 0.72, 0, 1)", use: "iOS-like drawers and sheets.", inSystem: false },
  { name: "in-out-cubic", value: "cubic-bezier(0.645, 0.045, 0.355, 1)", use: "Symmetric moves; Bearing's Now button.", inSystem: false },
  { name: "MU fade", value: "cubic-bezier(0.25, 0, 0, 1)", use: "archival's single motion curve: things appear, they don't arrive.", inSystem: false },
  {
    name: "spring",
    value:
      "linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1)",
    use: "A bouncy spring as a CSS linear() curve. Playful; use sparingly.",
    inSystem: false,
  },
]

export const durations = [
  { ms: 100, where: "Menus, selects, dropdowns enter/exit (duration-100)" },
  { ms: 150, where: "Default for transition-* and animate-in/out" },
  { ms: 200, where: "Collapsible, sheet, sidebar, trace panels (duration-200)" },
  { ms: 300, where: "Larger surfaces; the limit for UI that blocks input" },
  { ms: 500, where: "Page-level or decorative motion" },
] as const

/** Samples a CSS easing into points (x, y), for plotting. */
export function sampleEasing(value: string, steps = 48): [number, number][] {
  const bezier = value.match(/cubic-bezier\(([^)]+)\)/)
  const named: Record<string, string> = {
    ease: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    linear: "cubic-bezier(0, 0, 1, 1)",
  }
  if (named[value]) return sampleEasing(named[value], steps)
  if (bezier) {
    const [x1, y1, x2, y2] = bezier[1].split(",").map(Number)
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      const u = 1 - t
      return [3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3, 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3]
    })
  }
  const linear = value.match(/^linear\((.+)\)$/)
  if (linear) {
    const stops = linear[1].split(",").map((part) => {
      const [v, p] = part.trim().split(/\s+/)
      return { y: Number(v), x: p ? parseFloat(p) / 100 : undefined as number | undefined }
    })
    stops[0].x ??= 0
    stops[stops.length - 1].x ??= 1
    for (let i = 1; i < stops.length - 1; i++) {
      if (stops[i].x !== undefined) continue
      let j = i
      while (stops[j].x === undefined) j++
      const from = stops[i - 1].x as number
      const to = stops[j].x as number
      for (let k = i; k < j; k++) stops[k].x = from + ((to - from) * (k - i + 1)) / (j - i + 1)
    }
    return stops.map((stop) => [stop.x as number, stop.y])
  }
  return [[0, 0], [1, 1]]
}
