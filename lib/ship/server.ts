import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"

import { systemsDir } from "../design-systems/load.ts"
import { idPattern } from "../design-systems/schema.ts"

const run = promisify(execFile)
const root = process.cwd()
const shipDir = path.join(root, ".generated/ship")
const jobsFile = path.join(shipDir, "jobs.json")

export const TOPIC = "unending-design-system"
export const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/
export const repoPattern = /^[A-Za-z0-9._-]{1,100}$/

export type ShipJob = {
  systemId: string
  systemName: string
  action: "ship" | "rollback" | "pull"
  state: "running" | "shipped" | "blocked" | "failed" | "nothing"
  step: string
  log: { at: number; text: string }[]
  version?: number
  findings?: string
  blockedBy?: "build" | "review"
  error?: string
  note?: string
  url?: string
  startedAt: number
  finishedAt?: number
}

type Store = { jobs: Map<string, ShipJob>; preflight?: { at: number; value: Promise<Preflight> }; repos: Map<string, { at: number; info: RepoInfo }> }
const globalStore = globalThis as unknown as { __unendingShipGitHub?: Store }
const store: Store = (globalStore.__unendingShipGitHub ??= { jobs: loadJobs(), repos: new Map() })

function loadJobs() {
  try {
    const states = ["running", "shipped", "blocked", "failed", "nothing"]
    const saved = (JSON.parse(readFileSync(jobsFile, "utf8")) as ShipJob[]).filter(
      (job) => ["ship", "rollback", "pull"].includes(job.action) && states.includes(job.state)
    )
    return new Map(
      saved.map((job) => [
        job.systemId,
        job.state === "running" ? { ...job, state: "failed" as const, error: "The dev server restarted during this. Check the repo, then try again." } : job,
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

const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" }

async function git(dir: string, args: string[], timeout = 120_000) {
  const { stdout } = await run("git", ["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential", ...args], {
    cwd: dir,
    timeout,
    env,
    maxBuffer: 20 * 1024 * 1024,
  })
  return stdout.trim()
}

async function gitOk(dir: string, args: string[]) {
  try {
    return { ok: true, out: await git(dir, args) }
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message: string }
    return { ok: false, out: (e.stdout ?? "").trim(), err: (e.stderr || e.message).trim() }
  }
}

async function gh(args: string[], cwd = root) {
  const { stdout } = await run("gh", args, { cwd, timeout: 120_000, env, maxBuffer: 20 * 1024 * 1024 })
  return stdout.trim()
}

const dirOf = (id: string) => {
  if (!idPattern.test(id)) throw new Error(`Invalid system id "${id}".`)
  return path.join(systemsDir, id)
}

async function repoOf(dir: string) {
  if (!existsSync(path.join(dir, ".git"))) return undefined
  const url = await gitOk(dir, ["remote", "get-url", "origin"])
  const match = /github\.com[/:]([A-Za-z0-9-]+\/[A-Za-z0-9._-]+?)(?:\.git)?$/.exec(url.out)
  return url.ok && match ? match[1] : undefined
}

async function latestTag(dir: string) {
  const tags = (await gitOk(dir, ["tag", "-l", "v*"])).out.split("\n")
  return Math.max(0, ...tags.map((t) => (/^v([1-9]\d*)$/.exec(t.trim()) ? Number(t.trim().slice(1)) : 0)))
}

const hashOf = (files: Record<string, string>) =>
  createHash("sha256")
    .update(JSON.stringify(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))))
    .digest("hex")

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

const buildInfoFile = (dir: string) => path.join(dir, ".unending/build.json")

export type Preflight = {
  ok: boolean
  problems: string[]
  owners: string[]
  claude: boolean
}

export function preflight(fresh = false): Promise<Preflight> {
  if (fresh || !store.preflight || Date.now() - store.preflight.at > 30_000) store.preflight = { at: Date.now(), value: checkPreflight() }
  return store.preflight.value
}

async function checkPreflight(): Promise<Preflight> {
  const problems: string[] = []
  const owners: string[] = []
  const has = (cmd: string) => run("which", [cmd]).then(() => true, () => false)
  if (!(await has("git"))) problems.push("Shipping needs git.")
  if (!(await has("gh"))) problems.push("Shipping needs the GitHub CLI. Install it (brew install gh), then run gh auth login.")
  else {
    try {
      owners.push(await gh(["api", "user", "--jq", ".login"]))
      owners.push(...(await gh(["api", "user/orgs", "--paginate", "--jq", ".[].login"])).split("\n").filter(Boolean))
    } catch {
      problems.push("The GitHub CLI isn't signed in. Run gh auth login in a terminal.")
    }
  }
  return { ok: problems.length === 0, problems, owners, claude: await has("claude") }
}

export type RepoInfo = { repo: string; url: string; visibility: "public" | "private" | "internal" | "unknown" }

async function repoInfo(repo: string): Promise<RepoInfo> {
  const cached = store.repos.get(repo)
  if (cached && Date.now() - cached.at < 300_000) return cached.info
  let visibility: RepoInfo["visibility"] = "unknown"
  try {
    visibility = (await gh(["repo", "view", repo, "--json", "visibility", "--jq", ".visibility"])).toLowerCase() as RepoInfo["visibility"]
  } catch {}
  const info = { repo, url: `https://github.com/${repo}`, visibility }
  store.repos.set(repo, { at: Date.now(), info })
  return info
}

export type ShipStatus = "shipped" | "changed" | "behind" | "unshipped"
export type SystemStatus = { status: ShipStatus; version?: number; repo?: RepoInfo }

export async function statuses(ids: string[]): Promise<Record<string, SystemStatus>> {
  const inputs = inputsHash()
  const result: Record<string, SystemStatus> = {}
  for (const id of ids) {
    const dir = dirOf(id)
    const repo = await repoOf(dir)
    if (!repo) {
      result[id] = { status: "unshipped" }
      continue
    }
    const version = await latestTag(dir)
    const dirty = (await gitOk(dir, ["status", "--porcelain", "--", "system.json", "entries"])).out
    let built: { inputsHash?: string } = {}
    try {
      built = JSON.parse(readFileSync(buildInfoFile(dir), "utf8"))
    } catch {}
    const status: ShipStatus = dirty || !version ? "changed" : built.inputsHash !== inputs ? "behind" : "shipped"
    result[id] = { status, version: version || undefined, repo: await repoInfo(repo) }
  }
  return result
}

export function jobs() {
  return Object.fromEntries(store.jobs)
}

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
    const e = error as { stderr?: string; message: string }
    finish(job, "failed", { error: (e.stderr || e.message).split("\n").slice(0, 8).join("\n") })
  }
}

