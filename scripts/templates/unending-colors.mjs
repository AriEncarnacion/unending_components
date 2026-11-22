// Design-system colour guard, handed off with the design system. It flags raw
// colours and Tailwind palette classes in components, so UI keeps to the
// semantic tokens (bg-primary, text-muted-foreground, text-success…).
//
// Use it in eslint.config.mjs:
//   import unendingColors from "./eslint/unending-colors.mjs"
//   export default [...yourConfig, unendingColors]
// This file is yours now: widen `allow` or change the patterns as you see fit.

const rawColour = /(#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\()/i
const paletteClass =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/
const arbitraryColour = /-\[(?:#|rgb|hsl|oklch)/i
// Raw palette steps (var(--jade-3)) are for data and illustration only.
const scaleVar = /var\(--(?!(?:background|foreground|card|popover|primary|secondary|muted|accent|destructive|success|warning|info|border|input|ring|chart-\d|sidebar|radius|spacing|font)[\w-]*\))[a-z]+(?:-[a-z]+)*-\d{1,2}\)/

const rule = {
  meta: {
    type: "suggestion",
    docs: { description: "Use the design system's semantic colour tokens instead of raw colours or palette classes." },
    schema: [{ type: "object", properties: { allow: { type: "array", items: { type: "string" } } }, additionalProperties: false }],
    messages: {
      raw: "Raw colour \"{{value}}\". Use a semantic token (bg-primary, text-muted-foreground…) instead.",
      palette: "Palette class \"{{value}}\". Use a semantic token instead; see docs/design-system.md.",
      scale: "Raw palette step \"{{value}}\". Steps are for data and illustration; UI uses semantic tokens.",
    },
  },
  create(context) {
    const allow = new Set(context.options[0]?.allow ?? [])
    const check = (node, text) => {
      if (typeof text !== "string" || allow.has(text)) return
      const found =
        (text.match(paletteClass) && ["palette", text.match(paletteClass)[0]]) ||
        (text.match(arbitraryColour) && ["raw", text.match(arbitraryColour)[0]]) ||
        (text.match(scaleVar) && ["scale", text.match(scaleVar)[0]]) ||
        (text.match(rawColour) && ["raw", text.match(rawColour)[0]])
      if (found) context.report({ node, messageId: found[0], data: { value: found[1] } })
    }
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked),
    }
  },
}

const config = {
  files: ["**/*.{js,jsx,ts,tsx}"],
  ignores: ["**/components/ui/**", "**/*.config.*", "eslint/**"],
  plugins: { unending: { rules: { "no-raw-colours": rule } } },
  rules: { "unending/no-raw-colours": "warn" },
}

export default config
