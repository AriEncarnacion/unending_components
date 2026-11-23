#!/usr/bin/env node
// The plugin's registry client: logs in to the Unending registry, and fetches
// items only after verifying who released them.
//
//   node unending.mjs login --org <org>          device-flow login; saves a read-only token to .env.local
//   node unending.mjs systems                    the systems you can read
//   node unending.mjs fetch <system> <item...>   verify the current release, download the items and
//                                                every @unending item they need, check each file's
//                                                hash, and print local paths for `shadcn add`
//
// Trust: a design system's release must be signed by a key pinned in
// ../keys.json. Stock's release must name a commit on the catalog repo's main
// branch, and every Stock file must match that commit's public/r/ exactly.
// Anything else is refused. Tokens are never printed.
//
// Options: --registry <url> (default https://registry.unending.studio, or
// UNENDING_REGISTRY_URL), --dotenv <path> (default .env.local).
import { createHash, webcrypto } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
// UNENDING_PLUGIN_KEYS points at another keys file; only the plugin's own tests set it.
const pinned = JSON.parse(readFileSync(process.env.UNENDING_PLUGIN_KEYS || path.join(here, "..", "keys.json"), "utf8"))
const RELEASE_CONTEXT = "unending-release-v1"
const RELEASE_FORMAT = "unending-release-1"
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(name)
  if (at === -1) return fallback
  const value = args[at + 1]
  args.splice(at, 2)
  return value
}
const registry = (flag("--registry", process.env.UNENDING_REGISTRY_URL) || "https://registry.unending.studio").replace(/\/+$/, "")
const envFile = path.resolve(flag("--dotenv", ".env.local"))
const org = flag("--org")
const [command, ...rest] = args

function die(message) {
  console.error(message)
  process.exit(1)
}

if (!/^https:\/\//.test(registry) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(registry)) die("The registry URL must be https.")

// ── Token ───────────────────────────────────────────────────────────────────

function readToken() {
  if (process.env.UNENDING_REGISTRY_TOKEN) return process.env.UNENDING_REGISTRY_TOKEN
  if (!existsSync(envFile)) return undefined
  const line = readFileSync(envFile, "utf8")
    .split("\n")
    .find((l) => l.startsWith("UNENDING_REGISTRY_TOKEN="))
  return line?.slice("UNENDING_REGISTRY_TOKEN=".length).trim() || undefined
}

function saveToken(token) {
  const lines = existsSync(envFile) ? readFileSync(envFile, "utf8").split("\n").filter((l) => !l.startsWith("UNENDING_REGISTRY_TOKEN=")) : []
  while (lines.length && lines[lines.length - 1] === "") lines.pop()
  lines.push(`UNENDING_REGISTRY_TOKEN=${token}`, "")
  writeFileSync(envFile, lines.join("\n"), { mode: 0o600 })
}

async function get(url, { auth = true } = {}) {
  const token = auth ? readToken() : undefined
  const response = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, redirect: "error" })
  return response
}

async function getJson(url) {
  const response = await get(url)
  if (response.status === 401) die(`The registry needs a valid token for ${url}. Run /unending:login.`)
  if (response.status === 403) die("Your registry token can't read that. Check you're still in the org, or run /unending:login again.")
  if (!response.ok) die(`The registry answered ${response.status} for ${url}.`)
  return { text: await response.text(), version: response.headers.get("x-unending-version") }
}

// ── Verification ────────────────────────────────────────────────────────────

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex")

function fromBase64url(text) {
  return Buffer.from(text.replace(/-/g, "+").replace(/_/g, "/"), "base64")
}

async function verifySignature(publicKey, signature, message) {
  try {
    const key = await webcrypto.subtle.importKey("raw", fromBase64url(publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"])
    return await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64url(signature), Buffer.from(message, "utf8"))
  } catch {
    return false
  }
}

/** Checks a release and returns its manifest, or exits. */
async function verifyRelease(system, release) {
  if (!release || typeof release.payload !== "string" || !release.signer) die("The release is malformed.")
  const manifest = JSON.parse(release.payload)
  if (manifest.format !== RELEASE_FORMAT || manifest.system !== system) die("The release is for something else.")
  if (!Number.isInteger(manifest.version) || manifest.version < 1) die("The release has a bad version.")
  const signer = release.signer
  if (signer.kind === "admin") {
    const payloadHash = sha256(release.payload)
    const key = (pinned.keys ?? []).find((k) => k.keyId === signer.keyId && (!k.retiredAt || (k.releases ?? []).includes(payloadHash)))
    if (!key) die(`The release was signed by key ${signer.keyId}, which this plugin doesn't trust. Update the plugin, or ask Ari.`)
    if (!(await verifySignature(key.publicKey, signer.signature, `${RELEASE_CONTEXT}\n${release.payload}`))) die("The release signature is invalid. Refusing it.")
    return manifest
  }
  if (signer.kind === "github" && system === "stock") {
    const workflow = `${pinned.repository}/.github/workflows/publish-stock.yml@refs/heads/main`
    if (signer.repositoryId !== pinned.repositoryId || signer.workflow !== workflow) die("Stock's release came from the wrong repository or workflow.")
    if (!/^[0-9a-f]{40}$/.test(signer.commit) || manifest.commit !== signer.commit) die("Stock's release names a bad commit.")
    // The commit must be on main, not a fork's commit GitHub would also serve.
    const compare = await fetch(`https://api.github.com/repos/${pinned.repository}/compare/${signer.commit}...main`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "unending-plugin" },
    })
    const status = compare.ok ? (await compare.json()).status : undefined
    if (status !== "ahead" && status !== "identical") die("Stock's release names a commit that isn't on the catalog's main branch.")
    return manifest
  }
  die("The release has an unknown signer.")
}

