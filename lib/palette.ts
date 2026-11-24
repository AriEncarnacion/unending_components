export type Oklch = { l: number; c: number; h: number }
type Vec3 = [number, number, number]

export const STEPS = 12

export const stepRoles = [
  "App background",
  "Subtle background",
  "Element",
  "Element hover",
  "Element active",
  "Separator",
  "Border",
  "Strong border",
  "Solid",
  "Solid hover",
  "Text, low contrast",
  "Text, high contrast",
] as const

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

export function oklchToOklab({ l, c, h }: Oklch): Vec3 {
  const rad = (h * Math.PI) / 180
  return [l, c * Math.cos(rad), c * Math.sin(rad)]
}

export function oklchToLinear(color: Oklch): Vec3 {
  const [L, a, b] = oklchToOklab(color)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function linearToOklch([r, g, b]: Vec3): Oklch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  const H = C < 0.0002 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return { l: L, c: C, h: H }
}

export function parseHex(input: string): Oklch | null {
  let hex = input.trim().replace(/^#/, "")
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = [...hex].map((ch) => ch + ch).join("")
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null
  const rgb = [0, 2, 4].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)) as Vec3
  return linearToOklch(rgb)
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function linearToHex(rgb: Vec3) {
  return `#${rgb.map((v) => Math.round(clamp01(toGamma(clamp01(v))) * 255).toString(16).padStart(2, "0")).join("")}`
}

export function toHex(color: Oklch) {
  return linearToHex(oklchToLinear(color))
}

const round = (n: number, places: number) => Number(n.toFixed(places))

export function toCss({ l, c, h }: Oklch) {
  return `oklch(${round(l, 3)} ${round(c, 3)} ${round(h, 2)})`
}

export function parseColor(value: string): Oklch | null {
  const match = value
    .trim()
    .match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*[\d.]+%?)?\s*\)$/i)
  if (match) {
    const l = parseFloat(match[1]) / (match[2] ? 100 : 1)
    return { l, c: parseFloat(match[3]), h: parseFloat(match[4]) }
  }
  return parseHex(value)
}

const EPS = 0.0005

export function inSrgb(color: Oklch) {
  return oklchToLinear(color).every((v) => v >= -EPS && v <= 1 + EPS)
}

export function inP3(color: Oklch) {
  const [r, g, b] = oklchToLinear(color)
  const p3 = [
    0.8224621 * r + 0.177538 * g,
    0.0331941 * r + 0.9668058 * g,
    0.0170827 * r + 0.0723974 * g + 0.9105199 * b,
  ]
  return p3.every((v) => v >= -EPS && v <= 1 + EPS)
}

export type Gamut = "srgb" | "p3" | "out"
export function gamutOf(color: Oklch): Gamut {
  return inSrgb(color) ? "srgb" : inP3(color) ? "p3" : "out"
}

export function maxChroma(l: number, h: number, gamut: "srgb" | "p3" = "srgb") {
  const test = gamut === "srgb" ? inSrgb : inP3
  let lo = 0
  let hi = 0.4
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (test({ l, c: mid, h })) lo = mid
    else hi = mid
  }
  return lo
}

export function clampToGamut(color: Oklch, gamut: "srgb" | "p3" = "srgb"): Oklch {
  const test = gamut === "srgb" ? inSrgb : inP3
  return test(color) ? color : { ...color, c: maxChroma(color.l, color.h, gamut) }
}

export function deltaE(a: Oklch, b: Oklch) {
  const [l1, a1, b1] = oklchToOklab(a)
  const [l2, a2, b2] = oklchToOklab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100
}

function clippedLinear(color: Oklch): Vec3 {
  return oklchToLinear(color).map(clamp01) as Vec3
}

