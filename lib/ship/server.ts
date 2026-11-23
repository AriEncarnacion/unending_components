// Ships a design system straight to the registry host. No branch, no PR, no
// Actions run: nothing about a system ever enters the public repo or its logs.
//
//   1. Build the system's registry from your saved files.
//   2. Check it with the registry Worker's own upload rules.
//   3. Optionally, a local Claude review of what changed since the last ship.
//   4. Write the release manifest (every file's SHA-256), then sign it and the
//      upload request together: one Touch ID.
//   5. The Worker verifies, validates, writes the version create-only and
//      moves the pointer. You get an email.
//
// Also: Roll back (move the pointer to an earlier version), Pull (fetch every
// system's current source, verified), and Set up this Mac (make its key).
//
// Dev server only. Jobs live in memory and .generated/ship/jobs.json; what was
// shipped from here lives in .generated/ship/shipped.json.
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"

import { manifestPayload, RELEASE_FORMAT, type Release } from "../../worker/src/shared/protocol.ts"
import { checkBundle } from "../../worker/src/shared/validate.ts"
import { admin, pinnedKeys, pinnedKeysFile, registryUrl, registryUrlProblem, releaseMessage, verifyRelease } from "../registry-host/client.ts"
import { createKey, keyFile, keyInfo, signerAvailable, type KeyInfo } from "../registry-host/signer.ts"
import { HEADER } from "../../worker/src/shared/protocol.ts"
import { idPattern } from "../design-systems/schema.ts"

const run = promisify(execFile)
const root = process.cwd()
const shipDir = path.join(root, ".generated/ship")
const jobsFile = path.join(shipDir, "jobs.json")
const shippedFile = path.join(shipDir, "shipped.json")
const systemsDir = path.join(root, "design-systems")

export type ShipJob = {
  systemId: string
  systemName: string
  action: "ship" | "rollback" | "pull"
  state: "running" | "shipped" | "blocked" | "needs-allow" | "failed" | "nothing"
  step: string
  log: { at: number; text: string }[]
  version?: number
  findings?: string
  unknownPackages?: string[]
  error?: string
  note?: string
  startedAt: number
  finishedAt?: number
}

/** What this Mac last shipped or pulled, per system. */
type Shipped = { latest: number; current: number; sourceHash: string; inputsHash?: string; at: number }

type Store = { jobs: Map<string, ShipJob> }
const globalStore = globalThis as unknown as { __unendingShip?: Store }
const store: Store = (globalStore.__unendingShip ??= { jobs: loadJobs() })

function loadJobs() {
  try {
    const states = ["running", "shipped", "blocked", "needs-allow", "failed", "nothing"]
    // Jobs from before Ship went direct (pull requests) don't fit; drop them.
    const saved = (JSON.parse(readFileSync(jobsFile, "utf8")) as ShipJob[]).filter(
      (job) => ["ship", "rollback", "pull"].includes(job.action) && states.includes(job.state)
    )
    return new Map(
      saved.map((job) => [
        job.systemId,
        job.state === "running"
          ? { ...job, state: "failed" as const, error: "The dev server restarted during this. Check the registry, then try again." }
          : job,
      ])
    )
  } catch {
    return new Map<string, ShipJob>()
  }
}

function persist() {
  mkdirSync(shipDir, { recursive: true })
  writeFileSync(jobsFile, JSON.stringify([...store.jobs.values()], null, 2))
}

function readShipped(): Record<string, Shipped> {
  try {
    return JSON.parse(readFileSync(shippedFile, "utf8"))
  } catch {
    return {}
  }
}

function writeShipped(id: string, value: Shipped) {
  mkdirSync(shipDir, { recursive: true })
  writeFileSync(shippedFile, JSON.stringify({ ...readShipped(), [id]: value }, null, 2))
}

// ── What a system is made of ────────────────────────────────────────────────

/** The system's own files, as they're uploaded: system.json and entries/<name>.json (never proposals). */
function sourceFiles(id: string): Record<string, string> {
  const dir = path.join(systemsDir, id)
  const files: Record<string, string> = { "system.json": readFileSync(path.join(dir, "system.json"), "utf8") }
  const entries = path.join(dir, "entries")
  if (existsSync(entries))
    for (const name of readdirSync(entries).sort())
      if (name.endsWith(".json") && !name.endsWith(".proposed.json")) files[`entries/${name}`] = readFileSync(path.join(entries, name), "utf8")
  return files
}

