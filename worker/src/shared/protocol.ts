// The wire format shared by the registry Worker, the catalog's Ship and the
// tests. Pure TypeScript on WebCrypto, so it runs in Workers and in Node.
//
// Two kinds of signature, both P-256 ECDSA over SHA-256 (raw r||s, base64url),
// made by an admin key in a Mac's Secure Enclave:
//
//   admin request   proves a request comes from you, now, once
//   release         proves who made a version's files, for consumers
//
// Each signed message starts with its own context line, so a signature made
// for one can never be replayed as the other.

export const ADMIN_CONTEXT = "unending-admin-v1"
export const RELEASE_CONTEXT = "unending-release-v1"
export const RELEASE_FORMAT = "unending-release-1"

export const HEADER = {
  key: "x-unending-key",
  time: "x-unending-time",
  nonce: "x-unending-nonce",
  signature: "x-unending-signature",
  /** On a ship: the release's signature. A header, not the body, so the
   *  request and the release can be signed together with one Touch ID. */
  releaseSignature: "x-unending-release-signature",
} as const

/** How far a signed request's clock may be from the Worker's, in seconds. */
export const MAX_SKEW_SECONDS = 60

/** System and item names: what goes into R2 keys and URLs. */
export const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Item names the Worker uses itself, so no item may take them. */
export const reservedItemNames = ["release", "systems"]
/** Ids no shipped system may take. Stock is published only by GitHub Actions. */
export const reservedSystemIds = ["stock", "api", "preview", "r", "fonts", "_next", "static", "new", "settings", "admin", "login", "publish"]

export const nonceSyntax = /^[A-Za-z0-9_-]{16,64}$/

const encoder = new TextEncoder()

export function bytes(text: string) {
  return encoder.encode(text)
}