async function upToDate(dir: string) {
  await git(dir, ["fetch", "--quiet", "--tags", "origin"])
  const behind = await gitOk(dir, ["rev-list", "--count", "HEAD..origin/main"])
  if (behind.ok && Number(behind.out) > 0) throw new Error("The repo has changes this Mac doesn't. Pull first, then try again.")
}

export type NewRepo = { owner: string; name: string; visibility: "private" | "public" }
export type ShipOptions = { create?: NewRepo; review?: boolean }

export function startShip(systemId: string, systemName: string, options: ShipOptions) {
  const job = begin(systemId, systemName, "ship")
  void guarded(job, () => ship(job, options))
  return job
}

async function build(dir: string, id: string, repo: string, version: number) {
  try {
    await run(
      "node",
      ["--experimental-strip-types", "--no-warnings", "scripts/build-systems.ts", "--system", id, "--address", repo, "--version", String(version)],
      { cwd: root, timeout: 300_000, maxBuffer: 20 * 1024 * 1024 }
    )
  } catch (error) {
    const e = error as { stderr?: string; stdout?: string }
    return (e.stderr || e.stdout || "The build failed.").trim().slice(0, 6000)
  }
  const commit = await run("git", ["rev-parse", "HEAD"], { cwd: root }).then(
    (r) => r.stdout.trim(),
    () => ""
  )
  mkdirSync(path.dirname(buildInfoFile(dir)), { recursive: true })
  writeFileSync(buildInfoFile(dir), JSON.stringify({ inputsHash: inputsHash(), catalogCommit: commit }, null, 2) + "\n")
  return null
}

