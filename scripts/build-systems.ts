// Builds a design system into its own GitHub repo, from the files the tuner
// saves. Each entry is baked: its useEntryTuning(...) call becomes a plain
// object with the system's values, so an app receives an ordinary component
// with no tuning layer.
//
//   (no flags)   checks the entries' knobs and every local design system
//   --system <id> --address <owner/repo> --version <n>
//                builds design-systems/<id>/ (a clone of the system's repo)
//                into a shadcn GitHub registry: registry.json at the root
//                plus the baked files. Same-repo dependencies are pinned to
//                owner/repo/<item>#v<n>, so a version only pulls its own items.
//
// Run with: node --experimental-strip-types scripts/build-systems.ts [...]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"

import { readCommitted, systemsDir } from "../lib/design-systems/load.ts"
import { fontById, stockFonts } from "../lib/design-systems/fonts.ts"
import { paletteVars, scopedSelectors, scopedVars, toVar } from "../lib/design-systems/resolve.ts"
import { typeVars } from "../lib/design-systems/type-scale.ts"
import { parsePaletteRef, validate, type Knob, type SystemFile, type Working } from "../lib/design-systems/schema.ts"

const root = process.cwd()
const argument = (flag: string) => {
  const at = process.argv.indexOf(flag)
  return at === -1 ? undefined : process.argv[at + 1]
}
const onlySystem = argument("--system")
const address = argument("--address")
const version = argument("--version")
const registry = JSON.parse(readFileSync(path.join(root, "registry.json"), "utf8"))
const ADDRESS = new URL(registry.homepage).pathname.slice(1)

/** Built files and folders in a system repo. Everything else (system.json, entries/, .git) is source. */
const BUILT = ["registry.json", "registry", "docs", "eslint", "README.md"]

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
  for (const [name, value] of Object.entries(typeVars(t))) theme[name.slice(2)] = value
  if (t["--spacing-flow"]) theme["spacing-flow"] = t["--spacing-flow"]
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
    registryDependencies: [] as string[],
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
    "- Text sizes come from the `text-*` scale; UI text is `text-sm`. Separate paragraphs of running text with `space-y-flow` (or `mt-flow`), not a fixed margin.",
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

// ── Building one system repo ────────────────────────────────────────────────

/** A same-repo dependency, pinned to this version. */
const pinned = (repo: string, n: string, item: string) => `${repo}/${item}#v${n}`

