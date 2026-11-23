// Upload validation. The Worker runs it on every upload and trusts nothing it
// receives; Ship runs the same checks first, so mistakes show up before Touch ID.
//
// Validation can't tell a backdoored component from a real one (signed
// releases cover that). What it does stop is everything a registry item can
// do besides add components: writing files outside the allowed places, setting
// env vars, pulling packages nobody approved, depending on other registries,
// and CSS that breaks out of its rule into consumers' stylesheets.
import { itemFilePattern, LIMITS, namePattern, reservedItemNames, sourceFilePattern } from "./protocol.ts"

export type Problem = string

// ── CSS values ──────────────────────────────────────────────────────────────

const number = String.raw`-?(?:\d+(?:\.\d+)?|\.\d+)`
const unsigned = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`
const ident = String.raw`--[a-z0-9]+(?:-[a-z0-9]+)*`
const fontName = String.raw`(?:"[A-Za-z0-9 ]{1,60}"|'[A-Za-z0-9 ]{1,60}'|[A-Za-z][A-Za-z0-9-]{0,40})`

export const cssValue = {
  colour: new RegExp(
    String.raw`^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|oklch\(${unsigned}%? ${unsigned} ${unsigned}(?: / ${unsigned}%?)?\))$`
  ),
  reference: new RegExp(String.raw`^var\(${ident}\)$`),
  length: new RegExp(String.raw`^${number}(?:px|rem|em)$`),
  number: new RegExp(String.raw`^${number}$`),
  duration: new RegExp(String.raw`^${unsigned}m?s$`),
  easing: new RegExp(
    String.raw`^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(${unsigned}, ?${number}, ?${unsigned}, ?${number}\))$`
  ),
  fontFamily: new RegExp(String.raw`^${fontName}(?:, ?${fontName}){0,8}$`),
}

/** Whether a value may go into a consumer's stylesheet. */
export function cssValueOk(value: unknown) {
  return typeof value === "string" && value.length <= 200 && Object.values(cssValue).some((pattern) => pattern.test(value))
}

const varName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const customProperty = /^--[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Selectors items use: :root, .dark, [data-slot="x"] and combinations of them. */
const selectorPattern = /^(?::root|\.dark|\[data-slot="[a-z0-9-]+"\]|:root:not\(\.dark\))(?: (?::root|\.dark|\[data-slot="[a-z0-9-]+"\]|:root:not\(\.dark\)))*$/

// ── Items ───────────────────────────────────────────────────────────────────

const itemTypes = new Set([
  "registry:theme",
  "registry:font",
  "registry:file",
  "registry:component",
  "registry:block",
  "registry:hook",
  "registry:lib",
])
const fileTypes = new Set(["registry:file", "registry:component", "registry:hook", "registry:lib"])
const itemKeys = new Set([
  "$schema",
  "name",
  "type",
  "title",
  "description",
  "author",
  "dependencies",
  "devDependencies",
  "registryDependencies",
  "files",
  "cssVars",
  "css",
  "meta",
  "docs",
  "categories",
  "font",
])
/** Where files may land in a consumer's project. */
const targetPattern =
  /^~\/(?:docs\/design-system\.md|eslint\/[a-z0-9-]+\.mjs|(?:components|hooks|lib)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.tsx?)$/
const filePathPattern = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)+$/
const dependencySpec = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[A-Za-z0-9.^~<>=| *-]{1,40})?$/
const registryDependency = /^(?:@unending\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/

/** An npm dependency's package name, without its version range. */
export function packageName(spec: string) {
  const at = spec.indexOf("@", spec.startsWith("@") ? 1 : 0)
  return at === -1 ? spec : spec.slice(0, at)
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

const shortText = (value: unknown, max: number) => typeof value === "string" && value.length <= max

export type ItemCheck = {
  /** npm packages the item installs. */
  packages: string[]
  /** @unending/* items it depends on. */
  needs: string[]
}

/**
 * Checks one registry item. `index` items (inside registry.json) may omit
 * file content; served items must carry it.
 */
export function checkItem(item: unknown, where: string, problems: Problem[], index = false): ItemCheck {
  const result: ItemCheck = { packages: [], needs: [] }
  const fail = (message: string) => problems.push(`${where}: ${message}`)
  if (!isObject(item)) {
    fail("must be an object")
    return result
  }
  for (const key of Object.keys(item)) if (!itemKeys.has(key)) fail(`"${key}" isn't allowed${key === "envVars" ? " (items may not set env vars)" : ""}`)
  if (typeof item.name !== "string" || !namePattern.test(item.name)) fail("name must be lowercase words joined by hyphens")
  else if (reservedItemNames.includes(item.name)) fail(`"${item.name}" is reserved`)
  if (typeof item.type !== "string" || !itemTypes.has(item.type)) fail(`type ${JSON.stringify(item.type)} isn't allowed`)
  if (item.$schema !== undefined && item.$schema !== "https://ui.shadcn.com/schema/registry-item.json")
    fail("$schema must be shadcn's registry-item schema")
  for (const key of ["title", "description", "author"] as const)
    if (item[key] !== undefined && !shortText(item[key], 500)) fail(`${key} must be text under 500 characters`)
  if (item.docs !== undefined && !shortText(item.docs, 4000)) fail("docs must be text under 4000 characters")
  if (item.categories !== undefined && (!Array.isArray(item.categories) || item.categories.length > 10 || !item.categories.every((c) => shortText(c, 40))))
    fail("categories must be up to 10 short strings")
  if (item.meta !== undefined && (!isObject(item.meta) || JSON.stringify(item.meta).length > 4000)) fail("meta must be a small object")

  for (const key of ["dependencies", "devDependencies"] as const) {
    const list = item[key]
    if (list === undefined) continue
    if (!Array.isArray(list) || list.length > 40) {
      fail(`${key} must be a list`)
      continue
    }
    for (const spec of list) {
      if (typeof spec !== "string" || !dependencySpec.test(spec)) fail(`${key} has an invalid package ${JSON.stringify(spec)}`)
      else result.packages.push(packageName(spec))
    }
  }

  if (item.registryDependencies !== undefined) {
    if (!Array.isArray(item.registryDependencies) || item.registryDependencies.length > 40) fail("registryDependencies must be a list")
    else
      for (const dep of item.registryDependencies) {
        if (typeof dep !== "string" || !registryDependency.test(dep))
          fail(`registryDependencies may only name @unending/* items or shadcn components, not ${JSON.stringify(dep)}`)
        else if (dep.startsWith("@unending/")) result.needs.push(dep.slice("@unending/".length))
      }
  }

  if (item.files !== undefined) {
    if (!Array.isArray(item.files) || item.files.length > 20) fail("files must be a list of at most 20")
    else
      item.files.forEach((file, i) => {
        const at = `files[${i}]`
        if (!isObject(file)) return fail(`${at} must be an object`)
        for (const key of Object.keys(file)) if (!["path", "type", "content", "target"].includes(key)) fail(`${at}.${key} isn't allowed`)
        if (typeof file.path !== "string" || !filePathPattern.test(file.path) || file.path.length > 200) fail(`${at}.path isn't a safe relative path`)
        if (typeof file.type !== "string" || !fileTypes.has(file.type)) fail(`${at}.type ${JSON.stringify(file.type)} isn't allowed`)
        if (file.target !== undefined && (typeof file.target !== "string" || !targetPattern.test(file.target)))
          fail(`${at}.target must be under components/, hooks/ or lib/, or be docs/design-system.md or eslint/<name>.mjs`)
        if (file.type === "registry:file" && file.target === undefined) fail(`${at} is a registry:file, so it needs an allowed target`)
        if (index ? file.content !== undefined && typeof file.content !== "string" : typeof file.content !== "string")
          fail(`${at}.content must be text`)
      })
  }

  if (item.cssVars !== undefined) {
    if (!isObject(item.cssVars)) fail("cssVars must be an object")
    else
      for (const [scheme, vars] of Object.entries(item.cssVars)) {
        if (!["theme", "light", "dark"].includes(scheme)) {
          fail(`cssVars.${scheme} isn't allowed`)
          continue
        }
        if (!isObject(vars)) {
          fail(`cssVars.${scheme} must be an object`)
          continue
        }
        for (const [name, value] of Object.entries(vars)) {
          if (!varName.test(name)) fail(`cssVars.${scheme} has an invalid name ${JSON.stringify(name)}`)
          if (!cssValueOk(value)) fail(`cssVars.${scheme}.${name} has a value outside the CSS grammar`)
        }
      }
  }

  if (item.css !== undefined) checkCss(item.css, "css", fail, 0)

  if (item.font !== undefined) {
    const font = item.font
    if (!isObject(font)) fail("font must be an object")
    else {
      for (const key of Object.keys(font))
        if (!["family", "provider", "import", "variable", "subsets", "dependency", "weight"].includes(key)) fail(`font.${key} isn't allowed`)
      if (!cssValueOk(font.family) || !cssValue.fontFamily.test(font.family as string)) fail("font.family must be a font-family list")
      if (font.provider !== "google") fail('font.provider must be "google"')
      if (typeof font.import !== "string" || !/^[A-Za-z0-9_]{1,60}$/.test(font.import)) fail("font.import must be a next/font name")
      if (typeof font.variable !== "string" || !/^--font-[a-z]+$/.test(font.variable)) fail("font.variable must be --font-<role>")
      if (font.subsets !== undefined && (!Array.isArray(font.subsets) || !font.subsets.every((s) => typeof s === "string" && /^[a-z-]{1,20}$/.test(s))))
        fail("font.subsets must be subset names")
      if (font.weight !== undefined && (!Array.isArray(font.weight) || !font.weight.every((w) => typeof w === "string" && /^\d{3}$/.test(w))))
        fail("font.weight must be weights like 400")
      if (font.dependency !== undefined) {
        if (typeof font.dependency !== "string" || !dependencySpec.test(font.dependency)) fail("font.dependency must be an npm package")
        else result.packages.push(packageName(font.dependency))
      }
    }
  }
  return result
}

