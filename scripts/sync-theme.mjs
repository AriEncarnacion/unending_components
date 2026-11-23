import { readFileSync, writeFileSync } from "node:fs"

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
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

const before = JSON.stringify(item.cssVars)
const after = JSON.stringify(cssVars)
if (process.argv.includes("--check")) {
  if (before !== after) {
    console.error("registry.json theme is out of date with app/globals.css. Run npm run registry:theme.")
    process.exit(1)
  }
  console.log("Theme in sync.")
} else {
  item.cssVars = cssVars
  writeFileSync(registryUrl, JSON.stringify(registry, null, 2) + "\n")
  console.log(`Synced ${Object.keys(light).length} light, ${Object.keys(dark).length} dark tokens.`)
}