async function stockFileMatches(commit, file, text) {
  const response = await fetch(`https://raw.githubusercontent.com/${pinned.repository}/${commit}/public/r/${file}`)
  return response.ok && sha256(await response.text()) === sha256(text)
}

// ── Commands ────────────────────────────────────────────────────────────────

async function login() {
  if (!org || !/^[A-Za-z0-9-]{1,39}$/.test(org)) die("Usage: unending.mjs login --org <github-org>")
  const started = await fetch(`${registry}/login/device`, { method: "POST", redirect: "error" })
  if (!started.ok) die(`The registry couldn't start a login (${started.status}).`)
  const device = await started.json()
  console.log(`Open ${device.verification_uri} and enter the code ${device.user_code}`)
  console.log("Approve the Unending registry there. It asks for read:org only, to check you're in the org.")
  let interval = Math.max(5, Number(device.interval) || 5)
  const deadline = Date.now() + (Number(device.expires_in) || 900) * 1000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000))
    const response = await fetch(`${registry}/login/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_code: device.device_code, org }),
      redirect: "error",
    })
    const body = await response.json().catch(() => ({}))
    if (response.status === 202) {
      interval = Math.max(interval, Number(body.interval) || interval)
      continue
    }
    if (!response.ok) die(body.error ?? `The registry answered ${response.status}.`)
    saveToken(body.token)
    let ignored = true
    try {
      execFileSync("git", ["check-ignore", "-q", envFile], { stdio: "ignore" })
    } catch {
      ignored = false
    }
    console.log(`Saved a read-only token for ${body.org} to ${path.relative(process.cwd(), envFile)}, valid until ${body.expiresAt.slice(0, 10)}.`)
    if (!ignored) console.log(`WARNING: git doesn't ignore ${path.relative(process.cwd(), envFile)}. Add it to .gitignore before committing.`)
    return
  }
  die("The login code expired. Run it again.")
}

async function systems() {
  const { text } = await getJson(`${registry}/systems.json`)
  const body = JSON.parse(text)
  for (const s of body.systems) console.log(`${s.id}\t${s.visibility}\tv${s.version}\t${s.name}`)
  if (body.tokenRefused) console.log(`Private systems aren't listed: ${body.tokenRefused}`)
}

async function fetchItems() {
  const [system, ...wanted] = rest
  if (!system || !namePattern.test(system) || !wanted.length || !wanted.every((w) => namePattern.test(w)))
    die("Usage: unending.mjs fetch <system> <item...>")
  const release = JSON.parse((await getJson(`${registry}/r/${system}/release.json`)).text)
  const manifest = await verifyRelease(system, release)
  const version = manifest.version
  // A fresh private folder each run (mode 0700), so nothing else can swap the files between this check and `shadcn add`.
  const outDir = mkdtempSync(path.join(tmpdir(), `unending-${system}-v${version}-`))

  const done = new Map()
  const order = []
  const packages = new Set()
  const visit = async (name) => {
    if (done.has(name)) return
    done.set(name, null)
    const file = `${name}.json`
    if (!manifest.items[file]) die(`${name} isn't in ${system} v${version}.`)
    const { text } = await getJson(`${registry}/r/${system}/v/${version}/${file}`)
    if (sha256(text) !== manifest.items[file]) die(`${file} doesn't match its release. Refusing to install anything.`)
    if (release.signer.kind === "github" && !(await stockFileMatches(manifest.commit, file, text)))
      die(`${file} doesn't match the catalog repo at ${manifest.commit.slice(0, 7)}. Refusing to install anything.`)
    const item = JSON.parse(text)
    for (const dep of item.registryDependencies ?? []) if (dep.startsWith("@unending/")) await visit(dep.slice("@unending/".length))
    for (const dep of [...(item.dependencies ?? []), ...(item.devDependencies ?? [])]) packages.add(dep)
    if (item.font?.dependency) packages.add(item.font.dependency)
    // The @unending items it needs are verified and added alongside it, so
    // shadcn never fetches them again unverified.
    item.registryDependencies = (item.registryDependencies ?? []).filter((dep) => !dep.startsWith("@unending/"))
    const local = path.join(outDir, file)
    writeFileSync(local, JSON.stringify(item, null, 2), { flag: "wx", mode: 0o600 })
    done.set(name, local)
    order.push(local)
  }
  for (const name of wanted) await visit(name)
  console.log(JSON.stringify({ system, version, signer: release.signer.kind === "admin" ? `key ${release.signer.keyId}` : `GitHub ${manifest.commit.slice(0, 7)}`, files: order, packages: [...packages].sort() }, null, 2))
}

const commands = { login, systems, fetch: fetchItems }
if (!commands[command]) die("Usage: unending.mjs login --org <org> | systems | fetch <system> <item...>")
await commands[command]()
