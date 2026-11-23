import { env } from "cloudflare:test"
import worker from "../src/index.ts"
import type { Env } from "../src/env.ts"
import {
  adminMessage,
  base64url,
  HEADER,
  keyIdOf,
  manifestPayload,
  releaseMessage,
  RELEASE_FORMAT,
  sha256Hex,
  type ShipBody,
} from "../src/shared/protocol.ts"

export const ORIGIN = "https://registry.unending.studio"

export type TestKey = { keyId: string; publicKey: string; sign: (message: string) => Promise<string> }

/** A P-256 key pair standing in for a Mac's Secure Enclave key. */
export async function makeKey(): Promise<TestKey> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair
  const publicKey = base64url((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer)
  return {
    publicKey,
    keyId: await keyIdOf(publicKey),
    sign: async (message) =>
      base64url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(message))),
  }
}

export function testEnv(overrides: Partial<Env> = {}): Env {
  return { ...(env as unknown as Env), ...overrides }
}

export function call(request: Request, e: Env) {
  return worker.fetch(request, e)
}

type SignOptions = { time?: number; nonce?: string; keyId?: string; tamper?: (headers: Headers) => void; headers?: Record<string, string> }

export async function signed(key: TestKey, method: string, path: string, body?: unknown, options: SignOptions = {}) {
  const text = body === undefined ? "" : JSON.stringify(body)
  const url = new URL(path, ORIGIN)
  const time = String(options.time ?? Math.floor(Date.now() / 1000))
  const nonce = options.nonce ?? base64url(crypto.getRandomValues(new Uint8Array(18)))
  const signature = await key.sign(
    adminMessage({ method, host: url.host, path: url.pathname + url.search, time, nonce, bodyHash: await sha256Hex(text) })
  )
  const headers = new Headers({
    [HEADER.key]: options.keyId ?? key.keyId,
    [HEADER.time]: time,
    [HEADER.nonce]: nonce,
    [HEADER.signature]: signature,
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...options.headers,
  })
  options.tamper?.(headers)
  return new Request(url, { method, headers, body: body === undefined ? undefined : text })
}

// ── A small, valid version ─────────────────────────────────────────────────

const schema = "https://ui.shadcn.com/schema/registry-item.json"

export function sampleItems(): Record<string, Record<string, unknown>> {
  return {
    theme: {
      $schema: schema,
      name: "theme",
      type: "registry:theme",
      title: "Test theme",
      cssVars: {
        theme: { "font-sans": "var(--font-sans)" },
        light: { background: "oklch(1 0 0)", radius: "0.625rem" },
        dark: { background: "oklch(0.2 0.01 160)", border: "oklch(1 0 0 / 10%)" },
      },
      css: { "@layer base": { ":root": { "--jade-1": "oklch(0.98 0.01 160)" } } },
    },
    "design-rules": {
      $schema: schema,
      name: "design-rules",
      type: "registry:file",
      files: [{ path: "docs/design-system.md", type: "registry:file", target: "~/docs/design-system.md", content: "# Rules\n" }],
    },
    "page-nav": {
      $schema: schema,
      name: "page-nav",
      type: "registry:component",
      dependencies: ["lucide-react"],
      registryDependencies: ["sidebar", "@unending/theme"],
      files: [{ path: "registry/unending/page-nav/page-nav.tsx", type: "registry:component", content: "export function PageNav() { return null }\n" }],
      css: { "@layer base": { '[data-slot="page-nav"]': { "--page-nav-speed": "150ms" } } },
    },
  }
}

export function sampleFiles(items = sampleItems(), systemId = "jade", name = "Jade"): Record<string, string> {
  const files: Record<string, string> = {}
  for (const [item, value] of Object.entries(items)) files[`r/${item}.json`] = JSON.stringify(value)
  const index = Object.values(items).map((item) => ({
    ...item,
    files: (item.files as { content?: string }[] | undefined)?.map(({ content: _content, ...rest }) => rest),
  }))
  files["r/registry.json"] = JSON.stringify({ $schema: "https://ui.shadcn.com/schema/registry.json", name: "unending", homepage: "https://example.com", items: index })
  files["src/system.json"] = JSON.stringify({ id: systemId, name, version: 1 })
  files["src/entries/page-nav.json"] = JSON.stringify({ entry: "page-nav", knobs: {} })
  return files
}

export type Shipment = { body: ShipBody; releaseSignature: string }

export async function shipBody(key: TestKey, version: number, files = sampleFiles(), extra: Partial<ShipBody> = {}, system = "jade"): Promise<Shipment> {
  const items: Record<string, string> = {}
  const source: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith("r/")) items[path.slice(2)] = await sha256Hex(content)
    else source[path.slice(4)] = await sha256Hex(content)
  }
  const payload = manifestPayload({ format: RELEASE_FORMAT, system, version, createdAt: new Date().toISOString(), items, source })
  const body: ShipBody = { version, name: "Jade", release: { payload, keyId: key.keyId }, files, ...extra }
  return { body, releaseSignature: await key.sign(releaseMessage(payload)) }
}

/** A signed ship request, with the release signature in its header. */
export async function shipRequest(key: TestKey, shipment: Shipment, system = "jade") {
  return signed(key, "POST", `/admin/systems/${system}/versions`, shipment.body, { headers: { [HEADER.releaseSignature]: shipment.releaseSignature } })
}

export const ALLOW = ["lucide-react", "cn"]

/** The test org's numeric id on GitHub. */
export const ACME_ID = 1234

/** Seeds the allowlist with a signed call. */
export async function seedAllowlist(key: TestKey, e: Env) {
  const response = await call(await signed(key, "POST", "/admin/allowlist", { add: ALLOW }), e)
  if (response.status !== 200) throw new Error(`allowlist: ${response.status} ${await response.text()}`)
}

export async function ship(key: TestKey, e: Env, version: number, extra: Partial<ShipBody> = {}, files?: Record<string, string>) {
  const shipment = await shipBody(key, version, files, { ...(version === 1 ? { org: "acme", orgId: ACME_ID } : {}), ...extra })
  return call(await shipRequest(key, shipment), e)
}