function checkCss(value: unknown, where: string, fail: (message: string) => void, depth: number) {
  if (!isObject(value)) return fail(`${where} must be an object`)
  if (depth > 2) return fail(`${where} nests too deeply`)
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      if (depth === 0) fail(`${where} may only hold rules`)
      else if (!customProperty.test(key)) fail(`${where} may only set custom properties, not ${JSON.stringify(key)}`)
      else if (!cssValueOk(child)) fail(`${where} › ${key} has a value outside the CSS grammar`)
    } else if (key === "@layer base" && depth === 0) checkCss(child, `${where} › @layer base`, fail, depth + 1)
    else if (selectorPattern.test(key) && key.length <= 120) checkCss(child, `${where} › ${key}`, fail, depth + 1)
    else fail(`${where} has a selector or at-rule that isn't allowed: ${JSON.stringify(key)}`)
  }
}

// ── A whole version ─────────────────────────────────────────────────────────

export type BundleCheck = {
  problems: Problem[]
  /** Packages the version installs that the allowlist doesn't have. */
  unknownPackages: string[]
  /** Item names served, without .json. */
  items: string[]
}

/**
 * Checks every file in a version: `r/<item>.json` (served) and `src/...`
 * (the system's own files). `systemId` is set for design systems and absent
 * for Stock, which carries no source.
 */
