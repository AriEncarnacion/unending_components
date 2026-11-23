import { STEPS, type KeyColor, type Scale } from "../palette.ts"
import { fontById } from "./fonts.ts"
import { toRem } from "./type-scale.ts"

export type SystemId = string
export type EntryName = string
export type TokenName = string

export type ThemeVar =
  | "--radius"
  | "--spacing"
  | "--font-sans"
  | "--font-heading"
  | "--font-mono"
  | "--text-sm"
  | "--leading-body"
  | "--spacing-flow"
  | "--default-transition-duration"
  | "--default-transition-timing-function"

export type ScopedThemeVar = "--radius" | "--spacing" | "--default-transition-duration" | "--default-transition-timing-function"

export const themeVars: ThemeVar[] = [
  "--radius",
  "--spacing",
  "--font-sans",
  "--font-heading",
  "--font-mono",
  "--text-sm",
  "--leading-body",
  "--spacing-flow",
  "--default-transition-duration",
  "--default-transition-timing-function",
]
export const scopedThemeVars: ScopedThemeVar[] = [
  "--radius",
  "--spacing",
  "--default-transition-duration",
  "--default-transition-timing-function",
]

export type PaletteRef = `palette:${string}`
export type TokenRef = `token:${string}`

export type Origin = { kind: "stock" } | { kind: "duplicate"; from: SystemId } | { kind: "preset"; preset: string }

export type SystemFile = {
  version: 1
  id: SystemId
  name: string
  origin: Origin
  tokens: {
    light: Record<TokenName, string>
    dark: Record<TokenName, string>
    theme: Partial<Record<ThemeVar, string>>
  }
  palette: { scales: Scale[]; keys: KeyColor[] }
}

export type EntryTuningFile = {
  version: 1
  entry: EntryName
  tokens: {
    light: Record<TokenName, string>
    dark: Record<TokenName, string>
    theme: Partial<Record<ScopedThemeVar, string>>
  }
  knobs: Record<string, KnobValue>
}

export type ProposalFile = EntryTuningFile & { note: string }

export type KnobValue = number | string | boolean

export type Knob = {
  key: string
  label: string
  kind: "duration" | "easing" | "distance" | "number" | "enum" | "boolean" | "text"
  default: KnobValue
  description?: string
  min?: number
  max?: number
  step?: number
  unit?: "ms" | "px" | "%" | "days" | "hours"
  options?: string[]
}

export type Working = { system: SystemFile; entries: Record<EntryName, EntryTuningFile> }

export type Committed = Working & { hash: string; proposals: Record<EntryName, ProposalFile> }

export type Draft = {
  version: 1
  savedHash: string
  system: SystemFile
  entries: Record<EntryName, EntryTuningFile>
}

export const STOCK_ID = "stock"

export const reservedSystemIds = [STOCK_ID, "api", "preview", "r", "fonts", "_next", "static", "new", "settings"]

export const reservedScaleIds = [
  "background",
  "foreground",
  "card",
  "popover",
  "primary",
  "secondary",
  "muted",
  "accent",
  "destructive",
  "success",
  "warning",
  "info",
  "border",
  "input",
  "ring",
  "chart",
  "sidebar",
  "radius",
  "spacing",
  "font",
  "color",
  "default",
  "stock",
]
export const semanticScaleIds = ["neutral", "danger", "warning", "success", "info"]

export const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function safeScaleId(base: string) {
  const id = idPattern.test(base) ? base : "scale"
  return !semanticScaleIds.includes(id) && reservedScaleIds.includes(id.split("-")[0]) ? `${id}-scale` : id
}

export function scaleReferences(working: Working, scaleId: string): string[] {
  const uses: string[] = []
  const scan = (prefix: string, values: Record<string, string>) => {
    for (const [token, value] of Object.entries(values))
      if (parsePaletteRef(value)?.scale === scaleId) uses.push(`${prefix}${token}`)
  }
  scan("light ", working.system.tokens.light)
  scan("dark ", working.system.tokens.dark)
  for (const [entry, tuning] of Object.entries(working.entries)) {
    scan(`${entry} light `, tuning.tokens.light)
    scan(`${entry} dark `, tuning.tokens.dark)
  }
  return uses
}

export function emptyEntryTuning(entry: EntryName): EntryTuningFile {
  return { version: 1, entry, tokens: { light: {}, dark: {}, theme: {} }, knobs: {} }
}

export function isEmptyTuning(tuning: EntryTuningFile) {
  return (
    !Object.keys(tuning.tokens.light).length &&
    !Object.keys(tuning.tokens.dark).length &&
    !Object.keys(tuning.tokens.theme).length &&
    !Object.keys(tuning.knobs).length
  )
}

