// POST /publish/stock: Stock, published by GitHub Actions on pushes to main.
//
// There's no stored key. The run proves itself with a GitHub OIDC token,
// which the Worker checks against GitHub's published keys and then requires:
// this repository (by numeric id), refs/heads/main, a push event and the
// publish-stock workflow on main. Each token works once.
//
// Stock's release isn't signed by an admin key. It records the commit it was
// built from, so consumers can check every file against the public repo.
import type { Env } from "./env.ts"
import { fail, json, parseJson, readBody } from "./http.ts"
import { Conflict, writeVersion } from "./publish.ts"
import { LIMITS, manifestPayload, RELEASE_FORMAT, sha256Hex, type Manifest, type StockBody } from "./shared/protocol.ts"
import { checkBundle } from "./shared/validate.ts"
import { createOnly, keys, nextVersion, readState } from "./store.ts"

export const OIDC_ISSUER = "https://token.actions.githubusercontent.com"
const WORKFLOW = ".github/workflows/publish-stock.yml"

type Claims = {
  iss: string
  aud: string | string[]
  exp: number
  nbf?: number
  iat: number
  jti: string
  sha: string
  ref: string
  event_name: string
  repository: string
  repository_id: string
  job_workflow_ref: string
  run_id: string
}

const decodePart = (part: string) =>
  JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))))

/** GitHub's OIDC signing keys, cached for an hour. `fresh` skips the cache, for a key GitHub just rotated in. */
async function githubKeys(fresh = false): Promise<JsonWebKey[]> {
  const cache = await caches.open("oidc")
  const url = `${OIDC_ISSUER}/.well-known/jwks`
  const cached = fresh ? undefined : await cache.match(url)
  if (cached) return ((await cached.json()) as { keys: JsonWebKey[] }).keys
  const response = await fetch(url)
  if (!response.ok) throw new Error("Couldn't fetch GitHub's OIDC keys.")
  const body = (await response.json()) as { keys: JsonWebKey[] }
  await cache.put(url, new Response(JSON.stringify(body), { headers: { "cache-control": "max-age=3600" } }))
  return body.keys
}

/** Verifies a GitHub Actions OIDC token and returns its claims, or a reason it's refused. */
export async function verifyOidc(token: string, env: Env): Promise<Claims | string> {
  const parts = token.split(".")
  if (parts.length !== 3) return "not a JWT"
  let header: { alg?: string; kid?: string }
  let claims: Claims
  try {
    header = decodePart(parts[0])
    claims = decodePart(parts[1])
  } catch {
    return "not a JWT"
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return "unexpected algorithm"
  const byKid = (list: JsonWebKey[]) => list.find((k) => (k as { kid?: string }).kid === header.kid)
  const jwk = byKid(await githubKeys()) ?? byKid(await githubKeys(true))
  if (!jwk) return "unknown signing key"
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"])
  const signature = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed))) return "bad signature"

  const now = Date.now() / 1000
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== OIDC_ISSUER) return "wrong issuer"
  if (!audiences.includes(env.OIDC_AUDIENCE)) return "wrong audience"
  if (typeof claims.exp !== "number" || claims.exp < now) return "expired"
  if (claims.nbf !== undefined && claims.nbf > now + 60) return "not yet valid"
  if (claims.repository_id !== env.GITHUB_REPOSITORY_ID) return "wrong repository"
  if (claims.ref !== "refs/heads/main") return "not main"
  // A push to main, or a run started by hand on main (which needs write access to the repo).
  if (claims.event_name !== "push" && claims.event_name !== "workflow_dispatch") return "not a push or a run on main"
  if (claims.job_workflow_ref !== `${env.GITHUB_REPOSITORY}/${WORKFLOW}@refs/heads/main`) return "wrong workflow"
  if (typeof claims.sha !== "string" || !/^[0-9a-f]{40}$/.test(claims.sha)) return "no commit"
  if (typeof claims.jti !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(claims.jti)) return "no token id"
  return claims
}

export async function publishStock(request: Request, env: Env, token: string): Promise<Response> {
  const claims = await verifyOidc(token, env)
  if (typeof claims === "string") return fail(403, `The GitHub OIDC token was refused: ${claims}.`)
  if (!(await createOnly(env, keys.nonce(`oidc-${claims.jti}`), claims.run_id, "text/plain"))) return fail(403, "This token was already used.")

  const raw = await readBody(request, LIMITS.bodyBytes)
  if (raw instanceof Response) return raw
  const body = parseJson<StockBody>(raw)
  if (!body?.files || typeof body.files !== "object") return fail(400, "files is missing.")

  const { state } = await readState(env)
  const check = checkBundle(body.files, state.allowlist)
  if (check.problems.length) return fail(422, "Stock has problems.", { problems: check.problems.slice(0, 50) })
  if (check.unknownPackages.length)
    return fail(422, "Stock installs packages that aren't on the allowlist. Allow them from the catalog first.", {
      unknownPackages: check.unknownPackages,
    })

  const items: Record<string, string> = {}
  for (const [path, content] of Object.entries(body.files)) items[path.slice(2)] = await sha256Hex(content)

  // Nothing changed since the current version: don't make a new one.
  const current = state.systems.stock
  if (current) {
    const object = await env.REGISTRY.get(keys.release("stock", current.current))
    const before = object ? (JSON.parse(((await object.json()) as { payload: string }).payload) as Manifest) : undefined
    if (before && JSON.stringify(before.items) === JSON.stringify(Object.fromEntries(Object.entries(items).sort(([a], [b]) => (a < b ? -1 : 1)))))
      return json({ system: "stock", unchanged: true, version: current.current })
  }

  const version = await nextVersion(env, "stock", state)
  const payload = manifestPayload({
    format: RELEASE_FORMAT,
    system: "stock",
    version,
    createdAt: new Date().toISOString(),
    commit: claims.sha,
    items,
    source: {},
  })
  try {
    const next = await writeVersion(env, {
      system: "stock",
      version,
      name: "Stock",
      release: {
        payload,
        signer: {
          kind: "github",
          repository: claims.repository,
          repositoryId: claims.repository_id,
          commit: claims.sha,
          workflow: claims.job_workflow_ref,
          runId: String(claims.run_id),
        },
      },
      files: body.files,
      create: { visibility: "public" },
      log: { by: `GitHub Actions run ${claims.run_id}`, commit: claims.sha },
    })
    return json({ system: "stock", ...next.systems.stock }, 201)
  } catch (error) {
    if (error instanceof Conflict) return fail(409, error.message)
    throw error
  }
}