const hashOf = (files: Record<string, string>) =>
  createHash("sha256")
    .update(JSON.stringify(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))))
    .digest("hex")

/** Everything besides the system's own files that goes into its build: entries, the theme, the build script. */
function inputsHash() {
  const registry = JSON.parse(readFileSync(path.join(root, "registry.json"), "utf8")) as { items: { files?: { path: string }[] }[] }
  const files: Record<string, string> = {}
  const add = (file: string) => {
    if (existsSync(path.join(root, file))) files[file] = readFileSync(path.join(root, file), "utf8")
  }
  for (const item of registry.items) for (const file of item.files ?? []) add(file.path)
  for (const file of ["registry.json", "scripts/build-systems.ts", "scripts/templates/unending-colors.mjs"]) add(file)
  for (const file of readdirSync(path.join(root, "lib/design-systems"))) add(`lib/design-systems/${file}`)
  return hashOf(files)
}

// ── Readiness and status ────────────────────────────────────────────────────

export type Preflight = {
  ok: boolean
  problems: string[]
  registry: string
  /** This Mac's key, if it has one, and whether the plugin pins it yet. */
  key?: KeyInfo & { pinned: boolean }
  /** Whether `claude` is on the PATH, for the optional review. */
  claude: boolean
}

export async function preflight(): Promise<Preflight> {
  const problems: string[] = []
  const signer = await signerAvailable()
  if (signer) problems.push(signer)
  const url = registryUrlProblem()
  if (url) problems.push(url)
  let key: Preflight["key"]
  if (!signer) {
    try {
      const info = await keyInfo()
      if (info) key = { ...info, pinned: pinnedKeys().some((k) => k.keyId === info.keyId && !k.retiredAt) }
    } catch (error) {
      problems.push(`Couldn't read this Mac's admin key: ${(error as Error).message}`)
    }
  }
  const claude = await run("which", ["claude"]).then(
    () => true,
    () => false
  )
  return { ok: problems.length === 0 && !!key, problems, registry: registryUrl, key, claude }
}

/**
 * shipped:   the registry serves what's saved here
 * older:     the registry serves an earlier version (rolled back)
 * changed:   saved here since the last ship
 * behind:    unchanged here, but the catalog's entries changed since it shipped
 * unshipped: never shipped (or pulled) from this Mac
 */
export type ShipStatus = "shipped" | "older" | "changed" | "behind" | "unshipped"

export function statuses(ids: string[]): Record<string, { status: ShipStatus; current?: number; latest?: number }> {
  const shipped = readShipped()
  const inputs = inputsHash()
  const result: Record<string, { status: ShipStatus; current?: number; latest?: number }> = {}
  for (const id of ids) {
    const record = shipped[id]
    if (!record || !existsSync(path.join(systemsDir, id, "system.json"))) {
      result[id] = { status: "unshipped" }
      continue
    }
    const status: ShipStatus =
      hashOf(sourceFiles(id)) !== record.sourceHash
        ? "changed"
        : record.current !== record.latest
          ? "older"
          : record.inputsHash && record.inputsHash !== inputs
            ? "behind"
            : "shipped"
    result[id] = { status, current: record.current, latest: record.latest }
  }
  return result
}

export function jobs() {
  return Object.fromEntries(store.jobs)
}

// ── Jobs ────────────────────────────────────────────────────────────────────

function begin(systemId: string, systemName: string, action: ShipJob["action"]) {
  const current = store.jobs.get(systemId)
  if (current?.state === "running") throw new Error(`${systemName} is busy: ${current.step}.`)
  const job: ShipJob = { systemId, systemName, action, state: "running", step: "Starting", log: [], startedAt: Date.now() }
  store.jobs.set(systemId, job)
  persist()
  return job
}

function step(job: ShipJob, text: string) {
  job.step = text
  job.log.push({ at: Date.now(), text })
  persist()
}

function finish(job: ShipJob, state: ShipJob["state"], extra: Partial<ShipJob> = {}) {
  Object.assign(job, extra, { state, finishedAt: Date.now() })
  persist()
}