export function paletteRef(scaleId: string, step: number): PaletteRef {
  return `palette:${scaleId}-${step}`
}

export function parsePaletteRef(value: string): { scale: string; step: number } | null {
  const match = /^palette:([a-z0-9-]+)-(\d+)$/.exec(value)
  if (!match) return null
  return { scale: match[1], step: Number(match[2]) }
}

export function parseTokenRef(value: string): string | null {
  const match = /^token:([a-z0-9-]+)$/.exec(value)
  return match ? match[1] : null
}

export function stable<T>(value: T): T {
  if (typeof value === "number" && !Number.isInteger(value)) return (Math.round(value * 1e5) / 1e5) as T
  if (Array.isArray(value)) return value.map(stable) as T
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])])
    ) as T
  return value
}

export function serialize(value: unknown) {
  return (
    (JSON.stringify(stable(value), null, 2) ?? "undefined").replace(
      /\{\n\s+"c": ([^,\n]+),\n\s+"h": ([^,\n]+),\n\s+"l": ([^,\n]+)\n\s+\}/g,
      '{ "c": $1, "h": $2, "l": $3 }'
    ) + "\n"
  )
}

export type Issue = { where: string; message: string }

const number = String.raw`\d+(?:\.\d+)?`
const signed = String.raw`-?\d+(?:\.\d+)?`
export const valueGrammar = {
  colour: new RegExp(
    String.raw`^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|oklch\(${number}%? ${number} ${number}(?: / ${number}%?)?\))$`,
    "i"
  ),
  length: new RegExp(String.raw`^${number}(?:px|rem|em)$`),
  duration: new RegExp(String.raw`^${number}m?s$`),
  easing: new RegExp(
    String.raw`^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(${number}, ?${signed}, ?${number}, ?${signed}\))$`
  ),
}

