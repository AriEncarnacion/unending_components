// Registry tokens (unr_…) and the org membership behind them.
//
// A token is 32 random bytes. The Worker stores only its SHA-256, with the
// numeric GitHub user id, the org and the expiry, plus the read:org token
// encrypted with TOKEN_ENC_KEY for the daily membership check. Membership
// answers live in the Cache API for a day, never in R2 or KV, so serving a
// private file writes nothing.
import type { Env } from "./env.ts"
import { base64url, fromBase64url, sha256Hex } from "./shared/protocol.ts"
import { keys } from "./store.ts"

export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const tokenPattern = /^unr_[A-Za-z0-9_-]{43}$/

/** `org` is the login the holder logged in with; `orgId` is what access is checked against. */
export type TokenRecord = { userId: number; org: string; orgId: number; createdAt: string; expiresAt: string; gh: string }

export const GITHUB_API = "https://api.github.com"
const githubHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "unending-registry",
})

async function encryptionKey(env: Env) {
  const raw = Uint8Array.from(atob(env.TOKEN_ENC_KEY ?? ""), (c) => c.charCodeAt(0))
  if (raw.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes, base64.")
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"])
}

export async function seal(env: Env, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), new TextEncoder().encode(text))
  return `${base64url(iv)}.${base64url(sealed)}`
}

export async function unseal(env: Env, value: string) {
  const [iv, data] = value.split(".")
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64url(iv) as Uint8Array<ArrayBuffer> },
    await encryptionKey(env),
    fromBase64url(data) as Uint8Array<ArrayBuffer>
  )
  return new TextDecoder().decode(plain)
}

export async function issueToken(env: Env, record: Omit<TokenRecord, "createdAt" | "expiresAt" | "gh">, githubToken: string) {
  const token = `unr_${base64url(crypto.getRandomValues(new Uint8Array(32)))}`
  const now = Date.now()
  const stored: TokenRecord = {
    ...record,
    org: record.org.toLowerCase(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
    gh: await seal(env, githubToken),
  }
  await env.REGISTRY.put(keys.token(await sha256Hex(token)), JSON.stringify(stored), {
    customMetadata: { userId: String(record.userId), org: stored.org },
  })
  return { token, expiresAt: stored.expiresAt }
}

export async function lookupToken(env: Env, token: string): Promise<{ hash: string; record: TokenRecord } | undefined> {
  if (!tokenPattern.test(token)) return undefined
  const hash = await sha256Hex(token)
  const object = await env.REGISTRY.get(keys.token(hash))
  if (!object) return undefined
  const record = (await object.json()) as TokenRecord
  if (Date.parse(record.expiresAt) <= Date.now()) return undefined
  return { hash, record }
}

export async function revokeToken(env: Env, token: string) {
  if (!tokenPattern.test(token)) return false
  const key = keys.token(await sha256Hex(token))
  if (!(await env.REGISTRY.head(key))) return false
  await env.REGISTRY.delete(key)
  return true
}

/**
 * Asks GitHub whether a user is an active member of an org, and returns the
 * org's numeric id when they are. Throws if GitHub can't answer, including a
 * rate limit, so callers fail closed without caching a wrong "no".
 */
export async function checkMembership(githubToken: string, org: string): Promise<{ active: boolean; orgId?: number }> {
  const response = await fetch(`${GITHUB_API}/user/memberships/orgs/${encodeURIComponent(org)}`, {
    headers: githubHeaders(githubToken),
    redirect: "manual",
  })
  const limited = response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")
  if ((response.status === 403 || response.status === 429) && limited) throw new Error("GitHub rate limit")
  if (response.status === 404 || response.status === 403 || response.status === 401) return { active: false }
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  const body = (await response.json()) as { state?: string; organization?: { id?: number } }
  const orgId = body.organization?.id
  return body.state === "active" && Number.isSafeInteger(orgId) ? { active: true, orgId } : { active: false }
}

export async function githubUser(githubToken: string) {
  const response = await fetch(`${GITHUB_API}/user`, { headers: githubHeaders(githubToken) })
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  return { id: Number(((await response.json()) as { id: number }).id), scopes: response.headers.get("x-oauth-scopes") ?? "" }
}

const DAY = 24 * 60 * 60
const membershipCacheKey = (hash: string, orgId: number) => `https://membership.unending.internal/${hash}/${orgId}`

/**
 * Whether a token's holder is still an active member of its org: from the
 * cache for up to a day, then GitHub. Fails closed when GitHub can't answer.
 */
export async function stillMember(env: Env, hash: string, record: TokenRecord): Promise<boolean> {
  const cache = await caches.open("membership")
  if (!Number.isSafeInteger(record.orgId)) return false
  const key = membershipCacheKey(hash, record.orgId)
  const cached = await cache.match(key)
  if (cached) return ((await cached.json()) as { active: boolean }).active
  let active: boolean
  try {
    // Still a member of the same org: a reclaimed login has a different id.
    const answer = await checkMembership(await unseal(env, record.gh), record.org)
    active = answer.active && answer.orgId === record.orgId
  } catch {
    return false
  }
  await cache.put(
    key,
    new Response(JSON.stringify({ active }), {
      headers: { "content-type": "application/json", "cache-control": `max-age=${active ? DAY : 600}` },
    })
  )
  return active
}
