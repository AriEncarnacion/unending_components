// Builds installable registries from the files the tuner saves. Each entry is
// baked: its useEntryTuning(...) call becomes a plain object with the
// system's values, so an app receives an ordinary component with no tuning
// layer.
//
//   public/r/*.json   Stock, committed and published to the registry by CI
//   --system <id> --out <dir>
//                     one design system from design-systems/<id>/, for Ship.
//                     Systems never go into the repo: Ship uploads them
//                     straight to the registry host.
//
// Every build also runs the registry Worker's own upload checks, so a build
// that passes here won't be refused there for its shape.
//
// Run with: node --experimental-strip-types scripts/build-systems.ts [--check]
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import ts from "typescript"

import { readCommitted } from "../lib/design-systems/load.ts"
import { fontById, stockFonts } from "../lib/design-systems/fonts.ts"
import { paletteVars, scopedSelectors, scopedVars, toVar } from "../lib/design-systems/resolve.ts"
import { parsePaletteRef, validate, type Knob, type SystemFile, type Working } from "../lib/design-systems/schema.ts"
import { checkBundle } from "../worker/src/shared/validate.ts"

const root = process.cwd()
const check = process.argv.includes("--check")
const argument = (flag: string) => {
  const at = process.argv.indexOf(flag)
  return at === -1 ? undefined : process.argv[at + 1]
}
const onlySystem = argument("--system")
const outDir = argument("--out")
const registry = JSON.parse(readFileSync(path.join(root, "registry.json"), "utf8"))
const ADDRESS = new URL(registry.homepage).pathname.slice(1)
const NS = "@unending"

// Registry items are loose JSON; the shadcn build validates them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = Record<string, any>
const items: Item[] = registry.items
const themeItem = items.find((item) => item.name === "theme")!
const stock = { light: themeItem.cssVars.light as Record<string, string>, dark: themeItem.cssVars.dark as Record<string, string> }
const entryItems = items.filter((item) => item.meta?.entry)

const problems: string[] = []

// ── Knobs and the defaults written in each entry ───────────────────────────

async function loadKnobs() {
  const knobs: Record<string, Knob[]> = {}
  for (const item of entryItems) {
    const file = path.join(root, "registry/unending", item.name, "knobs.ts")
    if (!existsSync(file)) {
      knobs[item.name] = []
      continue
    }
    knobs[item.name] = (await import(file)).knobs as Knob[]
  }
  return knobs
}

type Call = { start: number; end: number; entry: string; defaults: Record<string, { text: string; value: unknown }>; order: string[] }

