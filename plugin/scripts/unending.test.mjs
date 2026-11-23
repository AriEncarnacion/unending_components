// Tests the plugin's verified fetch against a fake registry.
// Run: node --test plugin/scripts/unending.test.mjs
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash, webcrypto } from "node:crypto"
import { mkdtempSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const run = promisify(execFile)
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "unending.mjs")
const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex")
const b64url = (buf) => Buffer.from(buf).toString("base64url")

async function keyPair() {
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
  const publicKey = b64url(await webcrypto.subtle.exportKey("raw", pair.publicKey))
  const keyId = sha(Buffer.from(publicKey, "base64url")).slice(0, 16)
  return { keyId, publicKey, sign: async (m) => b64url(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, Buffer.from(m))) }
}

const items = {
  "theme.json": JSON.stringify({ name: "theme", type: "registry:theme", cssVars: { light: { background: "oklch(1 0 0)" } } }),
  "page-nav.json": JSON.stringify({
    name: "page-nav",
    type: "registry:component",
    dependencies: ["lucide-react"],
    registryDependencies: ["sidebar", "@unending/theme"],
    files: [{ path: "page-nav.tsx", type: "registry:component", content: "export function PageNav() { return null }" }],
  }),
}

let server, base, dir, trusted, stranger
let served = {}

async function release(key, overrides = {}) {
  const payload = JSON.stringify({
    format: "unending-release-1",
    system: "jade",
    version: 2,
    createdAt: new Date().toISOString(),
    items: Object.fromEntries(Object.entries(items).map(([f, t]) => [f, sha(t)])),
    source: {},
    ...overrides,
  })
  return JSON.stringify({ payload, signer: { kind: "admin", keyId: key.keyId, signature: await key.sign(`unending-release-v1\n${payload}`) } })
}

before(async () => {
  trusted = await keyPair()
  stranger = await keyPair()
  dir = mkdtempSync(path.join(tmpdir(), "unending-plugin-test-"))
  writeFileSync(path.join(dir, "keys.json"), JSON.stringify({ repository: "x/y", repositoryId: "1", keys: [{ keyId: trusted.keyId, publicKey: trusted.publicKey, addedAt: "2026-01-01T00:00:00Z" }] }))
  server = createServer((req, res) => {
    const body = served[req.url]
    res.writeHead(body === undefined ? 404 : 200, { "content-type": "application/json" })
    res.end(body ?? "{}")
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

function serve(releaseText, files = items) {
  served = { "/r/jade/release.json": releaseText }
  for (const [file, text] of Object.entries(files)) served[`/r/jade/v/2/${file}`] = text
}

const fetchItems = () =>
  run("node", [script, "fetch", "jade", "page-nav", "--registry", base, "--dotenv", path.join(dir, "none.env")], {
    env: { ...process.env, UNENDING_PLUGIN_KEYS: path.join(dir, "keys.json"), UNENDING_REGISTRY_TOKEN: "" },
  })

test("fetches a release signed by a pinned key, with the @unending items it needs", async () => {
  serve(await release(trusted))
  const { stdout } = await fetchItems()
  const result = JSON.parse(stdout)
  assert.equal(result.version, 2)
  assert.deepEqual(result.files.map((f) => path.basename(f)), ["theme.json", "page-nav.json"])
  assert.deepEqual(result.packages, ["lucide-react"])
})

test("refuses a file that doesn't match its release", async () => {
  serve(await release(trusted), { ...items, "page-nav.json": items["page-nav.json"].replace("return null", "fetch('https://evil.example'); return null") })
  await assert.rejects(fetchItems(), /doesn't match its release/)
})

test("refuses a release signed by a key it doesn't pin", async () => {
  serve(await release(stranger))
  await assert.rejects(fetchItems(), /doesn't trust/)
})

test("refuses a forged signature", async () => {
  const text = JSON.parse(await release(trusted))
  text.payload = text.payload.replace('"version":2', '"version":2 ')
  serve(JSON.stringify(text))
  await assert.rejects(fetchItems(), /signature is invalid/)
})

test("refuses a release for another system", async () => {
  serve(await release(trusted, { system: "other" }))
  await assert.rejects(fetchItems(), /for something else/)
})

test("refuses a retired key, unless it pinned that release", async () => {
  const text = await release(trusted)
  const keys = { repository: "x/y", repositoryId: "1", keys: [{ keyId: trusted.keyId, publicKey: trusted.publicKey, addedAt: "2026-01-01T00:00:00Z", retiredAt: "2026-06-01T00:00:00Z" }] }
  writeFileSync(path.join(dir, "keys.json"), JSON.stringify(keys))
  serve(text)
  await assert.rejects(fetchItems(), /doesn't trust/)
  keys.keys[0].releases = [sha(JSON.parse(text).payload)]
  writeFileSync(path.join(dir, "keys.json"), JSON.stringify(keys))
  await fetchItems()
})
