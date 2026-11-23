import { reset } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "../src/env.ts"
import { keys, updateState } from "../src/store.ts"
import { issueToken } from "../src/tokens.ts"
import { ACME_ID, call, makeKey, ORIGIN, seedAllowlist, ship, signed, testEnv, type TestKey } from "./helpers.ts"

let key: TestKey
let e: Env

/** Fakes GitHub: a user (id 42) who is an active member of acme only, with a read:org token. */
function fakeGitHub({ member = true, scopes = "read:org", pending = 0, orgId = ACME_ID, limited = false } = {}) {
  let polls = 0
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url === "https://github.com/login/device/code")
      return Response.json({ device_code: "device-code-123", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", interval: 5, expires_in: 900 })
    if (url === "https://github.com/login/oauth/access_token")
      return Response.json(polls++ < pending ? { error: "authorization_pending", interval: 5 } : { access_token: "gho_fake", token_type: "bearer", scope: scopes })
    if (url === "https://api.github.com/user") return Response.json({ id: 42, login: "someone" }, { headers: { "x-oauth-scopes": scopes } })
    if (url === "https://api.github.com/user/memberships/orgs/acme") {
      if (limited) return new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } })
      return member ? Response.json({ state: "active", role: "member", organization: { id: orgId, login: "acme" } }) : new Response("{}", { status: 404 })
    }
    if (url.startsWith("https://api.github.com/user/memberships/orgs/")) return new Response("{}", { status: 404 })
    throw new Error(`unexpected fetch ${url}`)
  })
}

beforeEach(async () => {
  await reset()
  // Membership answers are cached per token hash, and every test makes fresh tokens.
  key = await makeKey()
  e = testEnv({ ADMIN_KEYS: key.publicKey })
  await seedAllowlist(key, e)
})
afterEach(() => vi.restoreAllMocks())

describe("reading", () => {
  it("serves a public system to anyone, pinned versions too", async () => {
    await ship(key, e, 1)
    await updateState(e, (s) => ((s.systems.jade.visibility = "public"), s))
    const current = await call(new Request(`${ORIGIN}/r/jade/theme.json`), e)
    expect(current.status).toBe(200)
    expect(current.headers.get("cache-control")).toBe("public, max-age=60")
    expect(((await current.json()) as { name: string }).name).toBe("theme")
    const pinned = await call(new Request(`${ORIGIN}/r/jade/v/1/theme.json`), e)
    expect(pinned.headers.get("cache-control")).toContain("immutable")
    expect((await call(new Request(`${ORIGIN}/r/jade/release.json`), e)).status).toBe(200)
    expect((await call(new Request(`${ORIGIN}/r/jade/v/2/theme.json`), e)).status).toBe(404)
    const listed = (await (await call(new Request(`${ORIGIN}/systems.json`), e)).json()) as { systems: { id: string }[] }
    expect(listed.systems.map((s) => s.id)).toEqual(["jade"])
  })

  it("serves the version the pointer names after a rollback", async () => {
    await ship(key, e, 1)
    await ship(key, e, 2)
    await updateState(e, (s) => ((s.systems.jade.visibility = "public"), s))
    await call(await signed(key, "POST", "/admin/systems/jade/current", { version: 1 }), e)
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`), e)).headers.get("x-unending-version")).toBe("1")
  })

  it("serves a private system to an active member's token, never cached", async () => {
    fakeGitHub()
    await ship(key, e, 1)
    const { token } = await issueToken(e, { userId: 42, org: "acme", orgId: ACME_ID }, "gho_fake")
    const response = await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    const listed = (await (await call(new Request(`${ORIGIN}/systems.json`, { headers: { authorization: `Bearer ${token}` } }), e)).json()) as {
      systems: { id: string }[]
    }
    expect(listed.systems.map((s) => s.id)).toEqual(["jade"])
  })

  it("refuses a token whose holder left the org", async () => {
    fakeGitHub({ member: false })
    await ship(key, e, 1)
    const { token } = await issueToken(e, { userId: 42, org: "acme", orgId: ACME_ID }, "gho_fake")
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(403)
  })

  it("refuses a token for another org", async () => {
    fakeGitHub()
    await ship(key, e, 1)
    const { token } = await issueToken(e, { userId: 42, org: "other", orgId: 999 }, "gho_fake")
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(403)
  })

  it("still lists public systems when the token is refused", async () => {
    await ship(key, e, 1)
    await updateState(e, (s) => ((s.systems.jade.visibility = "public"), s))
    const unknown = `unr_${"A".repeat(43)}`
    const response = await call(new Request(`${ORIGIN}/systems.json`, { headers: { authorization: `Bearer ${unknown}` } }), e)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { systems: { id: string }[]; tokenRefused?: string }
    expect(body.systems.map((s) => s.id)).toEqual(["jade"])
    expect(body.tokenRefused).toBeTruthy()
  })

  it("refuses an expired or unknown token", async () => {
    fakeGitHub()
    await ship(key, e, 1)
    const { token } = await issueToken(e, { userId: 42, org: "acme", orgId: ACME_ID }, "gho_fake")
    const stored = await e.REGISTRY.get(keys.token(await sha(token)))
    const record = (await stored!.json()) as Record<string, string>
    await e.REGISTRY.put(keys.token(await sha(token)), JSON.stringify({ ...record, expiresAt: new Date(Date.now() - 1000).toISOString() }))
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(401)
    const unknown = `unr_${"A".repeat(43)}`
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${unknown}` } }), e)).status).toBe(401)
  })

  it("refuses a token once the org's login belongs to a different org", async () => {
    // The org was renamed and someone else registered its old name: same login, new id.
    fakeGitHub({ orgId: 777 })
    await ship(key, e, 1)
    const { token } = await issueToken(e, { userId: 42, org: "acme", orgId: ACME_ID }, "gho_fake")
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(403)
  })

  it("fails closed on a GitHub rate limit, without caching a wrong no", async () => {
    const limited = fakeGitHub({ limited: true })
    await ship(key, e, 1)
    const { token } = await issueToken(e, { userId: 42, org: "acme", orgId: ACME_ID }, "gho_fake")
    const read = () => call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)
    expect((await read()).status).toBe(403)
    limited.mockRestore()
    fakeGitHub()
    expect((await read()).status).toBe(200)
  })

  it("fails closed when GitHub can't answer", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 502 }))
    await ship(key, e, 1)
    const { token } = await issueToken(e, { userId: 42, org: "acme", orgId: ACME_ID }, "gho_fake")
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(403)
  })

  it("keeps a token's plaintext and the GitHub token out of storage", async () => {
    fakeGitHub()
    const { token } = await issueToken(e, { userId: 42, org: "acme", orgId: ACME_ID }, "gho_fake")
    const listing = await testEnv().REGISTRY.list({ prefix: "tokens/" })
    const stored = await (await testEnv().REGISTRY.get(listing.objects[0].key))!.text()
    expect(stored).not.toContain(token)
    expect(stored).not.toContain("gho_fake")
  })
})

