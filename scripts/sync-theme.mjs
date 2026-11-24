import { readFileSync, writeFileSync } from "node:fs"

import { fontById, fontItem, fontRoles, stockFonts } from "../lib/design-systems/fonts.ts"

const check = process.argv.includes("--check")
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
const appFonts = readFileSync(new URL("../app/fonts.ts", import.meta.url), "utf8")
const registryUrl = new URL("../registry.json", import.meta.url)
const registry = JSON.parse(readFileSync(registryUrl, "utf8"))

function block(selector) {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`No ${selector} block in globals.css`)
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start))
  const vars = {}
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[match[1]] = match[2].trim()
  return vars
}

const light = block(":root")
const dark = block(".dark")
const added = /^(font-|color-(success|warning|info)$)/
const theme = {
  ...block("@theme"),
  ...Object.fromEntries(Object.entries(block("@theme inline")).filter(([name]) => added.test(name))),
}
const cssVars = { theme, light, dark }

const item = registry.items.find((entry) => entry.name === "theme")
if (!item) throw new Error("registry.json has no `theme` item")

const problems = []

for (const role of fontRoles) {
  const id = stockFonts[role]
  const loader = fontById(id)?.item?.import
  if (!loader) {
    problems.push(`stockFonts.${role} is "${id}", which has no Google font to install.`)
    continue
  }
  const loaded = new RegExp(`(\\w+)\\(\\{[^)]*variable: "--font-${role}"`).exec(appFonts)?.[1]
  if (loaded !== loader)
    problems.push(`app/fonts.ts loads ${loaded ?? "nothing"} as --font-${role}, but stockFonts.${role} is "${id}" (${loader}).`)
}

const fontItems = fontRoles.map((role) => fontItem(role, stockFonts[role], "The catalog's")).filter(Boolean)
const fontNames = new Set(fontRoles.map((role) => `font-${role}`))
const items = registry.items.filter((entry) => !fontNames.has(entry.name))
items.splice(items.indexOf(item) + 1, 0, ...fontItems)

const stale =
  JSON.stringify(item.cssVars) !== JSON.stringify(cssVars) || JSON.stringify(items) !== JSON.stringify(registry.items)

if (check) {
  if (stale) problems.push("registry.json's theme or font items are out of date with app/globals.css and stockFonts. Run npm run registry:theme.")
  if (problems.length) {
    for (const problem of problems) console.error(problem)
    process.exit(1)
  }
  console.log("Theme and fonts in sync.")
} else {
  if (problems.length) {
    for (const problem of problems) console.error(problem)
    process.exit(1)
  }
  item.cssVars = cssVars
  registry.items = items
  writeFileSync(registryUrl, JSON.stringify(registry, null, 2) + "\n")
  console.log(`Synced ${Object.keys(light).length} light, ${Object.keys(dark).length} dark tokens and ${fontItems.length} fonts.`)
}
