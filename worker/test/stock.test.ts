import { reset } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "../src/env.ts"
import { base64url } from "../src/shared/protocol.ts"
import { call, makeKey, ORIGIN, sampleFiles, seedAllowlist, testEnv } from "./helpers.ts"

let e: Env
let signer: CryptoKeyPair
let jwk: JsonWebKey

const enc = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)))

async function oidcToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: "https://token.actions.githubusercontent.com",
    aud: "https://registry.unending.studio",
    exp: now + 300,
    iat: now,
    jti: `jti-${crypto.randomUUID()}`,
    sha: "a".repeat(40),
    ref: "refs/heads/main",
    event_name: "push",
    repository: "AriEncarnacion/unending_components",
    repository_id: e.GITHUB_REPOSITORY_ID,
    job_workflow_ref: "AriEncarnacion/unending_components/.github/workflows/publish-stock.yml@refs/heads/main",
    run_id: "1234",
    ...overrides,
  }
  const head = enc({ alg: "RS256", kid: "test-kid", typ: "JWT" })
  const body = enc(claims)
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signer.privateKey, new TextEncoder().encode(`${head}.${body}`))
  return `${head}.${body}.${base64url(signature)}`
}

function stockFiles() {
  return Object.fromEntries(Object.entries(sampleFiles()).filter(([path]) => path.startsWith("r/")))
}

const publish = async (token: string, files = stockFiles()) =>
  call(new Request(`${ORIGIN}/publish/stock`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ files }) }), e)

beforeEach(async () => {
  await reset()
  const key = await makeKey()
  e = testEnv({ ADMIN_KEYS: key.publicKey })
  await seedAllowlist(key, e)
  signer = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair
  jwk = { ...((await crypto.subtle.exportKey("jwk", signer.publicKey)) as JsonWebKey), kid: "test-kid" } as JsonWebKey
  await (await caches.open("oidc")).delete("https://token.actions.githubusercontent.com/.well-known/jwks")
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url === "https://token.actions.githubusercontent.com/.well-known/jwks") return Response.json({ keys: [jwk] })
    throw new Error(`unexpected fetch ${url}`)
  })
})
afterEach(() => vi.restoreAllMocks())

describe("publishing Stock", () => {
  it("publishes from main, publicly, recording the commit", async () => {
    const response = await publish(await oidcToken())
    expect(response.status, await response.clone().text()).toBe(201)
    expect(await response.json()).toMatchObject({ system: "stock", visibility: "public", current: 1 })
    const release = (await (await call(new Request(`${ORIGIN}/r/stock/release.json`), e)).json()) as { payload: string; signer: { kind: string; commit: string } }
    expect(release.signer).toMatchObject({ kind: "github", commit: "a".repeat(40) })
    expect(JSON.parse(release.payload).commit).toBe("a".repeat(40))
  })

  it("doesn't make a new version when nothing changed", async () => {
    await publish(await oidcToken())
    const again = await publish(await oidcToken())
    expect(await again.json()).toMatchObject({ unchanged: true, version: 1 })
  })

  it("refuses a branch, a pull request, another repo, another workflow or another audience", async () => {
    for (const claims of [
      { ref: "refs/heads/feature" },
      { event_name: "pull_request" },
      { event_name: "pull_request_target" },
      { event_name: "workflow_run" },
      { repository_id: "999" },
      { job_workflow_ref: "AriEncarnacion/unending_components/.github/workflows/ci.yml@refs/heads/main" },
      { job_workflow_ref: "AriEncarnacion/unending_components/.github/workflows/publish-stock.yml@refs/heads/feature" },
      { aud: "https://example.com" },
      { exp: Math.floor(Date.now() / 1000) - 10 },
      { iss: "https://evil.example" },
    ]) {
      expect((await publish(await oidcToken(claims))).status, JSON.stringify(claims)).toBe(403)
    }
  })

  it("refuses a token used twice, and a forged one", async () => {
    const token = await oidcToken()
    expect((await publish(token)).status).toBe(201)
    expect((await publish(token)).status).toBe(403)
    const [head, body] = (await oidcToken()).split(".")
    expect((await publish(`${head}.${body}.${base64url(new Uint8Array(256))}`)).status).toBe(403)
  })

  it("refuses source files and unknown packages", async () => {
    expect((await publish(await oidcToken(), sampleFiles())).status).toBe(422)
  })
})
