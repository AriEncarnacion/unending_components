import { reset } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import { RELEASE_FORMAT, manifestPayload, releaseMessage, sha256Hex } from "../src/shared/protocol.ts"
import type { Env } from "../src/env.ts"
import { call, makeKey, ORIGIN, sampleFiles, sampleItems, seedAllowlist, ship, shipBody, shipRequest, signed, testEnv, type TestKey } from "./helpers.ts"

let key: TestKey
let e: Env

beforeEach(async () => {
  await reset()
  key = await makeKey()
  e = testEnv({ ADMIN_KEYS: key.publicKey })
  await seedAllowlist(key, e)
})

describe("admin requests", () => {
  it("refuses an unsigned request", async () => {
    const response = await call(new Request(`${ORIGIN}/admin/systems`), e)
    expect(response.status).toBe(401)
  })

  it("refuses a key that isn't enrolled", async () => {
    const stranger = await makeKey()
    expect((await call(await signed(stranger, "GET", "/admin/systems"), e)).status).toBe(401)
  })

  it("refuses a stale request", async () => {
    const old = Math.floor(Date.now() / 1000) - 120
    expect((await call(await signed(key, "GET", "/admin/systems", undefined, { time: old }), e)).status).toBe(401)
  })

  it("refuses a replayed request", async () => {
    const first = await signed(key, "GET", "/admin/systems")
    const again = first.clone()
    expect((await call(first, e)).status).toBe(200)
    expect((await call(again, e)).status).toBe(401)
  })

  it("refuses a request whose body changed after signing", async () => {
    const request = await signed(key, "POST", "/admin/allowlist", { add: ["react"] })
    const tampered = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ add: ["evil"] }) })
    expect((await call(tampered, e)).status).toBe(401)
  })

  it("refuses a signature made for another path", async () => {
    const request = await signed(key, "GET", "/admin/allowlist")
    const moved = new Request(`${ORIGIN}/admin/systems`, { headers: request.headers })
    expect((await call(moved, e)).status).toBe(401)
  })

  it("refuses a GitHub token on any route", async () => {
    for (const path of ["/admin/systems", "/r/jade/theme.json", "/systems.json", "/login/device", "/publish/stock"]) {
      const response = await call(new Request(`${ORIGIN}${path}`, { headers: { authorization: "Bearer ghp_abcdefghijklmnopqrstuvwxyz0123456789" } }), e)
      expect(response.status, path).toBe(401)
    }
  })
})

