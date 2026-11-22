// Ships a design system: one action in the catalog, a pull request behind it.
//
//   1. A git worktree is made from the remote's default branch, so nothing
//      else in your working tree (other edits, other systems) is included.
//   2. The system's saved files are copied in and `npm run registry:build`
//      regenerates everything derived from them.
//   3. The result is committed to ship/<id>, pushed, and a PR is opened (or
//      the existing one updated).
//   4. CI and the Claude review run on the PR. When every check passes the
//      PR is squash-merged; when one fails, the PR stays open and the catalog
//      shows why.
//
// Dev server only. Jobs live in memory and in .generated/ship/jobs.json.
import { execFile } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, cpSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)
const root = process.cwd()
const shipDir = path.join(root, ".generated/ship")
const jobsFile = path.join(shipDir, "jobs.json")

/** Everything a ship may change: the system's files and what the registry build derives from them. */
export const SHIP_PATHS = [
  "design-systems",
  "public/r",
  "plugin/skills/unending-catalog/references/catalog.md",
  "registry.json",
]

export type ShipCheck = { name: string; bucket: string; link?: string }

export type ShipJob = {
  systemId: string
  systemName: string
  action: "ship" | "delete"
  state: "running" | "checking" | "merged" | "blocked" | "failed" | "nothing"
  step: string
  log: { at: number; text: string }[]
  pr?: { number: number; url: string }
  checks?: ShipCheck[]
  findings?: string
  error?: string
  note?: string
  startedAt: number
  finishedAt?: number
}

type Store = { jobs: Map<string, ShipJob>; fetchedAt: number; preflight?: { at: number; value: Preflight } }
const globalStore = globalThis as unknown as { __unendingShip?: Store }
const store: Store = (globalStore.__unendingShip ??= { jobs: loadJobs(), fetchedAt: 0 })