export function relativeLuminance(color: Oklch) {
  const [r, g, b] = clippedLinear(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function wcag(a: Oklch, b: Oklch) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function apcaY(color: Oklch) {
  const [r, g, b] = clippedLinear(color).map((v) => toGamma(v) ** 2.4)
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b
}

export function apca(text: Oklch, background: Oklch) {
  const clampY = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414)
  const t = clampY(apcaY(text))
  const bg = clampY(apcaY(background))
  if (Math.abs(bg - t) < 0.0005) return 0
  if (bg > t) {
    const sapc = (bg ** 0.56 - t ** 0.57) * 1.14
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100
  }
  const sapc = (bg ** 0.65 - t ** 0.62) * 1.14
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100
}

export const WHITE: Oklch = { l: 1, c: 0, h: 0 }
export const BLACK: Oklch = { l: 0, c: 0, h: 0 }

export function inkOn(color: Oklch) {
  return Math.abs(apca(WHITE, color)) >= Math.abs(apca(BLACK, color)) ? "#ffffff" : "#0a0a0a"
}

export type Vision = "normal" | "grayscale" | "protanopia" | "deuteranopia" | "tritanopia"

const visionMatrices: Record<"protanopia" | "deuteranopia" | "tritanopia", number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
}

export function paint(color: Oklch, vision: Vision = "normal") {
  if (vision === "normal") return toCss(color)
  if (vision === "grayscale") return toCss({ l: color.l, c: 0, h: 0 })
  const [r, g, b] = clippedLinear(color)
  const m = visionMatrices[vision]
  return linearToHex([m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b])
}

export function perceived(color: Oklch, vision: Vision): Oklch {
  if (vision === "normal") return color
  if (vision === "grayscale") return { l: color.l, c: 0, h: 0 }
  return parseHex(paint(color, vision)) ?? color
}

export type Generator = {
  key: Oklch
  index: number
  lightest: number
  darkest: number
  chroma: number
  hueShift: number
  gamut: "srgb" | "p3"
}

export type Scale = {
  id: string
  name: string
  steps: Oklch[]
  original: Oklch[]
  hidden: boolean
  generator?: Generator
  semantic?: boolean
}

export type KeyColor = {
  id: string
  name: string
  color: Oklch
  original: Oklch
  hidden: boolean
}

export function referenceCurves(scales: Pick<Scale, "steps">[]) {
  const lightness = Array.from({ length: STEPS }, (_, i) =>
    scales.length ? scales.reduce((sum, s) => sum + s.steps[i].l, 0) / scales.length : 1 - (i / (STEPS - 1)) * 0.82
  )
  const chroma = Array.from({ length: STEPS }, (_, i) => {
    if (!scales.length) return Math.sin((Math.PI * (i + 0.5)) / STEPS)
    return (
      scales.reduce((sum, s) => {
        const peak = Math.max(...s.steps.map((step) => step.c)) || 1
        return sum + s.steps[i].c / peak
      }, 0) / scales.length
    )
  })
  return { lightness, chroma }
}

export function nearestIndex(color: Oklch, lightness: number[]) {
  let best = 0
  lightness.forEach((l, i) => {
    if (Math.abs(l - color.l) < Math.abs(lightness[best] - color.l)) best = i
  })
  return best
}

export function generate(generator: Generator, reference: { lightness: number[]; chroma: number[] }): Oklch[] {
  const { key, index, lightest, darkest, chroma, hueShift, gamut } = generator
  const ref = reference.lightness
  const [refTop, refBottom] = [ref[0], ref[STEPS - 1]]
  const span = refTop - refBottom || 1
  const base = ref.map((l) => darkest + ((l - refBottom) / span) * (lightest - darkest))
  const offset = key.l - base[index]
  const lightness = base.map((l, i) => {
    if (i === index) return key.l
    const weight = i < index ? i / Math.max(index, 1) : (STEPS - 1 - i) / Math.max(STEPS - 1 - index, 1)
    return l + offset * weight
  })
  const profile = reference.chroma
  const keyProfile = profile[index] || 1
  return lightness.map((l, i) => {
    if (i === index) return { ...key }
    const t = i / (STEPS - 1) - index / (STEPS - 1)
    const h = (((key.h + hueShift * t) % 360) + 360) % 360
    const c = Math.max(0, (key.c * profile[i] * chroma) / keyProfile)
    return clampToGamut({ l: Math.min(1, Math.max(0, l)), c, h }, gamut)
  })
}

