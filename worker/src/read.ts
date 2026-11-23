// Read routes. One URL shape for every system; the Worker looks up who may
// read it before anything else, so a private system is never served from a
// cache or to the wrong person.
//
//   GET /r/<system>/<item>.json              from the current version
//   GET /r/<system>/registry.json            the catalog (shadcn search, MCP)
//   GET /r/<system>/release.json             the current release manifest
//   GET /r/<system>/v/<n>/<item>.json        a pinned version (never changes)
//   GET /systems.json                        public systems, plus the caller's private ones
//
// src/ is never readable here: every key this builds starts with r/.
import type { Env } from "./env.ts"
import { bearer, fail, githubTokenPattern, json, raw } from "./http.ts"
import { namePattern } from "./shared/protocol.ts"
import { keys, readState, type SystemState } from "./store.ts"
import { lookupToken, stillMember } from "./tokens.ts"

type Reader = { org: string } | null

/** Who's asking: an org member with a valid registry token, or nobody in particular. */
async function reader(request: Request, env: Env): Promise<Reader | Response> {
  const token = bearer(request)
  if (!token) return null
  const found = await lookupToken(env, token)
  if (!found) return fail(401, "The registry token is invalid or expired. Run /unending:login.")
  if (!(await stillMember(env, found.hash, found.record))) return fail(403, "That token's holder isn't an active member of its org.")
  return { org: found.record.org }
}

function allowed(system: SystemState, who: Reader) {
  return system.visibility === "public" || (who !== null && system.org === who.org)
}

export async function handleRead(request: Request, env: Env, path: string[]): Promise<Response> {
  const [system, ...rest] = path
  if (!system || !namePattern.test(system)) return fail(404, "Not found.")

  const { state } = await readState(env)
  const entry = state.systems[system]
  // Private systems without a token look the same as missing ones.
  const token = bearer(request)
  if (!entry || (entry.visibility === "private" && !token)) return fail(entry ? 401 : 404, entry ? "This system needs a registry token." : "Not found.", {})
  const who = entry.visibility === "private" ? await reader(request, env) : null
  if (who instanceof Response) return who
  if (!allowed(entry, who)) return fail(403, "Your registry token can't read this system.")

  let version = entry.current
  let file: string | undefined
  if (rest.length === 1) file = rest[0]
  else if (rest.length === 3 && rest[0] === "v" && /^[1-9]\d{0,8}$/.test(rest[1])) {
    version = Number(rest[1])
    if (version > entry.latest) return fail(404, "Not found.")
    file = rest[2]
  }
  if (!file?.endsWith(".json")) return fail(404, "Not found.")
  const name = file.slice(0, -".json".length)
  if (!namePattern.test(name)) return fail(404, "Not found.")

  const key = name === "release" ? keys.release(system, version) : keys.item(system, version, name)
  const pinned = rest.length === 3
  const cacheable = entry.visibility === "public"
  const cacheKey = new Request(`https://cache.unending.internal/${key}`)
  const cache = caches.default
  if (cacheable) {
    const hit = await cache.match(cacheKey)
    if (hit) return raw(hit.body!, pinned ? "pinned" : "current", { "x-unending-version": String(version) })
  }
  const object = await env.REGISTRY.get(key)
  if (!object) return fail(404, "Not found.")
  const text = await object.text()
  // Only public, write-once objects go in the edge cache.
  if (cacheable) await cache.put(cacheKey, new Response(text, { headers: { "cache-control": "public, max-age=31536000, immutable" } }))
  return raw(text, cacheable ? (pinned ? "pinned" : "current") : "none", { "x-unending-version": String(version) })
}

export async function handleSystems(request: Request, env: Env): Promise<Response> {
  const token = bearer(request)
  if (token && githubTokenPattern.test(token)) return fail(401, "The registry never takes a GitHub token.")
  const who = await reader(request, env)
  if (who instanceof Response) return who
  const { state } = await readState(env)
  const origin = new URL(request.url).origin
  const systems = Object.entries(state.systems)
    .filter(([, s]) => allowed(s, who))
    .map(([id, s]) => ({
      id,
      name: s.name,
      visibility: s.visibility,
      version: s.current,
      url: `${origin}/r/${id}/{name}.json`,
    }))
  return json({ systems })
}