async function ship(job: ShipJob, options: ShipOptions) {
  const check = await preflight()
  if (!check.ok) throw new Error(check.problems.join(" "))
  const id = job.systemId
  const dir = dirOf(id)
  if (!existsSync(path.join(dir, "system.json"))) throw new Error("Save the system before shipping it.")

  let repo = await repoOf(dir)
  const creating = !repo
  if (creating) {
    const create = options.create
    if (!create) throw new Error("Choose where this system's repo goes.")
    if (!ownerPattern.test(create.owner) || !repoPattern.test(create.name)) throw new Error("That isn't a valid owner and repo name.")
    if (!check.owners.some((o) => o.toLowerCase() === create.owner.toLowerCase())) throw new Error(`You can't create repos as ${create.owner}.`)
    repo = `${create.owner}/${create.name}`
    step(job, `Checking ${repo} is free`)
    const exists = await gh(["repo", "view", repo, "--json", "name"]).then(
      () => true,
      () => false
    )
    if (exists) throw new Error(`${repo} already exists. Pull it, or choose another name.`)
    if (!existsSync(path.join(dir, ".git"))) await git(dir, ["init", "--quiet", "--initial-branch=main"])
  } else {
    step(job, "Checking the repo for newer changes")
    await upToDate(dir)
  }

  const latest = creating ? 0 : await latestTag(dir)
  if (latest) {
    step(job, `Checking for changes since v${latest}`)
    const problem = await build(dir, id, repo!, latest)
    if (problem) return finish(job, "blocked", { step: "The build found problems", findings: problem, blockedBy: "build" })
    await git(dir, ["add", "--all"])
    if ((await gitOk(dir, ["diff", "--cached", "--quiet"])).ok)
      return finish(job, "nothing", { version: latest, note: `v${latest} already has exactly this.`, url: `https://github.com/${repo}` })
  }
  const version = latest + 1
  step(job, `Building v${version}`)
  const problem = await build(dir, id, repo!, version)
  if (problem) return finish(job, "blocked", { step: "The build found problems", findings: problem, blockedBy: "build" })
  await git(dir, ["add", "--all"])

  if (options.review) {
    step(job, "Claude is reviewing what changed")
    const verdict = await review(job, await git(dir, ["diff", "--cached", "--no-color"]))
    if (verdict.block) {
      await git(dir, ["reset", "--quiet"])
      return finish(job, "blocked", { step: "The review asked for changes", findings: verdict.text, blockedBy: "review" })
    }
    job.findings = verdict.text
  }

  const catalogCommit = await run("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).then(
    (r) => r.stdout.trim(),
    () => "unknown"
  )
  step(job, `Committing v${version}`)
  await git(dir, ["commit", "--quiet", "-m", `Ship ${job.systemName} v${version}`, "-m", `Built from the Unending catalog at ${catalogCommit}.`])
  await git(dir, ["tag", "-a", `v${version}`, "-m", `${job.systemName} v${version}`])

  if (creating) {
    const create = options.create!
    step(job, `Creating ${repo} (${create.visibility})`)
    await gh(
      ["repo", "create", repo!, `--${create.visibility}`, "--source", dir, "--remote", "origin", "--description", `${job.systemName}: a design system from the Unending catalog, as a shadcn registry.`],
      dir
    )
    await gh(["repo", "edit", repo!, "--add-topic", TOPIC], dir)
  }
  step(job, `Pushing v${version}`)
  const pushed = await gitOk(dir, ["push", "--quiet", "--atomic", "origin", "HEAD:refs/heads/main", `refs/tags/v${version}`])
  if (!pushed.ok) {
    await gitOk(dir, ["tag", "-d", `v${version}`])
    await gitOk(dir, ["reset", "--quiet", "--soft", "HEAD~1"])
    throw new Error(/rejected|non-fast-forward|fetch first/.test(pushed.err ?? "") ? "The repo moved on. Pull first, then ship again." : pushed.err)
  }
  if (creating) await gitOk(dir, ["branch", "--quiet", "--set-upstream-to=origin/main", "main"])
  store.repos.delete(repo!)
  finish(job, "shipped", {
    step: `Shipped v${version}`,
    version,
    url: `https://github.com/${repo}`,
    note: `Apps install it as ${repo}/<item>#v${version}, and /unending:sync offers it to apps already linked.`,
  })
}

const stockShadcnPackages = ["cn", "@base-ui/react", "@shadcn/react", "class-variance-authority", "lucide-react", "tw-animate-css", "shadcn"]

async function review(job: ShipJob, diff: string): Promise<{ block: boolean; text: string }> {
  const instructions = [
    `You review a design-system registry about to be published as "${job.systemName}". Consumers install these shadcn registry items with the shadcn CLI, so their code and CSS run in other people's apps.`,
    "The user message is a diff of the repo against its last published version (or every file, if this is the first).",
    "Look for: code that does anything beyond UI (network calls, storage, eval, reading env or cookies), new or unexpected npm dependencies, CSS that could break out of its rule, accessibility or contrast regressions, and obvious mistakes.",
    `These npm packages are stock shadcn and expected, so never flag them as unexpected: ${stockShadcnPackages.map((name) => `\`${name}\``).join(", ")}. \`cn\` is shadcn's own class-name helper (github.com/shadcn-ui/cn), and \`import { cn } from "cn"\` is the current stock import, not a typo for \`@/lib/utils\`.`,
    "Reply with a first line that is exactly VERDICT: PASS or VERDICT: BLOCK (BLOCK only for something that must be fixed before publishing), then the findings as short Markdown bullet points, grouped under bold labels by how urgent they are.",
  ].join("\n")
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

