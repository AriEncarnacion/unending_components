import { env, reset } from "cloudflare:test"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { backUp, type Env } from "../src/index.ts"

const objects: Record<string, string> = {
  "r/jade/v/1/theme.json": '{"name":"theme"}',
  "r/jade/v/1/release.json": '{"payload":"{}"}',
  "src/jade/v/1/system.json": '{"id":"jade"}',
  "log/jade/00000001.json": '{"version":1}',
  "state/registry.json": '{"systems":{}}',
  "tokens/abc.json": "secret-ish",
}

beforeEach(async () => {
  await reset()
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    expect(url.hostname).toBe("acct.r2.cloudflarestorage.com")
    const key = decodeURIComponent(url.pathname.replace(/^\/unending-registry\/?/, ""))
    if (url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") ?? ""
      const contents = Object.keys(objects)
        .filter((k) => k.startsWith(prefix))
        .map((k) => `<Contents><Key>${k}</Key><ETag>&quot;etag-${k.length}&quot;</ETag></Contents>`)
        .join("")
      return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`)
    }
    return objects[key] === undefined ? new Response("", { status: 404 }) : new Response(objects[key])
  })
})
afterEach(() => vi.restoreAllMocks())

it("copies versions, logs and state, but never tokens, and only once", async () => {
  const e = env as unknown as Env
  expect(await backUp(e)).toBe(5)
  expect(await (await e.BACKUP.get("backup/r/jade/v/1/theme.json"))!.text()).toBe('{"name":"theme"}')
  expect(await e.BACKUP.head("backup/tokens/abc.json")).toBeNull()
  expect(await backUp(e)).toBe(0)
})