/** Every useEntryTuning("name", { ... }) call in a source file. */
function findCalls(source: string, file: string): Call[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const calls: Call[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useEntryTuning") {
      const [name, literal] = node.arguments
      if (!name || !ts.isStringLiteral(name) || !literal || !ts.isObjectLiteralExpression(literal)) {
        problems.push(`${file}: useEntryTuning needs a string name and an object literal of defaults`)
        return
      }
      const defaults: Call["defaults"] = {}
      const order: string[] = []
      for (const prop of literal.properties) {
        if (!ts.isPropertyAssignment(prop) || !(ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) {
          problems.push(`${file}: useEntryTuning defaults must be plain key: value pairs`)
          continue
        }
        const key = prop.name.text
        const init = prop.initializer
        let value: unknown = undefined
        if (ts.isNumericLiteral(init)) value = Number(init.text)
        else if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) value = init.text
        else if (init.kind === ts.SyntaxKind.TrueKeyword) value = true
        else if (init.kind === ts.SyntaxKind.FalseKeyword) value = false
        else if (ts.isPrefixUnaryExpression(init) && init.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(init.operand))
          value = -Number(init.operand.text)
        else problems.push(`${file}: default "${key}" must be a literal number, string or boolean`)
        defaults[key] = { text: init.getText(sf), value }
        order.push(key)
      }
      calls.push({ start: node.getStart(sf), end: node.getEnd(), entry: name.text, defaults, order })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return calls
}

/** The source with each useEntryTuning call replaced by a plain object, and its import removed. */
function bake(source: string, file: string, values: Record<string, unknown>) {
  let out = source
  for (const call of findCalls(source, file).reverse()) {
    const lineStart = out.lastIndexOf("\n", call.start) + 1
    const indent = /^\s*/.exec(out.slice(lineStart, call.start))![0]
    const body = call.order
      .map((key) => {
        const tuned = values[key]
        return `${indent}  ${key}: ${tuned === undefined ? call.defaults[key].text : JSON.stringify(tuned)},`
      })
      .join("\n")
    out = out.slice(0, call.start) + `{\n${body}\n${indent}}` + out.slice(call.end)
  }
  out = out.replace(/^import \{ useEntryTuning \} from "@\/lib\/tuning"\n/m, "")
  if (/useEntryTuning|@\/lib\/tuning/.test(out)) problems.push(`${file}: couldn't remove every useEntryTuning use`)
  return out
}

/** Checks that each entry's knobs.ts matches the defaults written in its code. */
function checkKnobDefaults(knobs: Record<string, Knob[]>) {
  for (const item of entryItems) {
    const declared = knobs[item.name] ?? []
    const seen = new Set<string>()
    for (const file of item.files as { path: string }[]) {
      const source = readFileSync(path.join(root, file.path), "utf8")
      for (const call of findCalls(source, file.path)) {
        if (call.entry !== item.name) problems.push(`${file.path}: useEntryTuning("${call.entry}") should be "${item.name}"`)
        for (const [key, { value }] of Object.entries(call.defaults)) {
          seen.add(key)
          const knob = declared.find((k) => k.key === key)
          if (!knob) problems.push(`${item.name}: "${key}" is in useEntryTuning but not in knobs.ts`)
          else if (knob.default !== value)
            problems.push(`${item.name}: knobs.ts says ${key} defaults to ${JSON.stringify(knob.default)}, the code says ${JSON.stringify(value)}`)
        }
      }
    }
    for (const knob of declared)
      if (!seen.has(knob.key)) problems.push(`${item.name}: knob "${knob.key}" is declared but useEntryTuning never uses it`)
  }
}

// ── Generated items ─────────────────────────────────────────────────────────

const roles = ["sans", "heading", "mono"] as const

function fontItems(system: SystemFile | null) {
  return roles.flatMap((role) => {
    const id = (system?.tokens.theme[`--font-${role}`] as string | undefined) ?? stockFonts[role]
    const font = fontById(id)
    if (!font?.item) return []
    return [
      {
        name: `font-${role}`,
        type: "registry:font",
        title: `${font.label} (${role === "sans" ? "body" : role === "heading" ? "headings" : "code and data"})`,
        description: `The design system's ${role === "sans" ? "body and UI" : role === "heading" ? "heading" : "monospace"} font, as --font-${role}.`,
        font: {
          family: font.item.family,
          provider: "google",
          import: font.item.import,
          variable: `--font-${role}`,
          subsets: ["latin"],
          dependency: font.item.dependency,
        },
      },
    ]
  })
}

/** Scales that ship: every visible one, plus any hidden one something refers to. */
function shippedPalette(working: Working) {
  const referenced = new Set<string>()
  const scan = (values: Record<string, string>) =>
    Object.values(values).forEach((v) => {
      const ref = parsePaletteRef(v)
      if (ref) referenced.add(ref.scale)
    })
  scan(working.system.tokens.light)
  scan(working.system.tokens.dark)
  for (const tuning of Object.values(working.entries)) {
    scan(tuning.tokens.light)
    scan(tuning.tokens.dark)
  }
  const scales = working.system.palette.scales.filter((s) => !s.hidden || referenced.has(s.id))
  return paletteVars({ scales: scales.map((s) => ({ ...s, hidden: false })), keys: [] })
}

function themeFor(working: Working | null) {
  const system = working?.system ?? null
  const mapped = (values: Record<string, string>) =>
    Object.fromEntries(Object.entries(values).map(([token, value]) => [token, toVar(value)]))
  const theme: Record<string, string> = { ...themeItem.cssVars.theme }
  const light = { ...stock.light, ...(system ? mapped(system.tokens.light) : {}) }
  const dark = { ...stock.dark, ...(system ? mapped(system.tokens.dark) : {}) }
  const t = system?.tokens.theme ?? {}
  if (t["--radius"]) light.radius = t["--radius"]
  if (t["--spacing"]) theme.spacing = t["--spacing"]
  if (t["--default-transition-duration"]) theme["default-transition-duration"] = t["--default-transition-duration"]
  if (t["--default-transition-timing-function"])
    theme["default-transition-timing-function"] = t["--default-transition-timing-function"]

  const rootVars: Record<string, string> = working ? shippedPalette(working) : {}
  const notes: string[] = []
  for (const role of roles) {
    const id = (t[`--font-${role}`] as string | undefined) ?? stockFonts[role]
    const font = fontById(id)
    if (font && !font.item) {
      rootVars[`--font-${role}`] = font.family
      if (font.licensed)
        notes.push(
          `${font.label} is a licensed font and isn't included. Add its files to the app and load them with @font-face (or next/font/local) as "${font.label}"; --font-${role} already points at it.`
        )
    }
  }

  const item: Item = {
    name: "theme",
    type: "registry:theme",
    title: system ? `${system.name} theme` : "Unending theme",
    description: system
      ? `The ${system.name} design system's tokens, palette and fonts. Every entry depends on it.`
      : themeItem.description,
    registryDependencies: fontItems(system).map((font) => `${NS}/${font.name}`),
    cssVars: { theme, light, dark },
  }
  if (Object.keys(rootVars).length) item.css = { "@layer base": { ":root": rootVars } }
  if (notes.length) item.docs = notes.join(" ")
  return item
}

function designRules(working: Working | null) {
  const system = working?.system
  const name = system?.name ?? "Stock shadcn"
  const palette = working ? Object.keys(shippedPalette(working)) : []
  const scales = [...new Set(palette.map((v) => v.replace(/^--/, "").replace(/-\d+$/, "")))]
  const lines = [
    `# Design system: ${name}`,
    "",
    "This app's UI follows one design system, handed off from the Unending catalog. The app owns these files now: change them here as the product needs.",
    "",
    "## Colour",
    "",
    "- Use semantic tokens for UI: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `info`, `border`, `input`, `ring`, `chart-1`…`chart-5` and `sidebar-*`, each with `-foreground` where one exists. Opacity modifiers (`bg-primary/10`) are fine.",
    "- Status colour is semantic: errors and deleting use `destructive`, done or saved uses `success`, needs attention uses `warning`, neutral notices use `info`. Use them for text, icons and tints (`bg-success/10`), not solid fills.",
    "- Keep to one accent per view. A screen that needs more colour is usually missing hierarchy.",
    "- Never write raw colours (hex, `rgb()`, `oklch()`) or Tailwind palette classes (`bg-blue-500`) in components.",
    ...(scales.length
      ? [
          `- The palette ships as CSS variables, not classes: ${scales.map((s) => `\`--${s}-1\`…\`--${s}-12\``).join(", ")}. Reach for a raw step only for data and illustration (a chart series, an empty-state drawing), never for UI chrome.`,
        ]
      : []),
    "",
    "## Shape, type and motion",
    "",
    "- Radius comes from the `rounded-*` scale (it derives from `--radius`). Spacing uses the Tailwind scale and `gap`.",
    "- Fonts: `font-sans` for UI, `font-heading` for headings, `font-mono` for code, times and IDs.",
    "- Motion is short (120–300ms), eased out, and has a reason. Respect `prefers-reduced-motion`.",
    "",
    "## Components",
    "",
    "- Build from `components/ui/*` first. Installed Unending entries are already tuned for this system; adjust them here, they're yours.",
    "- `eslint/unending-colors.mjs`, if installed, flags raw colours and palette classes.",
    "",
  ]
  return lines.join("\n")
}

// ── Building one registry ───────────────────────────────────────────────────

function buildOne(working: Working | null, outDir: string, staging: string) {
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  const out: Item[] = []

  out.push(themeFor(working))
  out.push(...fontItems(working?.system ?? null))

  writeFile(staging, "docs/design-system.md", designRules(working))
  out.push({
    name: "design-rules",
    type: "registry:file",
    title: "Design rules",
    description: "How UI in this app uses the design system: semantic colour, status colour, shape, type and motion. Point your agents at it.",
    files: [{ path: "docs/design-system.md", type: "registry:file", target: "~/docs/design-system.md" }],
  })
  writeFile(staging, "eslint/unending-colors.mjs", readFileSync(path.join(root, "scripts/templates/unending-colors.mjs"), "utf8"))
  out.push({
    name: "lint-colors",
    type: "registry:file",
    title: "Colour lint rule",
    description: "An ESLint rule that flags raw colours and palette classes so UI keeps to the semantic tokens.",
    files: [{ path: "eslint/unending-colors.mjs", type: "registry:file", target: "~/eslint/unending-colors.mjs" }],
    docs: 'Add it to eslint.config.mjs: import unendingColors from "./eslint/unending-colors.mjs", then include unendingColors in the exported array.',
  })

  for (const item of entryItems) {
    const tuning = working?.entries[item.name]
    const files = (item.files as { path: string; type: string; target?: string }[]).map((file) => {
      const source = readFileSync(path.join(root, file.path), "utf8")
      writeFile(staging, file.path, bake(source, file.path, tuning?.knobs ?? {}))
      return file
    })
    const built: Item = {
      ...item,
      files,
      registryDependencies: (item.registryDependencies as string[])
        .filter((dep) => dep !== `${ADDRESS}/tuning`)
        .map((dep) => (dep.startsWith(`${ADDRESS}/`) ? `${NS}/${dep.slice(ADDRESS.length + 1)}` : dep)),
    }
    if (tuning && working) {
      const vars = scopedVars(tuning, working.system.palette, "var")
      const selectors = scopedSelectors(item.name)
      const rules: Record<string, Record<string, string>> = {}
      if (Object.keys(vars.theme).length) rules[selectors.theme] = vars.theme
      if (Object.keys(vars.light).length) rules[selectors.light] = vars.light
      if (Object.keys(vars.dark).length) rules[selectors.dark] = vars.dark
      if (Object.keys(rules).length) built.css = { "@layer base": rules }
    }
    out.push(built)
  }

  // Last line of defence: the shadcn CLI writes CSS values into consumers'
  // stylesheets as-is, so no value may be able to close or open a rule.
  for (const item of out)
    for (const [where, value] of cssLeaves({ cssVars: item.cssVars, css: item.css }))
      if (/[;{}]/.test(value)) {
        console.error(`${item.name}: CSS value at ${where} contains ; { or }, which would break out of its rule.`)
        process.exit(1)
      }

  const reg = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: registry.name,
    homepage: registry.homepage,
    items: out,
  }
  writeFileSync(path.join(staging, "registry.json"), JSON.stringify(reg, null, 2) + "\n")
  mkdirSync(outDir, { recursive: true })
  try {
    execFileSync("npx", ["shadcn", "build", path.join(staging, "registry.json"), "--output", outDir, "--cwd", staging], {
      stdio: "pipe",
    })
  } catch (error) {
    const e = error as { stdout?: Buffer; stderr?: Buffer }
    console.error(`shadcn build failed for ${path.basename(staging)}:\n${e.stdout ?? ""}${e.stderr ?? ""}`)
    process.exit(1)
  }
}

/** Every string value in a nested CSS object, with its path. */
function cssLeaves(value: unknown, where = ""): [string, string][] {
  if (typeof value === "string") return [[where, value]]
  if (!value || typeof value !== "object") return []
  return Object.entries(value).flatMap(([key, child]) => cssLeaves(child, where ? `${where} › ${key}` : key))
}

function writeFile(base: string, relative: string, content: string) {
  const file = path.join(base, relative)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

// ── Main ────────────────────────────────────────────────────────────────────

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isFile())
}

/** Runs the registry Worker's upload checks on a built registry. Packages are checked against the live allowlist at upload. */
function hostCheck(dir: string, label: string) {
  const files: Record<string, string> = {}
  for (const name of listFiles(dir).filter((f) => f.endsWith(".json"))) files[`r/${name}`] = readFileSync(path.join(dir, name), "utf8")
  for (const problem of checkBundle(files, []).problems) problems.push(`${label} ${problem}`)
}

const knobs = await loadKnobs()
checkKnobDefaults(knobs)
const systems = (await readCommitted()).filter((c) => !onlySystem || c.system.id === onlySystem)
if (onlySystem && !systems.length) problems.push(`design-systems/${onlySystem}: no such saved system`)
for (const committed of systems) {
  for (const issue of validate(committed, stock, knobs)) problems.push(`design-systems/${issue.where}: ${issue.message}`)
  if (!existsSync(path.join(root, "design-systems", committed.system.id, "system.json")))
    problems.push(`design-systems/${committed.system.id}: missing system.json`)
}

if (problems.length) {
  console.error(`Design systems have ${problems.length} problem${problems.length === 1 ? "" : "s"}:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

const staging = path.join(root, ".generated/registry")

if (onlySystem) {
  if (!outDir) {
    console.error("--system needs --out <dir>.")
    process.exit(1)
  }
  const target = path.resolve(root, outDir)
  rmSync(target, { recursive: true, force: true })
  const committed = systems[0]
  buildOne({ system: committed.system, entries: committed.entries }, target, path.join(staging, committed.system.id))
  hostCheck(target, `${committed.system.id}:`)
  if (problems.length) {
    console.error(problems.map((p) => `  - ${p}`).join("\n"))
    process.exit(1)
  }
  console.log(`Built ${committed.system.name} into ${path.relative(root, target)}.`)
  process.exit(0)
}

const target = check ? path.join(tmpdir(), `unending-r-${process.pid}`) : path.join(root, "public/r")
// Stock only: the top-level files. Any folders under public/r are local
// leftovers from before systems moved to the registry host, and git-ignored.
for (const name of listFiles(target)) rmSync(path.join(target, name))
if (check) rmSync(target, { recursive: true, force: true })
buildOne(null, target, path.join(staging, "stock"))
hostCheck(target, "Stock:")

if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join("\n"))
  process.exit(1)
}

if (check) {
  const actual = path.join(root, "public/r")
  const a = listFiles(target).sort()
  const b = listFiles(actual).sort()
  const stale = [
    ...a.filter((f) => !b.includes(f)).map((f) => `missing public/r/${f}`),
    ...b.filter((f) => !a.includes(f)).map((f) => `extra public/r/${f}`),
    ...a.filter((f) => b.includes(f) && readFileSync(path.join(target, f), "utf8") !== readFileSync(path.join(actual, f), "utf8")).map(
      (f) => `stale public/r/${f}`
    ),
  ]
  rmSync(target, { recursive: true, force: true })
  if (stale.length) {
    console.error("public/r is out of date. Run npm run registry:build.")
    for (const line of stale.slice(0, 20)) console.error(`  - ${line}`)
    process.exit(1)
  }
  console.log(`Stock in sync; ${systems.length} local design system${systems.length === 1 ? "" : "s"} valid.`)
} else {
  console.log(`Built Stock into public/r; ${systems.length} local design system${systems.length === 1 ? "" : "s"} valid. Ship uploads systems to the registry.`)
}
