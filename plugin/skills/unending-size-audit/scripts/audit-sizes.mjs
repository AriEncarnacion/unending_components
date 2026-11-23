#!/usr/bin/env node
// Size audit: loads a catalog entry (or any page) at every device checkpoint
// from its minimum width to 2560px, one size at a time in one headless Chrome
// tab, runs the layout check at each, and saves a screenshot with problems
// outlined. Claude reads the report and the screenshots and suggests fixes.
//
//   node audit-sizes.mjs --entry review-deck            # in the catalog repo
//   node audit-sizes.mjs --url http://127.0.0.1:3000/x  # any page
//
// Options:
//   --entry <name>        catalog entry; loads /<system>/frame/<name>
//   --url <url>           any page instead (window sizes only)
//   --root <selector>     what to check on a --url page (default: body)
//   --system <id>         design system for --entry (default: stock)
//   --base <url>          dev server (default: http://127.0.0.1:3000)
//   --modes window,container
//   --schemes light[,dark]
//   --min <px>            minimum width (default: the entry's meta.minWidth, else 320)
//   --out <dir>           where to write report.json and screenshots
//
// Uses playwright-core with the installed Google Chrome, so there's no browser
// download. Needs `playwright-core` in the project's devDependencies.

import { createRequire } from "node:module"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

const DEVICES = [
  { width: 320, height: 568, label: "Smallest phone (WCAG reflow)" },
  { width: 375, height: 667, label: "iPhone SE / mini" },
  { width: 393, height: 852, label: "iPhone 15 / Pixel" },
  { width: 430, height: 932, label: "iPhone Pro Max" },
  { width: 768, height: 1024, label: "iPad portrait" },
  { width: 1024, height: 768, label: "iPad landscape / small laptop" },
  { width: 1280, height: 800, label: "Laptop" },
  { width: 1440, height: 900, label: "Desktop" },
  { width: 1920, height: 1080, label: "Full HD" },
  { width: 2560, height: 1440, label: "QHD" },
]
const WIDE_WINDOW = { width: 1440, height: 900 }

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (!key.startsWith("--")) continue
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true"
    args[key.slice(2)] = value
  }
  return args
}

async function entryMinWidth(entry) {
  const registry = path.join(process.cwd(), "registry.json")
  if (!existsSync(registry)) return undefined
  const items = JSON.parse(await readFile(registry, "utf8")).items ?? []
  return items.find((item) => item.name === entry)?.meta?.minWidth
}

function sizesFrom(min) {
  const above = DEVICES.filter((size) => size.width > min)
  const at = DEVICES.find((size) => size.width === min)
  return [at ?? { width: min, height: 720, label: "Minimum" }, ...above]
}

async function loadPlaywright() {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))("playwright-core")
  } catch {
    console.error("playwright-core isn't installed here. Add it: npm i -D playwright-core")
    process.exit(2)
  }
}

const args = parseArgs(process.argv.slice(2))
if (!args.entry && !args.url) {
  console.error("Pass --entry <name> or --url <url>.")
  process.exit(2)
}
const base = (args.base ?? "http://127.0.0.1:3000").replace(/\/$/, "")
const system = args.system ?? "stock"
const subject = args.entry ?? (new URL(args.url).pathname.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "page")
const modes = (args.modes ?? (args.entry ? "window,container" : "window")).split(",")
const schemes = (args.schemes ?? "light").split(",")
const min = Number(args.min) || (args.entry ? await entryMinWidth(args.entry) : undefined) || 320
const out = path.resolve(args.out ?? path.join(os.tmpdir(), "unending-size-audit", subject))
const check = await readFile(path.join(here, "layout-check.js"), "utf8")

const { chromium } = await loadPlaywright()
const browser = await chromium.launch({ channel: "chrome", headless: true })
const results = []

try {
  await mkdir(out, { recursive: true })
  for (const scheme of schemes) {
    const context = await browser.newContext({ colorScheme: scheme, deviceScaleFactor: 1 })
    const page = await context.newPage()
    for (const mode of modes) {
      if (mode === "container" && !args.entry) continue
      for (const size of sizesFrom(min)) {
        const viewport = mode === "window" ? { width: size.width, height: size.height } : WIDE_WINDOW
        const url = args.entry
          ? `${base}/${system}/frame/${args.entry}${mode === "container" ? `?w=${size.width}` : ""}`
          : args.url
        await page.setViewportSize(viewport)
        // A fresh load per size: each one tests a first render at that size,
        // not a resize from the last.
        await page.goto(url, { waitUntil: "load" })
        if (args.entry) {
          // Set by the frame once the demo is hydrated, fonts are in and it
          // has painted. Before that the page holds the server HTML.
          await page.waitForFunction(() => document.documentElement.dataset.frameReady === "true", null, {
            timeout: 30_000,
          })
        } else {
          await page.evaluate(() => document.fonts.ready)
          await page.waitForTimeout(800)
        }
        const rootSelector = args.entry ? "[data-frame-root]" : (args.root ?? "body")
        const issues = await page.evaluate(
          ([source, selector]) => {
            const root = document.querySelector(selector) ?? document.body
            return (0, eval)(source)(root)
          },
          [check, rootSelector]
        )
        await page.addStyleTag({
          content:
            "[data-layout-issue]{outline:2px dashed var(--destructive, red)!important;outline-offset:1px}nextjs-portal{display:none!important}",
        })
        const shot = path.join(out, `${scheme}-${mode}-${size.width}.jpg`)
        await page.screenshot({ path: shot, fullPage: true, type: "jpeg", quality: 80 })
        results.push({ scheme, mode, width: size.width, device: size.label, url, issues, screenshot: shot })
        process.stdout.write(`${scheme} ${mode} ${size.width}px: ${issues.length ? `${issues.length} problem(s)` : "clean"}\n`)
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
}

const total = results.reduce((sum, result) => sum + result.issues.length, 0)
await writeFile(path.join(out, "report.json"), JSON.stringify({ subject, min, results }, null, 2))

// A summary Claude can read without opening the JSON: one line per size with
// problems, the first few findings, and where the screenshot is.
console.log(`\n${subject}: ${total ? `${total} problem(s)` : "no problems"} across ${results.length} checks (min ${min}px)`)
for (const result of results.filter((result) => result.issues.length)) {
  console.log(`\n${result.scheme} · ${result.mode} · ${result.width}px (${result.device}) — ${result.screenshot}`)
  for (const issue of result.issues.slice(0, 8)) console.log(`  ${issue.kind}: ${issue.element} ${issue.detail}  [${issue.path}]`)
  if (result.issues.length > 8) console.log(`  …and ${result.issues.length - 8} more in report.json`)
}
console.log(`\nReport: ${path.join(out, "report.json")}`)
if (args.strict === "true" && total) process.exit(1)