describe("login", () => {
  it("issues a token to an active member, after approval", async () => {
    fakeGitHub({ pending: 1 })
    await ship(key, e, 1)
    const device = await call(new Request(`${ORIGIN}/login/device`, { method: "POST" }), e)
    expect(await device.json()).toMatchObject({ user_code: "ABCD-1234", device_code: "device-code-123" })
    const poll = () => call(new Request(`${ORIGIN}/login/token`, { method: "POST", body: JSON.stringify({ device_code: "device-code-123", org: "ACME" }) }), e)
    expect((await poll()).status).toBe(202)
    const done = await poll()
    expect(done.status).toBe(200)
    const { token } = (await done.json()) as { token: string }
    expect(token).toMatch(/^unr_/)
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(200)
    expect((await call(new Request(`${ORIGIN}/login/revoke`, { method: "POST", headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(200)
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(401)
  })

  it("won't issue a token for an org that took the old org's login", async () => {
    fakeGitHub({ orgId: 777 })
    await ship(key, e, 1)
    const response = await call(new Request(`${ORIGIN}/login/token`, { method: "POST", body: JSON.stringify({ device_code: "device-code-123", org: "acme" }) }), e)
    expect(response.status).toBe(403)
  })

  it("won't issue a token to a non-member", async () => {
    fakeGitHub({ member: false })
    await ship(key, e, 1)
    const response = await call(new Request(`${ORIGIN}/login/token`, { method: "POST", body: JSON.stringify({ device_code: "device-code-123", org: "acme" }) }), e)
    expect(response.status).toBe(403)
  })

  it("won't keep a GitHub token with more than read:org", async () => {
    fakeGitHub({ scopes: "read:org, repo" })
    await ship(key, e, 1)
    const response = await call(new Request(`${ORIGIN}/login/token`, { method: "POST", body: JSON.stringify({ device_code: "device-code-123", org: "acme" }) }), e)
    expect(response.status).toBe(400)
  })

  it("won't issue tokens for an org with no private systems", async () => {
    fakeGitHub()
    const response = await call(new Request(`${ORIGIN}/login/token`, { method: "POST", body: JSON.stringify({ device_code: "device-code-123", org: "acme" }) }), e)
    expect(response.status).toBe(404)
  })

  it("revokes tokens by org with a signed call", async () => {
    fakeGitHub()
    await ship(key, e, 1)
    const { token } = await issueToken(e, { userId: 42, org: "acme", orgId: ACME_ID }, "gho_fake")
    const revoked = await call(await signed(key, "POST", "/admin/tokens/revoke", { org: "acme" }), e)
    expect(await revoked.json()).toMatchObject({ revoked: 1 })
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`, { headers: { authorization: `Bearer ${token}` } }), e)).status).toBe(401)
  })
})

async function sha(text: string) {
  const { sha256Hex } = await import("../src/shared/protocol.ts")
  return sha256Hex(text)
}