function loadJobs() {
  try {
    const saved = JSON.parse(readFileSync(jobsFile, "utf8")) as ShipJob[]
    // A job that was mid-flight when the dev server stopped can't resume.
    return new Map(
      saved.map((job) => [
        job.systemId,
        job.state === "running" || job.state === "checking"
          ? { ...job, state: "failed" as const, error: "The dev server restarted while this was shipping. Ship again to pick up where it left off." }
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

async function sh(cmd: string, args: string[], cwd = root, timeout = 120_000) {
  const { stdout } = await run(cmd, args, { cwd, timeout, maxBuffer: 20 * 1024 * 1024, env: process.env })
  return stdout.trim()
}

/** Like sh, but returns stdout even when the command exits non-zero (gh pr checks does while pending). */
async function shAny(cmd: string, args: string[], cwd = root) {
  try {
    return { ok: true, out: await sh(cmd, args, cwd) }
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message: string }
    return { ok: false, out: (e.stdout ?? "").trim(), err: (e.stderr ?? e.message).trim() }
  }
}

// ── Readiness ──────────────────────────────────────────────────────────────

export type Preflight = { ok: boolean; problems: string[]; repo?: string; base?: string }

export async function preflight(force = false): Promise<Preflight> {
  if (!force && store.preflight && Date.now() - store.preflight.at < 30_000) return store.preflight.value
  const problems: string[] = []
  let repo: string | undefined
  let base: string | undefined
  const origin = await shAny("git", ["remote", "get-url", "origin"])
  if (!origin.ok) problems.push("This repo has no GitHub remote yet. Create the GitHub repo and push the first commit.")
  const auth = await shAny("gh", ["auth", "status"])
  if (!auth.ok) problems.push("The GitHub CLI isn't signed in. Run gh auth login in a terminal.")
  if (origin.ok && auth.ok) {
    const view = await shAny("gh", ["repo", "view", "--json", "nameWithOwner,defaultBranchRef"])
    if (view.ok) {
      const parsed = JSON.parse(view.out) as { nameWithOwner: string; defaultBranchRef?: { name: string } }
      repo = parsed.nameWithOwner
      base = parsed.defaultBranchRef?.name || undefined
      if (!base) problems.push("The GitHub repo has no default branch yet. Push the first commit.")
    } else problems.push("Couldn't read the GitHub repo. Check the origin remote and your gh login.")
  }
  if (base) {
    await fetchBase(base, true)
    const workflows = await shAny("git", ["ls-tree", "--name-only", `origin/${base}`, ".github/workflows/"])
    for (const file of ["ci.yml", "claude-review.yml"])
      if (!workflows.out.split("\n").some((line) => line.endsWith(file)))
        problems.push(`.github/workflows/${file} isn't on ${base} yet, so nothing would check the PR.`)
    const secrets = await shAny("gh", ["secret", "list", "--json", "name"])
    const names = secrets.ok ? (JSON.parse(secrets.out || "[]") as { name: string }[]).map((s) => s.name) : []
    if (!names.includes("CLAUDE_CODE_OAUTH_TOKEN") && !names.includes("ANTHROPIC_API_KEY"))
      problems.push(
        "The Claude review needs a token. Run /install-github-app in Claude Code (or claude setup-token, then gh secret set CLAUDE_CODE_OAUTH_TOKEN)."
      )
  }
  const value = { ok: problems.length === 0, problems, repo, base }
  store.preflight = { at: Date.now(), value }
  return value
}

async function fetchBase(base: string, force = false) {
  if (!force && Date.now() - store.fetchedAt < 60_000) return
  await shAny("git", ["fetch", "--quiet", "origin", base])
  store.fetchedAt = Date.now()
}

// ── Status per system ─────────────────────────────────────────────────────

export type ShipStatus = "shipped" | "unshipped" | "unknown"

export async function statuses(ids: string[]): Promise<Record<string, ShipStatus>> {
  const check = await preflight()
  const result: Record<string, ShipStatus> = {}
  if (!check.base) {
    for (const id of ids) result[id] = "unknown"
    return result
  }
  await fetchBase(check.base)
  const remote = new Set(
    (await shAny("git", ["ls-tree", "--name-only", `origin/${check.base}`, "design-systems/"])).out
      .split("\n")
      .map((line) => line.replace(/^design-systems\//, ""))
      .filter(Boolean)
  )
  for (const id of new Set([...ids, ...remote])) {
    const dir = `design-systems/${id}`
    const local = existsSync(path.join(root, dir))
    if (local !== remote.has(id)) {
      result[id] = "unshipped"
      continue
    }
    const diff = await shAny("git", ["diff", "--quiet", `origin/${check.base}`, "--", dir])
    const untracked = (await shAny("git", ["ls-files", "--others", "--exclude-standard", "--", dir])).out
    result[id] = diff.ok && !untracked ? "shipped" : "unshipped"
  }
  return result
}

export function jobs() {
  return Object.fromEntries(store.jobs)
}

// ── The ship itself ────────────────────────────────────────────────────────

export function startShip(systemId: string, systemName: string, action: "ship" | "delete") {
  const current = store.jobs.get(systemId)
  if (current && (current.state === "running" || current.state === "checking"))
    throw new Error(`${systemName} is already shipping.`)
  const job: ShipJob = { systemId, systemName, action, state: "running", step: "Starting", log: [], startedAt: Date.now() }
  store.jobs.set(systemId, job)
  persist()
  void ship(job)
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function ship(job: ShipJob) {
  const branch = `ship/${job.systemId}`
  const worktree = path.join(shipDir, `worktree-${job.systemId}`)
  try {
    const check = await preflight(true)
    if (!check.ok || !check.base) throw new Error(check.problems.join(" "))
    const base = check.base

    step(job, `Preparing a clean copy of ${base}`)
    await shAny("git", ["worktree", "remove", "--force", worktree])
    rmSync(worktree, { recursive: true, force: true })
    await sh("git", ["fetch", "--quiet", "origin", base])
    await sh("git", ["worktree", "add", "--force", "-B", branch, worktree, `origin/${base}`])

    const dir = `design-systems/${job.systemId}`
    rmSync(path.join(worktree, dir), { recursive: true, force: true })
    if (job.action === "ship") {
      if (!existsSync(path.join(root, dir))) throw new Error(`${dir} doesn't exist. Save the system before shipping it.`)
      cpSync(path.join(root, dir), path.join(worktree, dir), { recursive: true })
    }

    step(job, "Building the registry")
    symlinkSync(path.join(root, "node_modules"), path.join(worktree, "node_modules"))
    await sh("npm", ["run", "--silent", "registry:build"], worktree, 300_000)

    await sh("git", ["add", "--all", "--", ...SHIP_PATHS], worktree)
    const staged = await shAny("git", ["diff", "--cached", "--quiet"], worktree)
    if (staged.ok) {
      await cleanup(worktree)
      finish(job, "nothing", { note: `${job.systemName} is already on ${base}. Nothing to ship.` })
      return
    }
    const verb = job.action === "delete" ? "Remove" : "Ship"
    await sh(
      "git",
      ["commit", "--quiet", "-m", `${verb} the ${job.systemName} design system`, "-m", "Shipped from the Unending catalog."],
      worktree
    )

    step(job, "Pushing")
    await sh("git", ["push", "--quiet", "--force", "-u", "origin", `${branch}:${branch}`], worktree)

    step(job, "Opening the pull request")
    const open = await sh("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "number,url"])
    let pr = (JSON.parse(open || "[]") as { number: number; url: string }[])[0]
    if (!pr) {
      const body = [
        job.action === "delete"
          ? `Removes the **${job.systemName}** design system (\`${dir}\`) and rebuilds the registry.`
          : `Ships the **${job.systemName}** design system (\`${dir}\`) and the registry built from it.`,
        "",
        "Opened by **Ship** in the Unending catalog. It merges itself once CI and the Claude review pass.",
      ].join("\n")
      const url = await sh("gh", [
        "pr",
        "create",
        "--base",
        base,
        "--head",
        branch,
        "--title",
        `${verb} ${job.systemName}`,
        "--body",
        body,
      ])
      pr = { url, number: Number(url.split("/").pop()) }
    }
    job.pr = pr
    await cleanup(worktree)

    job.state = "checking"
    step(job, "Waiting for CI and the Claude review")
    const started = Date.now()
    for (;;) {
      await sleep(10_000)
      const result = await shAny("gh", ["pr", "checks", String(pr.number), "--json", "name,bucket,link"])
      const checks = (result.out ? (JSON.parse(result.out) as ShipCheck[]) : []).filter((c) => c.bucket !== "skipping")
      job.checks = checks
      persist()
      if (!checks.length) {
        if (Date.now() - started > 4 * 60_000)
          throw new Error(`No checks started on PR #${pr.number}. Are the workflows on ${base}?`)
        continue
      }
      if (checks.some((c) => c.bucket === "fail" || c.bucket === "cancel")) {
        finish(job, "blocked", { findings: await reviewComment(pr.number), step: "Checks found problems" })
        return
      }
      if (checks.every((c) => c.bucket === "pass")) break
      if (Date.now() - started > 30 * 60_000) throw new Error(`Checks on PR #${pr.number} took longer than 30 minutes.`)
    }

    step(job, "Merging")
    await sh("gh", ["pr", "merge", String(pr.number), "--squash", "--delete-branch"])
    const note = await syncLocal(base)
    finish(job, "merged", { step: "Shipped", note, findings: await reviewComment(pr.number) })
  } catch (error) {
    await cleanup(worktree)
    finish(job, "failed", { error: (error as Error).message.split("\n").slice(0, 6).join("\n") })
  }
}

async function cleanup(worktree: string) {
  await shAny("git", ["worktree", "remove", "--force", worktree])
  rmSync(worktree, { recursive: true, force: true })
  await shAny("git", ["worktree", "prune"])
}

/** The Claude review's summary comment on the PR, if it left one. */
async function reviewComment(number: number) {
  const result = await shAny("gh", ["pr", "view", String(number), "--json", "comments"])
  if (!result.out) return undefined
  const comments = (JSON.parse(result.out) as { comments: { body: string }[] }).comments
  return [...comments].reverse().find((c) => /claude review/i.test(c.body.slice(0, 80)))?.body
}

/**
 * Brings the local default branch up to date when that's safe: you're on it
 * and your copies of the shipped files already match what was merged.
 */
async function syncLocal(base: string) {
  await shAny("git", ["fetch", "--quiet", "origin", base])
  store.fetchedAt = Date.now()
  const current = (await shAny("git", ["branch", "--show-current"])).out
  if (current !== base) return `Merged into ${base} on GitHub. You're on ${current || "a detached HEAD"}, so pull ${base} when you switch back.`
  const differs = !(await shAny("git", ["diff", "--quiet", `origin/${base}`, "--", ...SHIP_PATHS])).ok
  if (differs) return `Merged into ${base} on GitHub. Your local files have changed since, so pull ${base} yourself when ready.`
  // Local copies equal what was merged, but git won't fast-forward over them,
  // so set them aside, fast-forward, then drop them (or put them back if the
  // fast-forward fails). Only a stash this step made is ever touched.
  const top = async () => (await shAny("git", ["rev-parse", "-q", "--verify", "refs/stash"])).out
  const before = await top()
  await shAny("git", ["stash", "push", "--include-untracked", "--quiet", "-m", "unending ship sync", "--", ...SHIP_PATHS])
  const made = (await top()) !== before
  const merged = await shAny("git", ["merge", "--ff-only", "--quiet", `origin/${base}`])
  if (made) await shAny("git", ["stash", merged.ok ? "drop" : "pop", "--quiet"])
  return merged.ok
    ? `Merged into ${base}, and your local ${base} is up to date.`
    : `Merged into ${base} on GitHub, but your local ${base} couldn't fast-forward. Pull it yourself.`
}