export function smooth(steps: Oklch[], channel: "l" | "c" | "h") {
  return steps.map((step, i) => {
    if (i === 0 || i === steps.length - 1) return step
    const value = (steps[i - 1][channel] + 2 * step[channel] + steps[i + 1][channel]) / 4
    return { ...step, [channel]: value }
  })
}

export function slug(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-") || "scale"
  )
}

const hexes = (list: string) => list.split(/\s+/).map((hex) => parseHex(hex)!)

function seedScale(id: string, name: string, list: string): Scale {
  const steps = hexes(list)
  return { id, name, steps, original: steps, hidden: false }
}

function seedKey(id: string, name: string, hex: string): KeyColor {
  const color = parseHex(hex)!
  return { id, name, color, original: color, hidden: false }
}

export const seedKeys: KeyColor[] = [
  seedKey("mutton-fat", "Mutton-fat", "#f4f6ef"),
  seedKey("celadon", "Celadon", "#a7c8ac"),
  seedKey("imperial", "Imperial", "#1d4a33"),
  seedKey("aqua-jadeite", "Aqua jadeite", "#478076"),
  seedKey("obsidian", "Obsidian", "#07120d"),
  seedKey("vein-gold", "Vein gold", "#d9c670"),
  seedKey("verdant", "Verdant green", "#26d150"),
  seedKey("jet", "Jet black", "#1c343e"),
]

const handMade: Scale[] = [
  seedScale("jade", "Jade", "f4f6ef d4e5d0 b6d2b7 9abf9e 7fad82 669a6b 508659 3e7247 2d5e3a 1d4a33 133624 0b2416"),
  seedScale("aqua", "Aqua", "eef5f4 cee0e1 aecccd 8eb9b6 71a59f 599088 447b72 35665d 285149 1e3d36 142924 0a1715"),
  seedScale("obsidian", "Obsidian", "e6efe4 cadacc afc5b4 96b09e 809a88 6a8573 55715f 415d4b 2d4a39 1b3729 0f241b 07120d"),
  seedScale("vein-gold", "Vein gold", "faf5dc f1e299 e0ce7c cfbb6a bda75e ac9354 9a8145 887034 755f26 624f20 4f401a 3d3114"),
]

const reference = referenceCurves(handMade)

export function scaleFromKey(
  id: string,
  name: string,
  key: Oklch,
  curves = reference,
  options: Partial<Omit<Generator, "key">> & { semantic?: boolean } = {}
): Scale {
  const { semantic, ...overrides } = options
  const generator: Generator = {
    key,
    index: nearestIndex(key, curves.lightness),
    lightest: curves.lightness[0],
    darkest: curves.lightness[STEPS - 1],
    chroma: 1,
    hueShift: 0,
    gamut: "srgb",
    ...overrides,
  }
  const steps = generate(generator, curves)
  return { id, name, steps, original: steps, hidden: false, generator, ...(semantic ? { semantic } : {}) }
}

export const semanticScales: Scale[] = [
  scaleFromKey("neutral", "Neutral", { l: 0.55, c: 0.014, h: 150 }, reference, {
    lightest: 0.985,
    darkest: 0.165,
    semantic: true,
  }),
  scaleFromKey("danger", "Danger", { l: 0.555, c: 0.165, h: 29 }, reference, { semantic: true, hueShift: 6 }),
  scaleFromKey("warning", "Warning", { l: 0.79, c: 0.135, h: 76 }, reference, { semantic: true, hueShift: -14 }),
  scaleFromKey("success", "Success", { l: 0.6, c: 0.13, h: 152 }, reference, { semantic: true }),
  scaleFromKey("info", "Info", { l: 0.58, c: 0.105, h: 238 }, reference, { semantic: true }),
]

export const seedScales: Scale[] = [
  ...handMade,
  scaleFromKey("verdant", "Verdant green", parseHex("#26d150")!),
  scaleFromKey("jet", "Jet", parseHex("#1c343e")!),
  ...semanticScales,
]
