export const textScale: Record<string, { rem: number; leading: number }> = {
  xs: { rem: 0.75, leading: 1 / 0.75 },
  sm: { rem: 0.875, leading: 1.25 / 0.875 },
  base: { rem: 1, leading: 1.5 },
  lg: { rem: 1.125, leading: 1.75 / 1.125 },
  xl: { rem: 1.25, leading: 1.75 / 1.25 },
  "2xl": { rem: 1.5, leading: 2 / 1.5 },
  "3xl": { rem: 1.875, leading: 2.25 / 1.875 },
  "4xl": { rem: 2.25, leading: 2.5 / 2.25 },
  "5xl": { rem: 3, leading: 1 },
  "6xl": { rem: 3.75, leading: 1 },
  "7xl": { rem: 4.5, leading: 1 },
  "8xl": { rem: 6, leading: 1 },
  "9xl": { rem: 8, leading: 1 },
}

export const runningTextSteps = ["xs", "sm", "base", "lg"]

export const stockTextSm = "0.875rem"
export const stockFlow = "1.25em"

export const leadingOptions = [
  { name: "Tight", value: "1.25" },
  { name: "Snug", value: "1.375" },
  { name: "Regular", value: "1.5" },
  { name: "Relaxed", value: "1.625" },
  { name: "Loose", value: "1.75" },
]

export const flowOptions = [
  { name: "Tight", value: "0.75em" },
  { name: "Snug", value: "1em" },
  { name: "Regular", value: "1.25em" },
  { name: "Relaxed", value: "1.5em" },
  { name: "Loose", value: "2em" },
]

const round = (n: number) => Number(n.toFixed(4))

export function toRem(value: string) {
  const n = parseFloat(value)
  return value.trim().endsWith("px") ? n / 16 : n
}

type TypeTheme = { "--text-sm"?: string; "--leading-body"?: string }

export function tunedScale(theme: TypeTheme) {
  const ratio = theme["--text-sm"] ? toRem(theme["--text-sm"]) / textScale.sm.rem : 1
  const leading = theme["--leading-body"] ? parseFloat(theme["--leading-body"]) : null
  return Object.fromEntries(
    Object.entries(textScale).map(([step, s]) => [
      step,
      { rem: round(s.rem * ratio), leading: leading && runningTextSteps.includes(step) ? leading : s.leading },
    ])
  )
}

export function typeVars(theme: TypeTheme): Record<string, string> {
  const vars: Record<string, string> = {}
  const scale = tunedScale(theme)
  if (theme["--text-sm"]) for (const [step, s] of Object.entries(scale)) vars[`--text-${step}`] = `${s.rem}rem`
  if (theme["--leading-body"])
    for (const step of runningTextSteps) vars[`--text-${step}--line-height`] = String(scale[step].leading)
  return vars
}