export function base64url(data: ArrayBuffer | Uint8Array) {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ""
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function fromBase64url(text: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url")
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array) {
  const input = typeof data === "string" ? bytes(data) : data instanceof Uint8Array ? data : new Uint8Array(data)
  const digest = await crypto.subtle.digest("SHA-256", input as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

// ── Keys ────────────────────────────────────────────────────────────────────

export type PublicKey = { keyId: string; publicKey: string }

/** A key's id: the first 16 hex characters of the SHA-256 of its raw point. */
export async function keyIdOf(publicKey: string) {
  return (await sha256Hex(fromBase64url(publicKey))).slice(0, 16)
}

/** Parses a comma, space or newline separated list of base64url public keys. Ids are computed, never trusted. */
export async function parseKeys(list: string | undefined): Promise<PublicKey[]> {
  const keys: PublicKey[] = []
  for (const publicKey of (list ?? "").split(/[\s,]+/).filter(Boolean)) {
    const raw = fromBase64url(publicKey)
    if (raw.length !== 65 || raw[0] !== 4) throw new Error("Each admin key must be an uncompressed P-256 point, base64url.")
    keys.push({ keyId: await keyIdOf(publicKey), publicKey })
  }
  return keys
}

export async function verify(publicKey: string, signature: string, message: string) {
  try {
    const key = await crypto.subtle.importKey("raw", fromBase64url(publicKey) as Uint8Array<ArrayBuffer>, { name: "ECDSA", namedCurve: "P-256" }, false, [
      "verify",
    ])
    const sig = fromBase64url(signature)
    if (sig.length !== 64) return false
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig as Uint8Array<ArrayBuffer>, bytes(message))
  } catch {
    return false
  }
}

// ── Admin requests ──────────────────────────────────────────────────────────

export type AdminParts = { method: string; host: string; path: string; time: string; nonce: string; bodyHash: string }

/** The exact text an admin request's signature covers. `path` includes the query string. */
export function adminMessage(parts: AdminParts) {
  return [ADMIN_CONTEXT, parts.method.toUpperCase(), parts.host.toLowerCase(), parts.path, parts.time, parts.nonce, parts.bodyHash].join("\n")
}

// ── Releases ────────────────────────────────────────────────────────────────

/**
 * What a release vouches for. `items` maps each served file (`<item>.json`,
 * including `registry.json`) to the SHA-256 of its exact bytes; `source` does
 * the same for the system's own files, which only Pull reads.
 */
export type Manifest = {
  format: typeof RELEASE_FORMAT
  system: string
  version: number
  createdAt: string
  commit?: string
  items: Record<string, string>
  source: Record<string, string>
}

/** Who made a release: an admin key, or (Stock only) a GitHub Actions run on main. */
export type Signer =
  | { kind: "admin"; keyId: string; signature: string }
  | { kind: "github"; repository: string; repositoryId: string; commit: string; workflow: string; runId: string }

/** The stored release: the manifest's exact text, and who signed it. */
export type Release = { payload: string; signer: Signer }

export function releaseMessage(payload: string) {
  return `${RELEASE_CONTEXT}\n${payload}`
}

export function parseManifest(payload: string): Manifest {
  const manifest = JSON.parse(payload) as Manifest
  const hex = /^[0-9a-f]{64}$/
  if (manifest?.format !== RELEASE_FORMAT) throw new Error("Unknown release format.")
  if (!namePattern.test(manifest.system)) throw new Error("Bad system in the release.")
  if (!Number.isInteger(manifest.version) || manifest.version < 1) throw new Error("Bad version in the release.")
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt))) throw new Error("Bad date in the release.")
  if (manifest.commit !== undefined && !/^[0-9a-f]{40}$/.test(manifest.commit)) throw new Error("Bad commit in the release.")
  for (const map of [manifest.items, manifest.source]) {
    if (!map || typeof map !== "object" || Array.isArray(map)) throw new Error("Bad file list in the release.")
    for (const value of Object.values(map)) if (!hex.test(value)) throw new Error("Bad hash in the release.")
  }
  for (const file of Object.keys(manifest.items)) if (!itemFilePattern.test(file)) throw new Error(`Bad item file ${file} in the release.`)
  for (const file of Object.keys(manifest.source)) if (!sourceFilePattern.test(file)) throw new Error(`Bad source file ${file} in the release.`)
  return manifest
}

/** Served files: `<item>.json`. */
export const itemFilePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/
/** Source files: `system.json` and `entries/<entry>.json`. */
export const sourceFilePattern = /^(?:system\.json|entries\/[a-z0-9]+(?:-[a-z0-9]+)*\.json)$/

/** Serialises a manifest the one way Ship does, so tests and tools agree. */
export function manifestPayload(manifest: Manifest) {
  const sorted = (map: Record<string, string>) => Object.fromEntries(Object.entries(map).sort(([a], [b]) => (a < b ? -1 : 1)))
  return JSON.stringify({ ...manifest, items: sorted(manifest.items), source: sorted(manifest.source) })
}

// ── Uploads ─────────────────────────────────────────────────────────────────

/** POST /admin/systems/<id>/versions */
export type ShipBody = {
  /** The version this ship expects to create: one past the latest. */
  version: number
  /** Display name, for listings and alerts. */
  name: string
  /** Required on a system's first ship: the GitHub org whose members may read it. */
  org?: string
  /** npm packages this ship adds to the allowlist. Only sent after you approve them. */
  allow?: string[]
  /** The manifest's exact text. Its signature travels in the release-signature header. */
  release: { payload: string; keyId: string }
  /** `r/<item>.json` and `src/<path>` to their exact text. */
  files: Record<string, string>
  summary?: string
}

/** POST /publish/stock, authenticated with a GitHub OIDC token. */
export type StockBody = { files: Record<string, string> }

export const LIMITS = {
  bodyBytes: 5 * 1024 * 1024,
  fileBytes: 512 * 1024,
  files: 200,
  summary: 2000,
}

/** GitHub org logins: what the membership API accepts. */
export const orgPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/
