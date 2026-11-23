export type RGBA = { r: number; g: number; b: number; a: number }

let context: CanvasRenderingContext2D | null | undefined

export function toRGBA(value: string): RGBA | null {
  if (typeof document === "undefined") return null
  if (context === undefined) {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    context = canvas.getContext("2d", { willReadFrequently: true })
  }
  if (!context) return null
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = "#000"
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
  return { r, g, b, a: a / 255 }
}

export function over(top: RGBA, bottom: RGBA): RGBA {
  const mix = (t: number, b: number) => Math.round(t * top.a + b * (1 - top.a))
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 }
}

function channel(value: number) {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance({ r, g, b }: RGBA) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(foreground: RGBA, background: RGBA) {
  const fg = foreground.a < 1 ? over(foreground, background) : foreground
  const [hi, lo] = [luminance(fg), luminance(background)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

export function grade(ratio: number) {
  if (ratio >= 7) return "AAA"
  if (ratio >= 4.5) return "AA"
  if (ratio >= 3) return "AA large"
  return "Fail"
}

export function toHex({ r, g, b }: RGBA) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

export function hexToOklch(hex: string) {
  const value = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(value.slice(i, i + 2), 16)))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  const H = C < 0.0001 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  const round = (n: number, places: number) => Number(n.toFixed(places))
  return `oklch(${round(L, 3)} ${round(C, 3)} ${round(H, 2)})`
}

export function parseOklch(value: string) {
  const match = value
    .trim()
    .match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i)
  if (!match) return null
  const num = (v: string) => (v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v))
  return { l: num(match[1]), c: num(match[2]), h: num(match[3]), alpha: match[4] ? num(match[4]) : 1 }
}

export function formatOklch({ l, c, h, alpha = 1 }: { l: number; c: number; h: number; alpha?: number }) {
  const round = (n: number, places: number) => Number(n.toFixed(places))
  const base = `${round(l, 3)} ${round(c, 3)} ${round(h, 2)}`
  return alpha < 1 ? `oklch(${base} / ${Math.round(alpha * 100)}%)` : `oklch(${base})`
}