async function guarded(job: ShipJob, work: () => Promise<void>) {
  try {
    await work()
  } catch (error) {
    finish(job, "failed", { error: (error as Error).message.split("\n").slice(0, 8).join("\n") })
  }
}

export type ShipOptions = { org?: string; allow?: string[]; review?: boolean }

export function startShip(systemId: string, systemName: string, options: ShipOptions) {
  const job = begin(systemId, systemName, "ship")
  void guarded(job, () => ship(job, options))
  return job
}

async function ship(job: ShipJob, options: ShipOptions) {
  const id = job.systemId
  const buildDir = path.join(shipDir, id, "build")
  const lastDir = path.join(shipDir, id, "last")

  step(job, "Building the registry")
  try {
    await run("node", ["--experimental-strip-types", "--no-warnings", "scripts/build-systems.ts", "--system", id, "--out", buildDir], {
      cwd: root,
      timeout: 300_000,
      maxBuffer: 20 * 1024 * 1024,
    })
  } catch (error) {
    const e = error as { stderr?: string; stdout?: string }
    return finish(job, "blocked", { step: "The build found problems", findings: (e.stderr || e.stdout || "").trim().slice(0, 6000) })
  }

  step(job, "Checking it against the registry's rules")
  const source = sourceFiles(id)
  const files: Record<string, string> = {}
  for (const name of readdirSync(buildDir).filter((f) => f.endsWith(".json")).sort()) files[`r/${name}`] = readFileSync(path.join(buildDir, name), "utf8")
  for (const [file, content] of Object.entries(source)) files[`src/${file}`] = content
  const checked = checkBundle(files, [], id)
  if (checked.problems.length)
    return finish(job, "blocked", { step: "The registry would refuse this", findings: checked.problems.join("\n") })

  const record = readShipped()[id]
  if (record && record.sourceHash === hashOf(source) && record.inputsHash === inputsHash() && existsSync(lastDir) && sameFiles(buildDir, lastDir))
    return finish(job, "nothing", { note: `Version ${record.latest} already has exactly this.` })

  if (options.review) {
    step(job, "Claude is reviewing what changed")
    const verdict = await review(job, buildDir, lastDir)
    if (verdict.block) return finish(job, "blocked", { step: "The review found something to fix", findings: verdict.text })
    job.findings = verdict.text
  }

  const commit = await run("git", ["rev-parse", "HEAD"], { cwd: root }).then(
    (r) => r.stdout.trim(),
    () => undefined
  )
  let version = (record?.latest ?? 0) + 1
  for (let attempt = 0; attempt < 2; attempt++) {
    const items: Record<string, string> = {}
    const sourceHashes: Record<string, string> = {}
    for (const [file, content] of Object.entries(files)) {
      const digest = createHash("sha256").update(content, "utf8").digest("hex")
      if (file.startsWith("r/")) items[file.slice(2)] = digest
      else sourceHashes[file.slice(4)] = digest
    }
    const payload = manifestPayload({
      format: RELEASE_FORMAT,
      system: id,
      version,
      createdAt: new Date().toISOString(),
      ...(commit && /^[0-9a-f]{40}$/.test(commit) ? { commit } : {}),
      items,
      source: sourceHashes,
    })
    const key = await keyInfo()
    step(
      job,
      attempt
        ? `Confirm again with Touch ID: the registry was already at version ${version - 1}`
        : "Confirm with Touch ID to sign and upload"
    )
    const result = await admin<{ expectedVersion?: number; unknownPackages?: string[]; problems?: string[]; current?: number }>(
      "POST",
      `/admin/systems/${id}/versions`,
      {
        reason: `ship ${job.systemName} v${version} to the registry`,
        body: {
          version,
          name: job.systemName,
          ...(record ? {} : options.org ? { org: options.org } : {}),
          ...(options.allow?.length ? { allow: options.allow } : {}),
          release: { payload, keyId: key!.keyId },
          files,
          summary: `Shipped from the catalog${commit ? ` at ${commit.slice(0, 7)}` : ""}.`,
        },
        also: [{ message: releaseMessage(payload), header: HEADER.releaseSignature }],
      }
    )
    if (result.status === 409 && result.data.expectedVersion && attempt === 0) {
      version = result.data.expectedVersion
      continue
    }
    if (result.status === 422 && result.data.unknownPackages?.length)
      return finish(job, "needs-allow", { step: "New npm packages need your OK", unknownPackages: result.data.unknownPackages })
    if (result.status === 422) return finish(job, "blocked", { step: "The registry refused it", findings: (result.data.problems ?? []).join("\n") })
    if (!result.ok) throw new Error(result.data.error ?? `The registry answered ${result.status}.`)

    rmSync(lastDir, { recursive: true, force: true })
    cpSync(buildDir, lastDir, { recursive: true })
    writeShipped(id, { latest: version, current: version, sourceHash: hashOf(source), inputsHash: inputsHash(), at: Date.now() })
    return finish(job, "shipped", {
      step: "Shipped",
      version,
      note: `Version ${version} is live at ${registryUrl}/r/${id}/. Apps pull it with /unending:sync.`,
    })
  }
  throw new Error("The registry's version kept moving. Pull, then ship again.")
}