function buildRepo(working: Working, dir: string, repo: string, n: string) {
  for (const built of BUILT) rmSync(path.join(dir, built), { recursive: true, force: true })
  const out: Item[] = []
  const pin = (item: string) => pinned(repo, n, item)

  const theme = themeFor(working)
  theme.registryDependencies = fontItems(working.system).map((font) => pin(font.name))
  out.push(theme)
  out.push(...fontItems(working.system))

  writeFile(dir, "docs/design-system.md", designRules(working))
  out.push({
    name: "design-rules",
    type: "registry:file",
    title: "Design rules",
    description: "How UI in this app uses the design system: semantic colour, status colour, shape, type and motion. Point your agents at it.",
    files: [{ path: "docs/design-system.md", type: "registry:file", target: "~/docs/design-system.md" }],
  })
  writeFile(dir, "eslint/unending-colors.mjs", readFileSync(path.join(root, "scripts/templates/unending-colors.mjs"), "utf8"))
  out.push({
    name: "lint-colors",
    type: "registry:file",
    title: "Colour lint rule",
    description: "An ESLint rule that flags raw colours and palette classes so UI keeps to the semantic tokens.",
    files: [{ path: "eslint/unending-colors.mjs", type: "registry:file", target: "~/eslint/unending-colors.mjs" }],
    docs: 'Add it to eslint.config.mjs: import unendingColors from "./eslint/unending-colors.mjs", then include unendingColors in the exported array.',
  })

  for (const item of entryItems) {
    const tuning = working.entries[item.name]
    const files = (item.files as { path: string; type: string; target?: string }[]).map((file) => {
      const source = readFileSync(path.join(root, file.path), "utf8")
      writeFile(dir, file.path, bake(source, file.path, tuning?.knobs ?? {}))
      return file
    })
    const built: Item = {
      ...item,
      files,
      registryDependencies: (item.registryDependencies as string[])
        .filter((dep) => dep !== `${ADDRESS}/tuning`)
        .map((dep) => (dep.startsWith(`${ADDRESS}/`) ? pin(dep.slice(ADDRESS.length + 1)) : dep)),
    }
    if (tuning) {
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

  // The shadcn CLI writes CSS values into consumers' stylesheets as-is, so no
  // value may be able to close or open a rule.
  for (const item of out)
    for (const [where, value] of cssLeaves({ cssVars: item.cssVars, css: item.css }))
      if (/[;{}]/.test(value)) problems.push(`${item.name}: CSS value at ${where} contains ; { or }, which would break out of its rule.`)

  const reg = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: working.system.id,
    homepage: `https://github.com/${repo}`,
    items: out,
  }
  writeFileSync(path.join(dir, "registry.json"), JSON.stringify(reg, null, 2) + "\n")
  writeFileSync(path.join(dir, "README.md"), readme(working, repo, n, out))
  const ignore = path.join(dir, ".gitignore")
  if (!existsSync(ignore)) writeFileSync(ignore, "# Tuning proposals stay in the catalog until accepted.\nentries/*.proposed.json\n.DS_Store\n")
}

function readme(working: Working, repo: string, n: string, items: Item[]) {
  const entries = items.filter((item) => item.meta?.entry)
  return [
    `# ${working.system.name}`,
    "",
    `A design system from the [Unending catalog](https://github.com/${ADDRESS}), built as a [shadcn registry](https://ui.shadcn.com/docs/registry/github). Version ${n}.`,
    "",
    "## Install",
    "",
    "With the Unending plugin for Claude Code, run `/unending:setup` in your app and pick this repo. Or install directly, pinned to a version:",
    "",
    "```bash",
    `npx shadcn@4.23.0 add ${pinned(repo, n, "theme")} ${pinned(repo, n, "design-rules")}`,
    `npx shadcn@4.23.0 add ${pinned(repo, n, entries[0]?.name ?? "theme")}`,
    "```",
    "",
    "Private repos install with your own `gh auth login`.",
    "",
    "## Entries",
    "",
    "| Entry | Intent |",
    "| --- | --- |",
    ...entries.map((item) => `| \`${item.name}\` | ${item.meta.intent} |`),
    "",
    "Generated by Ship. Edit the system in the catalog, not here: `system.json` and `entries/` are its source, and everything else is rebuilt on every ship.",
    "",
  ].join("\n")
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

const knobs = await loadKnobs()
checkKnobDefaults(knobs)
const systems = (await readCommitted()).filter((c) => !onlySystem || c.system.id === onlySystem)
if (onlySystem && !systems.length) problems.push(`design-systems/${onlySystem}: no such saved system`)
for (const committed of systems)
  for (const issue of validate(committed, stock, knobs)) problems.push(`design-systems/${issue.where}: ${issue.message}`)

if (onlySystem && !problems.length) {
  if (!address || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(address) || !version || !/^[1-9]\d*$/.test(version)) {
    console.error("--system needs --address <owner/repo> and --version <n>.")
    process.exit(1)
  }
  const committed = systems[0]
  buildRepo({ system: committed.system, entries: committed.entries }, path.join(systemsDir, committed.system.id), address, version)
}

if (problems.length) {
  console.error(`Design systems have ${problems.length} problem${problems.length === 1 ? "" : "s"}:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(
  onlySystem
    ? `Built ${systems[0].system.name} v${version} for ${address}.`
    : `Entries' knobs match their code; ${systems.length} local design system${systems.length === 1 ? "" : "s"} valid.`
)