export function startRollback(systemId: string, systemName: string, target: number) {
  const job = begin(systemId, systemName, "rollback")
  void guarded(job, async () => {
    const dir = dirOf(systemId)
    const repo = await repoOf(dir)
    if (!repo) throw new Error("This system has no repo yet.")
    step(job, "Checking the repo for newer changes")
    await upToDate(dir)
    if ((await gitOk(dir, ["status", "--porcelain"])).out) throw new Error("This system has unshipped changes. Ship or discard them first.")
    const latest = await latestTag(dir)
    if (!Number.isInteger(target) || target < 1 || target >= latest) throw new Error(`Pick a version below v${latest}.`)
    if (!(await gitOk(dir, ["rev-parse", "--verify", "--quiet", `refs/tags/v${target}`])).ok) throw new Error(`There's no v${target}.`)
    const version = latest + 1
    step(job, `Making v${version} from v${target}`)
    await git(dir, ["read-tree", "-u", "--reset", `v${target}`])
    await git(dir, ["commit", "--quiet", "--allow-empty", "-m", `Roll back ${systemName} to v${target}`, "-m", `v${version} has the same files as v${target}.`])
    await git(dir, ["tag", "-a", `v${version}`, "-m", `${systemName} v${version} (v${target}'s files)`])
    step(job, `Pushing v${version}`)
    const pushed = await gitOk(dir, ["push", "--quiet", "--atomic", "origin", "HEAD:refs/heads/main", `refs/tags/v${version}`])
    if (!pushed.ok) {
      await gitOk(dir, ["tag", "-d", `v${version}`])
      await gitOk(dir, ["reset", "--quiet", "--hard", "HEAD~1"])
      throw new Error(pushed.err)
    }
    finish(job, "shipped", {
      step: `v${version} has v${target}'s files`,
      version,
      url: `https://github.com/${repo}`,
      note: `Apps on v${target} or earlier don't need anything. Apps on a later version get v${version} with /unending:sync.`,
    })
  })
  return job
}

export const PULL_JOB = "__pull"

export function startPull() {
  const job = begin(PULL_JOB, "Pull", "pull")
  void guarded(job, async () => {
    const check = await preflight(true)
    if (!check.ok) throw new Error(check.problems.join(" "))
    const notes: string[] = []
    const repos: string[] = []
    for (const owner of check.owners) {
      step(job, `Looking for design systems owned by ${owner}`)
      const list = await gh(["repo", "list", owner, "--topic", TOPIC, "--limit", "200", "--json", "nameWithOwner", "--jq", ".[].nameWithOwner"]).catch(() => "")
      repos.push(...list.split("\n").filter(Boolean))
    }
    const linked = new Map<string, string>()
    if (existsSync(systemsDir))
      for (const id of readdirSync(systemsDir)) {
        if (!idPattern.test(id)) continue
        const repo = await repoOf(path.join(systemsDir, id))
        if (repo) linked.set(repo.toLowerCase(), id)
      }
    for (const repo of repos) {
      const localId = linked.get(repo.toLowerCase())
      if (localId) {
        const dir = dirOf(localId)
        if ((await gitOk(dir, ["status", "--porcelain"])).out) {
          notes.push(`${repo}: skipped, because ${localId} has changes that haven't shipped.`)
          continue
        }
        step(job, `Updating ${repo}`)
        const pulled = await gitOk(dir, ["pull", "--quiet", "--ff-only", "--tags", "origin", "main"])
        notes.push(pulled.ok ? `${repo}: up to date at v${await latestTag(dir)}.` : `${repo}: couldn't fast-forward (${pulled.err?.split("\n")[0]}).`)
        continue
      }
      step(job, `Cloning ${repo}`)
      let id = ""
      try {
        id = String(JSON.parse(await gh(["api", `repos/${repo}/contents/system.json`, "-H", "Accept: application/vnd.github.raw+json"])).id ?? "")
      } catch {}
      if (!idPattern.test(id)) {
        notes.push(`${repo}: skipped, because it has no valid system.json.`)
        continue
      }
      if (existsSync(dirOf(id))) {
        notes.push(`${repo}: skipped, because design-systems/${id} already exists and isn't linked to it.`)
        continue
      }
      await gh(["repo", "clone", repo, dirOf(id), "--", "--quiet"])
      notes.push(`${repo}: cloned as ${id} at v${await latestTag(dirOf(id))}.`)
    }
    finish(job, "shipped", { step: "Pulled", note: notes.join("\n") || "No repos tagged unending-design-system yet." })
  })
  return job
}