function sameFiles(a: string, b: string) {
  const list = (dir: string) => readdirSync(dir).sort()
  const left = list(a)
  const right = list(b)
  return left.length === right.length && left.every((f, i) => f === right[i] && readFileSync(path.join(a, f)).equals(readFileSync(path.join(b, f))))
}

/** A local Claude review of the diff against the last ship from here. Uses your Claude login; no tools. */
async function review(job: ShipJob, buildDir: string, lastDir: string): Promise<{ block: boolean; text: string }> {
  const diff = existsSync(lastDir)
    ? await run("git", ["diff", "--no-index", "--no-color", "--", lastDir, buildDir], { cwd: root, maxBuffer: 20 * 1024 * 1024 }).then(
        (r) => r.stdout,
        (e: { stdout?: string }) => e.stdout ?? ""
      )
    : readdirSync(buildDir)
        .map((f) => `--- new file ${f}\n${readFileSync(path.join(buildDir, f), "utf8")}`)
        .join("\n")
  const instructions = [
    `You review a design-system registry about to be published as "${job.systemName}". Consumers install these shadcn registry items with the shadcn CLI, so their code and CSS run in other people's apps.`,
    "The user message is a diff of the built registry files against the last published version (or every file, if this is the first).",
    "Look for: code that does anything beyond UI (network calls, storage, eval, reading env or cookies), new or unexpected npm dependencies, CSS that could break out of its rule, accessibility or contrast regressions, and obvious mistakes.",
    "Reply with a first line that is exactly VERDICT: PASS or VERDICT: BLOCK (BLOCK only for something that must be fixed before publishing), then the findings as short bullet points.",
  ].join("\n")
  // A bare session: no tools, MCP servers, skills, settings or project files,
  // so a review costs cents and the diff can't make it do anything.
  const args = [
    "-p",
    "Review this diff.",
    "--system-prompt",
    instructions,
    "--tools",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--setting-sources",
    "",
    "--no-session-persistence",
    "--max-budget-usd",
    "2",
    "--output-format",
    "json",
  ]
  const cwd = path.join(shipDir, "review")
  mkdirSync(cwd, { recursive: true })
  try {
    const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
      const child = execFile("claude", args, { cwd, timeout: 600_000, maxBuffer: 10 * 1024 * 1024 }, (error, out) =>
        error ? reject(error) : resolve({ stdout: out })
      )
      child.stdin?.end(diff.slice(0, 400_000))
    })
    const text = String((JSON.parse(stdout) as { result?: string }).result ?? "").trim()
    return { block: !/^VERDICT:\s*PASS/i.test(text), text: text.replace(/^VERDICT:\s*\w+\s*/i, "").trim() || "No findings." }
  } catch (error) {
    return { block: true, text: `The review couldn't run: ${(error as Error).message.split("\n")[0]}. Ship without the review, or try again.` }
  }
}

// ── Roll back ───────────────────────────────────────────────────────────────

