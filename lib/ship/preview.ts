import { mkdirSync } from "node:fs"
import path from "node:path"

export const previewDir = "preview"
export const previewFiles = { light: `${previewDir}/light.png`, dark: `${previewDir}/dark.png` } as const

const VIEWPORT = { width: 1440, height: 1200 }
const SAMPLE = "[data-sample]"
const SETTLE_MS = 500

export async function capturePreview({ base, systemId, dir, signal }: { base: string; systemId: string; dir: string; signal?: AbortSignal }) {
  const { chromium } = await import("playwright-core")
  const browser = await chromium.launch({ channel: "chrome", headless: true })
  const close = () => void browser.close()
  signal?.addEventListener("abort", close, { once: true })
  try {
    mkdirSync(path.join(dir, previewDir), { recursive: true })
    for (const scheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ colorScheme: scheme, deviceScaleFactor: 2, viewport: VIEWPORT })
      const page = await context.newPage()
      await page.goto(`${base}/${systemId}/sample`, { waitUntil: "networkidle" })
      await page.evaluate(() => document.fonts.ready.then(() => true))
      const sample = page.locator(SAMPLE)
      await sample.waitFor()
      await page.waitForTimeout(SETTLE_MS)
      await sample.screenshot({ path: path.join(dir, previewFiles[scheme]), animations: "disabled" })
      await context.close()
    }
  } finally {
    signal?.removeEventListener("abort", close)
    await browser.close().catch(() => {})
  }
}
