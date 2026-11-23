// Talks to the registry Worker's admin API with requests signed by this Mac's
// key. Server only (dev server).
import { readFileSync } from "node:fs"
import path from "node:path"

import {
  adminMessage,
  base64url,
  HEADER,
  parseManifest,
  releaseMessage,
  sha256Hex,
  verify,
  type Manifest,
  type Release,
} from "../../worker/src/shared/protocol.ts"
import { keyInfo, sign, type KeyInfo } from "./signer.ts"

/** The registry host. Override with UNENDING_REGISTRY_URL (for example a local `wrangler dev`). */
export const registryUrl = (process.env.UNENDING_REGISTRY_URL || "https://registry.unending.studio").replace(/\/+$/, "")

export function registryUrlProblem() {
  try {
    const url = new URL(registryUrl)
    if (url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) return null
  } catch {}
  return "UNENDING_REGISTRY_URL must be an https URL (or localhost for wrangler dev)."
}

export type AdminResult<T> = { ok: boolean; status: number; data: T & { error?: string } }

/**
 * Sends one signed admin request. `also` are extra messages signed in the
 * same Touch ID prompt, whose signatures go into headers (a ship's release).
 */
export async function admin<T = Record<string, unknown>>(
  method: "GET" | "POST",
  pathAndQuery: string,
  options: { body?: unknown; reason: string; also?: { message: string; header: string }[] }
): Promise<AdminResult<T>> {
  const urlProblem = registryUrlProblem()
  if (urlProblem) throw new Error(urlProblem)
  const key = await keyInfo()
  if (!key) throw new Error("This Mac has no admin key yet. Use Set up this Mac in Ship.")
  const url = new URL(pathAndQuery, registryUrl)
  const text = options.body === undefined ? "" : JSON.stringify(options.body)
  const time = String(Math.floor(Date.now() / 1000))
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(18)))
  const message = adminMessage({ method, host: url.host, path: url.pathname + url.search, time, nonce, bodyHash: await sha256Hex(text) })
  const also = options.also ?? []
  const [signature, ...extra] = await sign([message, ...also.map((a) => a.message)], options.reason)
  const headers: Record<string, string> = {
    [HEADER.key]: key.keyId,
    [HEADER.time]: time,
    [HEADER.nonce]: nonce,
    [HEADER.signature]: signature,
  }
  also.forEach((a, i) => (headers[a.header] = extra[i]))
  if (options.body !== undefined) headers["content-type"] = "application/json"
  const response = await fetch(url, { method, headers, body: options.body === undefined ? undefined : text, redirect: "error" })
  const data = (await response.json().catch(() => ({ error: `The registry answered ${response.status}.` }))) as T & { error?: string }
  return { ok: response.ok, status: response.status, data }
}

export { releaseMessage }

// ── Trust ───────────────────────────────────────────────────────────────────

type PinnedKey = { keyId: string; publicKey: string; addedAt: string; retiredAt?: string; releases?: string[] }
export const pinnedKeysFile = path.join(process.cwd(), "plugin/keys.json")

export function pinnedKeys(): PinnedKey[] {
  try {
    return (JSON.parse(readFileSync(pinnedKeysFile, "utf8")) as { keys: PinnedKey[] }).keys ?? []
  } catch {
    return []
  }
}

/**
 * Checks a release came from a trusted key and that every file matches it.
 * Trusted: an active pinned key, a retired one for a release it pinned, or
 * this Mac's own key. Returns the manifest, or throws.
 */
export async function verifyRelease(
  release: Release,
  files: { source?: Record<string, string>; items?: Record<string, string> },
  local: KeyInfo | null
): Promise<Manifest> {
  if (release.signer.kind !== "admin") throw new Error("Only admin-signed releases can be pulled.")
  const { keyId, signature } = release.signer
  const payloadHash = await sha256Hex(release.payload)
  const pinned = pinnedKeys().find((k) => k.keyId === keyId && (!k.retiredAt || k.releases?.includes(payloadHash)))
  const publicKey = pinned?.publicKey ?? (local?.keyId === keyId ? local.publicKey : undefined)
  if (!publicKey) throw new Error(`The release was signed by key ${keyId}, which isn't trusted here.`)
  if (!(await verify(publicKey, signature, releaseMessage(release.payload)))) throw new Error("The release signature doesn't verify.")
  const manifest = parseManifest(release.payload)
  for (const [kind, list] of [
    ["source", files.source],
    ["items", files.items],
  ] as const) {
    if (!list) continue
    const expected = manifest[kind]
    if (Object.keys(list).length !== Object.keys(expected).length) throw new Error(`The ${kind} files don't match the release.`)
    for (const [file, content] of Object.entries(list))
      if (expected[file] !== (await sha256Hex(content))) throw new Error(`${file} doesn't match its hash in the release.`)
  }
  return manifest
}