export function startRollback(systemId: string, systemName: string, version: number) {
  const job = begin(systemId, systemName, "rollback")
  void guarded(job, async () => {
    step(job, "Confirm with Touch ID")
    const result = await admin<{ current?: number; latest?: number }>("POST", `/admin/systems/${systemId}/current`, {
      reason: `make ${systemName} serve v${version}`,
      body: { version },
    })
    if (!result.ok) throw new Error(result.data.error ?? `The registry answered ${result.status}.`)
    const record = readShipped()[systemId]
    if (record) writeShipped(systemId, { ...record, current: version, latest: result.data.latest ?? record.latest })
    finish(job, "shipped", { step: `Serving version ${version}`, version, note: `${systemName} now serves version ${version}. Nothing was rebuilt.` })
  })
  return job
}

// ── Pull ────────────────────────────────────────────────────────────────────

export const PULL_JOB = "__pull"

type Pulled = {
  systems: { id: string; name: string; latest: number; current: number; source?: { version: number; release: Release; files: Record<string, string> } }[]
}

/**
 * Fetches every system's current source from the registry, verifies each
 * release's signature and file hashes, and writes them to design-systems/.
 * A system with saved changes that never shipped is left alone unless `force`.
 */
export function startPull(force: boolean) {
  const job = begin(PULL_JOB, "Pull", "pull")
  void guarded(job, async () => {
    step(job, "Confirm with Touch ID")
    const result = await admin<Pulled>("GET", "/admin/systems?source", { reason: "pull design systems from the registry" })
    if (!result.ok) throw new Error(result.data.error ?? `The registry answered ${result.status}.`)
    const local = await keyInfo()
    const shipped = readShipped()
    const notes: string[] = []
    for (const system of result.data.systems) {
      if (!system.source || !idPattern.test(system.id)) continue
      step(job, `Verifying ${system.name}`)
      await verifyRelease(system.source.release, { source: system.source.files }, local)
      const dir = path.join(systemsDir, system.id)
      const incoming = system.source.files
      if (existsSync(path.join(dir, "system.json"))) {
        const mine = sourceFiles(system.id)
        if (hashOf(mine) === hashOf(incoming)) {
          writeShipped(system.id, { ...shipped[system.id], latest: system.latest, current: system.current, sourceHash: hashOf(incoming), at: Date.now() })
          notes.push(`${system.name}: already up to date (v${system.current}).`)
          continue
        }
        const record = shipped[system.id]
        if (!force && (!record || hashOf(mine) !== record.sourceHash)) {
          notes.push(`${system.name}: skipped, because it has saved changes that haven't shipped. Ship them, or pull with "Replace local changes".`)
          continue
        }
        const backup = path.join(shipDir, "pull-backup", `${Date.now()}`, system.id)
        mkdirSync(path.dirname(backup), { recursive: true })
        cpSync(dir, backup, { recursive: true })
        rmSync(dir, { recursive: true, force: true })
      }
      for (const [file, content] of Object.entries(incoming)) {
        if (!/^(?:system\.json|entries\/[a-z0-9]+(?:-[a-z0-9]+)*\.json)$/.test(file)) throw new Error(`Refusing to write ${file}.`)
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
        writeFileSync(path.join(dir, file), content)
      }
      writeShipped(system.id, { latest: system.latest, current: system.current, sourceHash: hashOf(incoming), at: Date.now() })
      notes.push(`${system.name}: pulled version ${system.current}.`)
    }
    finish(job, "shipped", { step: "Pulled", note: notes.join("\n") || "The registry has no design systems yet." })
  })
  return job
}

// ── Set up this Mac ─────────────────────────────────────────────────────────

/**
 * Makes this Mac's admin key and pins it in plugin/keys.json, so consumers
 * trust its releases once that change is merged. Enrolling it with the
 * Worker (ADMIN_KEYS) is a step in the Cloudflare dashboard.
 */
export async function setUpThisMac() {
  const key = await createKey()
  let pinned: { keys: unknown[] } = { keys: [] }
  try {
    pinned = JSON.parse(readFileSync(pinnedKeysFile, "utf8"))
  } catch {}
  pinned.keys = [...(pinned.keys ?? []), { keyId: key.keyId, publicKey: key.publicKey, addedAt: new Date().toISOString() }]
  writeFileSync(pinnedKeysFile, JSON.stringify(pinned, null, 2) + "\n")
  return { ...key, keyFile }
}