export function checkBundle(files: unknown, allowlist: Iterable<string>, systemId?: string): BundleCheck {
  const problems: Problem[] = []
  const unknown = new Set<string>()
  const allowed = new Set(allowlist)
  const items: string[] = []
  if (!isObject(files)) return { problems: ["files must be an object"], unknownPackages: [], items }
  const entries = Object.entries(files)
  if (!entries.length || entries.length > LIMITS.files) problems.push(`a version holds 1 to ${LIMITS.files} files`)
  const needs = new Map<string, string>()
  let index: Record<string, unknown> | undefined
  let hasSystem = false

  for (const [path, content] of entries) {
    if (typeof content !== "string") {
      problems.push(`${path}: content must be text`)
      continue
    }
    if (new TextEncoder().encode(content).length > LIMITS.fileBytes) problems.push(`${path}: larger than ${LIMITS.fileBytes / 1024} KiB`)
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      problems.push(`${path}: isn't valid JSON`)
      continue
    }
    if (path.startsWith("r/") && itemFilePattern.test(path.slice(2))) {
      const name = path.slice(2, -".json".length)
      if (name === "registry") {
        index = isObject(parsed) ? parsed : undefined
        continue
      }
      items.push(name)
      const check = checkItem(parsed, path, problems)
      if (isObject(parsed) && parsed.name !== name) problems.push(`${path}: its name must match the file name`)
      for (const pkg of check.packages) if (!allowed.has(pkg)) unknown.add(pkg)
      for (const need of check.needs) needs.set(need, path)
    } else if (path.startsWith("src/") && systemId && sourceFilePattern.test(path.slice(4))) {
      checkSource(path.slice(4), parsed, systemId, problems)
      if (path === "src/system.json") hasSystem = true
    } else problems.push(`${path}: not a file a version may contain`)
  }

  if (!index) problems.push("r/registry.json: missing or not an object")
  else {
    for (const key of Object.keys(index)) if (!["$schema", "name", "homepage", "items"].includes(key)) problems.push(`r/registry.json: "${key}" isn't allowed`)
    if (index.homepage !== undefined && (typeof index.homepage !== "string" || !/^https:\/\/[^\s"'<>]{1,200}$/.test(index.homepage)))
      problems.push("r/registry.json: homepage must be an https URL")
    const listed = Array.isArray(index.items) ? index.items : []
    if (!Array.isArray(index.items)) problems.push("r/registry.json: items must be a list")
    const names: string[] = []
    listed.forEach((item, i) => {
      const check = checkItem(item, `r/registry.json items[${i}]`, problems, true)
      for (const pkg of check.packages) if (!allowed.has(pkg)) unknown.add(pkg)
      if (isObject(item) && typeof item.name === "string") names.push(item.name)
    })
    const served = new Set(items)
    if (names.length !== served.size || !names.every((name) => served.has(name)))
      problems.push("r/registry.json: must list exactly the items served")
  }
  for (const [need, from] of needs) if (!items.includes(need)) problems.push(`${from}: depends on @unending/${need}, which this version doesn't serve`)
  if (systemId && !hasSystem) problems.push("src/system.json: missing")
  return { problems, unknownPackages: [...unknown].sort(), items: items.sort() }
}

function checkSource(path: string, value: unknown, systemId: string, problems: Problem[]) {
  if (!isObject(value)) return problems.push(`src/${path}: must be an object`)
  if (path === "system.json") {
    if (value.id !== systemId) problems.push("src/system.json: its id must be the system being shipped")
    if (typeof value.name !== "string" || !systemNamePattern.test(value.name)) problems.push("src/system.json: name isn't a valid display name")
  } else {
    const entry = path.slice("entries/".length, -".json".length)
    if (value.entry !== entry) problems.push(`src/${path}: its entry must match the file name`)
  }
}

/** Display names: short, one line, letters, digits, spaces, hyphens and apostrophes. */
export const systemNamePattern = /^[\p{L}\p{N}][\p{L}\p{N} '-]{0,39}$/u
