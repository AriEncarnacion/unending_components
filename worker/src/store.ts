// What the Worker keeps in R2, and how it writes it.
//
//   r/<system>/v/<n>/<item>.json      served files          create-only, bucket-locked
//   r/<system>/v/<n>/release.json     the release manifest  create-only, bucket-locked
//   src/<system>/v/<n>/<path>         the system's source   create-only, bucket-locked, never served
//   log/<system>/<n>.json             one line per version  create-only
//   state/registry.json               systems, pointers, visibility, allowlist (compare-and-swap)
//   tokens/<sha256>.json              registry tokens       (no plaintext)
//   nonces/<nonce>                    seen admin nonces     create-only, expire by lifecycle rule
//
// Every key is built from names that already matched namePattern.
import { namePattern } from "./shared/protocol.ts"
import type { Env } from "./env.ts"

export type Visibility = "public" | "private"

export type SystemState = {
  name: string
  visibility: Visibility
  /** For private systems: the GitHub org whose active members may read it. */
  org?: string
  /** The version served at /r/<system>/... */
  current: number
  /** The newest version written. */
  latest: number
  updatedAt: string
}

export type RegistryState = {
  systems: Record<string, SystemState>
  /** npm packages items may install. */
  allowlist: string[]
}

const STATE_KEY = "state/registry.json"

function checkName(name: string) {
  if (!namePattern.test(name)) throw new Error(`Refusing to build a key from ${JSON.stringify(name)}`)
  return name
}

export const keys = {
  item: (system: string, version: number, item: string) => `r/${checkName(system)}/v/${version}/${checkName(item)}.json`,
  release: (system: string, version: number) => `r/${checkName(system)}/v/${version}/release.json`,
  source: (system: string, version: number, path: string) => {
    if (!/^(?:system\.json|entries\/[a-z0-9]+(?:-[a-z0-9]+)*\.json)$/.test(path)) throw new Error(`Bad source path ${path}`)
    return `src/${checkName(system)}/v/${version}/${path}`
  },
  log: (system: string, version: number) => `log/${checkName(system)}/${String(version).padStart(8, "0")}.json`,
  logPrefix: (system: string) => `log/${checkName(system)}/`,
  token: (hash: string) => {
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("Bad token hash")
    return `tokens/${hash}.json`
  },
  nonce: (nonce: string) => `nonces/${nonce}`,
}

export async function readState(env: Env): Promise<{ state: RegistryState; etag?: string }> {
  const object = await env.REGISTRY.get(STATE_KEY)
  if (!object) return { state: { systems: {}, allowlist: [] } }
  return { state: (await object.json()) as RegistryState, etag: object.etag }
}

/**
 * Changes the state with compare-and-swap: re-reads and retries if another
 * write landed in between, so concurrent admin calls never lose an update.
 */
export async function updateState(env: Env, change: (state: RegistryState) => RegistryState) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { state, etag } = await readState(env)
    const next = change(structuredClone(state))
    const written = await env.REGISTRY.put(STATE_KEY, JSON.stringify(next, null, 2), {
      onlyIf: etag ? { etagMatches: etag } : new Headers({ "if-none-match": "*" }),
      httpMetadata: { contentType: "application/json" },
    })
    if (written) return next
  }
  throw new Error("The registry state kept changing; try again.")
}

/** Writes a key only if it doesn't exist yet. Returns false when it already did. */
export async function createOnly(env: Env, key: string, body: string, contentType = "application/json") {
  const written = await env.REGISTRY.put(key, body, {
    onlyIf: new Headers({ "if-none-match": "*" }),
    httpMetadata: { contentType },
  })
  return written !== null
}

/** The version the next ship must create: one past the newest, skipping any claimed by a ship that died halfway. */
export async function nextVersion(env: Env, system: string, state: RegistryState) {
  let version = (state.systems[system]?.latest ?? 0) + 1
  while (await env.REGISTRY.head(keys.release(system, version))) version++
  return version
}