describe("shipping", () => {
  it("ships a first version, private to an org, and serves it only with a token", async () => {
    const response = await ship(key, e, 1)
    expect(response.status, await response.clone().text()).toBe(201)
    expect(await response.json()).toMatchObject({ system: "jade", current: 1, latest: 1, visibility: "private", org: "acme", orgId: 1234 })
    expect((await call(new Request(`${ORIGIN}/r/jade/theme.json`), e)).status).toBe(401)
    const listed = (await (await call(new Request(`${ORIGIN}/systems.json`), e)).json()) as { systems: unknown[] }
    expect(listed.systems).toEqual([])
  })

  it("needs an org and its id on a first ship", async () => {
    expect((await call(await shipRequest(key, await shipBody(key, 1)), e)).status).toBe(400)
    expect((await call(await shipRequest(key, await shipBody(key, 1, sampleFiles(), { org: "acme" })), e)).status).toBe(400)
  })

  it("refuses a reserved id", async () => {
    const shipment = await shipBody(key, 1, sampleFiles(sampleItems(), "stock"), { org: "acme", orgId: 1234 }, "stock")
    expect((await call(await shipRequest(key, shipment, "stock"), e)).status).toBe(400)
  })

  it("assigns versions in order and refuses an existing one with 409", async () => {
    expect((await ship(key, e, 1)).status).toBe(201)
    const again = await ship(key, e, 1, { org: undefined })
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ expectedVersion: 2 })
    expect((await ship(key, e, 3)).status).toBe(409)
    expect((await ship(key, e, 2)).status).toBe(201)
  })

  it("refuses a file that doesn't match the release", async () => {
    const shipment = await shipBody(key, 1, sampleFiles(), { org: "acme", orgId: 1234 })
    shipment.body.files["r/theme.json"] = shipment.body.files["r/theme.json"].replace("Test theme", "Other theme")
    expect((await call(await shipRequest(key, shipment), e)).status).toBe(400)
  })

  it("refuses a release signed by a different key", async () => {
    const other = await makeKey()
    const both = testEnv({ ADMIN_KEYS: `${key.publicKey},${other.publicKey}` })
    const shipment = await shipBody(other, 1, sampleFiles(), { org: "acme", orgId: 1234 })
    expect((await call(await shipRequest(key, shipment), both)).status).toBe(400)
  })

  it("refuses a ship without its release signature, or with a wrong one", async () => {
    const shipment = await shipBody(key, 1, sampleFiles(), { org: "acme", orgId: 1234 })
    expect((await call(await signed(key, "POST", "/admin/systems/jade/versions", shipment.body), e)).status).toBe(400)
    const forged = { ...shipment, releaseSignature: await key.sign("something else") }
    expect((await call(await shipRequest(key, forged), e)).status).toBe(400)
  })

  it("refuses a release for another system", async () => {
    const files = sampleFiles()
    const items: Record<string, string> = {}
    const source: Record<string, string> = {}
    for (const [path, content] of Object.entries(files))
      (path.startsWith("r/") ? items : source)[path.replace(/^(r|src)\//, "")] = await sha256Hex(content)
    const payload = manifestPayload({ format: RELEASE_FORMAT, system: "other", version: 1, createdAt: new Date().toISOString(), items, source })
    const body = { version: 1, name: "Jade", org: "acme", orgId: 1234, files, release: { payload, keyId: key.keyId } }
    const shipment = { body, releaseSignature: await key.sign(releaseMessage(payload)) }
    expect((await call(await shipRequest(key, shipment), e)).status).toBe(400)
  })

  it("refuses an unknown dependency until it's allowed", async () => {
    const items = sampleItems()
    items["page-nav"].dependencies = ["lucide-react", "left-pad@^1.3.0"]
    const refused = await ship(key, e, 1, {}, sampleFiles(items))
    expect(refused.status).toBe(422)
    expect(await refused.json()).toMatchObject({ unknownPackages: ["left-pad"] })
    const allowed = await ship(key, e, 1, { allow: ["left-pad"] }, sampleFiles(items))
    expect(allowed.status).toBe(201)
    const list = await call(await signed(key, "GET", "/admin/allowlist"), e)
    expect(((await list.json()) as { allowlist: string[] }).allowlist).toContain("left-pad")
  })

  it("refuses CSS that breaks out of its rule", async () => {
    for (const value of ["red; } body { display: none", "oklch(1 0 0) }", "url(https://evil.example/x)", "expression(alert(1))"]) {
      const items = sampleItems()
      ;(items.theme.cssVars as Record<string, Record<string, string>>).light.background = value
      const response = await ship(key, e, 1, {}, sampleFiles(items))
      expect(response.status, value).toBe(422)
    }
    const items = sampleItems()
    items.theme.css = { "@layer base": { ":root } body {": { "--x": "1px" } } }
    expect((await ship(key, e, 1, {}, sampleFiles(items))).status).toBe(422)
  })

  it("refuses files outside the allowed targets", async () => {
    for (const target of ["~/.github/workflows/x.yml", "~/package.json", "~/components/../../.env", "/etc/passwd", "~/app/page.tsx"]) {
      const items = sampleItems()
      items["design-rules"].files = [{ path: "docs/design-system.md", type: "registry:file", target, content: "x" }]
      expect((await ship(key, e, 1, {}, sampleFiles(items))).status, target).toBe(422)
    }
  })

  it("refuses env vars, other registries and unknown item fields", async () => {
    const cases: [string, (items: ReturnType<typeof sampleItems>) => void][] = [
      ["envVars", (items) => (items["page-nav"].envVars = { SECRET: "x" })],
      ["url dependency", (items) => (items["page-nav"].registryDependencies = ["https://evil.example/r/x.json"])],
      ["other namespace", (items) => (items["page-nav"].registryDependencies = ["@evil/thing"])],
      ["reserved item name", (items) => (items.release = { name: "release", type: "registry:lib", files: [] })],
    ]
    for (const [what, change] of cases) {
      const items = sampleItems()
      change(items)
      expect((await ship(key, e, 1, {}, sampleFiles(items))).status, what).toBe(422)
    }
  })

  it("rolls back and forward, and only to versions that exist", async () => {
    await ship(key, e, 1)
    await ship(key, e, 2)
    const back = await call(await signed(key, "POST", "/admin/systems/jade/current", { version: 1 }), e)
    expect(back.status).toBe(200)
    expect(await back.json()).toMatchObject({ current: 1, latest: 2 })
    expect((await call(await signed(key, "POST", "/admin/systems/jade/current", { version: 3 }), e)).status).toBe(400)
    // The next ship still goes past the newest version.
    expect(((await (await ship(key, e, 2)).json()) as { expectedVersion: number }).expectedVersion).toBe(3)
  })

  it("returns a version's source and release for Pull", async () => {
    await ship(key, e, 1)
    const response = await call(await signed(key, "GET", "/admin/systems/jade/source"), e)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { files: Record<string, string>; release: { payload: string } }
    expect(Object.keys(body.files).sort()).toEqual(["entries/page-nav.json", "system.json"])
    expect(JSON.parse(body.release.payload).version).toBe(1)
  })

  it("returns every system's current source in one call, for Pull", async () => {
    await ship(key, e, 1)
    const response = await call(await signed(key, "GET", "/admin/systems?source"), e)
    const body = (await response.json()) as { systems: { id: string; source: { version: number; files: Record<string, string> } }[] }
    expect(body.systems[0].source.version).toBe(1)
    expect(Object.keys(body.systems[0].source.files)).toContain("system.json")
  })

  it("never serves src/ through the read routes", async () => {
    await ship(key, e, 1)
    const object = await testEnv().REGISTRY.get("src/jade/v/1/system.json")
    expect(object).not.toBeNull()
    for (const path of ["/r/../src/jade/v/1/system.json", "/r/jade/v/1/..%2F..%2F..%2Fsrc%2Fjade%2Fv%2F1%2Fsystem.json", "/src/jade/v/1/system.json"])
      expect((await call(new Request(`${ORIGIN}${path}`), e)).status, path).not.toBe(200)
  })

  it("lists systems with their log", async () => {
    await ship(key, e, 1, { summary: "First" })
    const response = await call(await signed(key, "GET", "/admin/systems"), e)
    const body = (await response.json()) as { systems: { id: string; log: { summary?: string }[] }[] }
    expect(body.systems[0].id).toBe("jade")
    expect(body.systems[0].log[0].summary).toBe("First")
  })
})