export const namePattern = /^[\p{L}\p{N}][\p{L}\p{N} '-]{0,39}$/u

export function themeValueProblem(name: string, value: string): string | null {
  switch (name) {
    case "--radius":
    case "--spacing":
      return valueGrammar.length.test(value) ? null : `${name} must be a length like 0.5rem or 8px`
    case "--text-sm":
      return /^\d*\.?\d+(?:px|rem)$/.test(value) && toRem(value) >= 0.5 && toRem(value) <= 1.5
        ? null
        : `${name} must be a size between 8px and 24px, like 0.875rem or 14px`
    case "--leading-body":
      return /^\d*\.?\d+$/.test(value) && parseFloat(value) >= 1 && parseFloat(value) <= 3
        ? null
        : `${name} must be a line height between 1 and 3, like 1.5`
    case "--spacing-flow":
      return valueGrammar.length.test(value) ? null : `${name} must be a length like 1.25em`
    case "--default-transition-duration":
      return valueGrammar.duration.test(value) ? null : `${name} must be a duration like 150ms`
    case "--default-transition-timing-function":
      return valueGrammar.easing.test(value) ? null : `${name} must be a CSS easing keyword or cubic-bezier(a, b, c, d)`
    case "--font-sans":
    case "--font-heading":
    case "--font-mono":
      return fontById(value) ? null : `${name} must be one of the tuner's font options`
    default:
      return `${name} isn't a theme variable the tuner knows`
  }
}

const rawColour = /^(#|oklch\(|oklab\(|rgb|hsl|lab\(|lch\(|color\()/i

export function validate(
  working: Working,
  stock: { light: Record<string, string>; dark: Record<string, string> },
  knobs?: Record<EntryName, Knob[]>
): Issue[] {
  const issues: Issue[] = []
  const { system } = working
  const at = (where: string) => (message: string) => issues.push({ where: `${system.id}/${where}`, message })

  const sys = at("system.json")
  if (system.version !== 1) sys(`unknown version ${system.version}`)
  if (!idPattern.test(system.id)) sys(`id "${system.id}" must be lowercase words joined by hyphens`)
  if (reservedSystemIds.includes(system.id)) sys(`"${system.id}" is reserved; systems live at /<id>/, so pick another id`)
  if (!system.name.trim()) sys("name is empty")
  else if (!namePattern.test(system.name))
    sys("name must be one line of at most 40 letters, digits, spaces, hyphens or apostrophes")

  const scaleIds = new Set<string>()
  for (const scale of system.palette.scales) {
    if (!idPattern.test(scale.id)) sys(`scale id "${scale.id}" must be lowercase words joined by hyphens`)
    if (scaleIds.has(scale.id)) sys(`scale id "${scale.id}" is used twice`)
    scaleIds.add(scale.id)
    if (!semanticScaleIds.includes(scale.id) && reservedScaleIds.includes(scale.id.split("-")[0]))
      sys(`scale id "${scale.id}" would collide with a token; rename the scale`)
    if (scale.steps.length !== STEPS) sys(`scale "${scale.id}" has ${scale.steps.length} steps, not ${STEPS}`)
    if (!namePattern.test(scale.name)) sys(`scale "${scale.id}" name must be one line of at most 40 plain characters`)
    if (scale.steps.some((step) => ![step.l, step.c, step.h].every(Number.isFinite)))
      sys(`scale "${scale.id}" has a step that isn't three numbers`)
  }
  for (const key of system.palette.keys)
    if (!namePattern.test(key.name)) sys(`key colour "${key.id}" name must be one line of at most 40 plain characters`)

  const checkPaletteRef = (report: (message: string) => void, token: string, value: string) => {
    const ref = parsePaletteRef(value)
    if (!ref) return false
    if (!scaleIds.has(ref.scale)) report(`${token} refers to scale "${ref.scale}", which isn't in this system's palette`)
    else if (ref.step < 1 || ref.step > STEPS) report(`${token} refers to step ${ref.step}; steps run 1 to ${STEPS}`)
    return true
  }

  for (const scheme of ["light", "dark"] as const)
    for (const [token, value] of Object.entries(system.tokens[scheme])) {
      if (!(token in stock[scheme])) sys(`${scheme}.${token} isn't a stock token`)
      if (checkPaletteRef(sys, `${scheme}.${token}`, value)) continue
      if (value.startsWith("token:")) sys(`${scheme}.${token}: system tokens can't refer to other tokens`)
      else if (!valueGrammar.colour.test(value))
        sys(`${scheme}.${token} must be a palette ref (palette:jade-8), oklch(l c h) or a hex colour`)
    }
  for (const [name, value] of Object.entries(system.tokens.theme)) {
    if (!themeVars.includes(name as ThemeVar)) sys(`theme.${name} isn't a theme variable the tuner knows`)
    else {
      const problem = themeValueProblem(name, value ?? "")
      if (problem) sys(`theme: ${problem}`)
    }
  }

  for (const [name, tuning] of Object.entries(working.entries)) {
    const entry = at(`entries/${name}.json`)
    if (tuning.entry !== name) entry(`entry is "${tuning.entry}" but the file is for "${name}"`)
    if (isEmptyTuning(tuning)) entry("is empty; delete it instead (no file means untuned)")
    for (const scheme of ["light", "dark"] as const)
      for (const [token, value] of Object.entries(tuning.tokens[scheme])) {
        if (!(token in stock[scheme])) entry(`${scheme}.${token} isn't a stock token`)
        const tokenRef = parseTokenRef(value)
        if (tokenRef !== null) {
          if (!(tokenRef in stock[scheme])) entry(`${scheme}.${token} refers to unknown token "${tokenRef}"`)
        } else if (!checkPaletteRef(entry, `${scheme}.${token}`, value)) {
          entry(
            rawColour.test(value)
              ? `${scheme}.${token} is a raw colour; entries may only use palette steps or tokens`
              : `${scheme}.${token} must be a palette ref (palette:jade-8) or a token ref (token:accent)`
          )
        }
      }
    for (const [name, value] of Object.entries(tuning.tokens.theme)) {
      if (!scopedThemeVars.includes(name as ScopedThemeVar)) entry(`theme.${name} can't be scoped to an entry`)
      else {
        const problem = themeValueProblem(name, value ?? "")
        if (problem) entry(`theme: ${problem}`)
      }
    }
    const declared = knobs?.[name]
    if (knobs && !declared) entry(`no knobs are declared for "${name}"`)
    if (declared)
      for (const [key, value] of Object.entries(tuning.knobs)) {
        const knob = declared.find((k) => k.key === key)
        if (!knob) entry(`knob "${key}" isn't declared in registry/unending/${name}/knobs.ts`)
        else if (typeof value !== typeof knob.default) entry(`knob "${key}" should be a ${typeof knob.default}`)
        else if (knob.options && !knob.options.includes(String(value))) entry(`knob "${key}" must be one of ${knob.options.join(", ")}`)
        else if (typeof value === "number" && !Number.isFinite(value)) entry(`knob "${key}" must be a finite number`)
        else if (typeof value === "number" && knob.min !== undefined && value < knob.min) entry(`knob "${key}" must be at least ${knob.min}`)
        else if (typeof value === "number" && knob.max !== undefined && value > knob.max) entry(`knob "${key}" must be at most ${knob.max}`)
        else if (typeof value === "string" && (value.length > 200 || /[\n\r]/.test(value))) entry(`knob "${key}" must be one line of at most 200 characters`)
      }
  }
  return issues
}
