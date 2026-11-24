"use client"

import * as React from "react"
import { CheckIcon, CircleIcon, DownloadIcon, GlobeIcon, LockIcon, RocketIcon, TriangleAlertIcon, Undo2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { NewRepo, Preflight, ShipJob, ShipOptions, SystemStatus } from "@/lib/ship/server"

import { Findings } from "./findings"
import { useDesignSystems } from "./provider"

type ShipState = { ready?: Preflight; status: Record<string, SystemStatus>; jobs: Record<string, ShipJob> }

const PULL_JOB = "__pull"

const ShipContext = React.createContext<{
  state: ShipState
  refresh: (fresh?: boolean) => Promise<void>
  ship: (systemId: string, options?: ShipOptions) => Promise<boolean>
  rollback: (systemId: string, version: number) => Promise<boolean>
  pull: () => Promise<boolean>
  cancel: (systemId: string) => Promise<boolean>
  seen: Record<string, number>
  acknowledge: (systemId: string) => void
} | null>(null)

const busy = (job?: ShipJob) => job?.state === "running"

async function post(body: unknown) {
  const response = await fetch("/api/ship", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null)
  const data = response ? await response.json().catch(() => ({})) : { error: "Couldn't reach the dev server." }
  if (!response?.ok) toast.error(data.error ?? "That didn't work.")
  return response?.ok ? data : null
}

export function ShipProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ShipState>({ status: {}, jobs: {} })
  const [seen, setSeen] = React.useState<Record<string, number>>({})
  const refresh = React.useCallback(async (fresh = false) => {
    try {
      const response = await fetch(`/api/ship${fresh ? "?refresh" : ""}`)
      if (response.ok) setState(await response.json())
    } catch {}
  }, [])

  const active = Object.values(state.jobs).some(busy)
  React.useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), active ? 1_500 : 60_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [refresh, active])

  const previous = React.useRef<Record<string, ShipJob["state"]>>({})
  React.useEffect(() => {
    for (const job of Object.values(state.jobs)) {
      const before = previous.current[job.systemId]
      if (before === "running" && job.state !== "running") {
        if (job.state === "shipped") toast.success(job.action === "pull" ? "Pulled design systems" : `${job.systemName}: ${job.step}`, { description: job.note })
        if (job.state === "blocked") toast.error(`${job.systemName} didn't ship`, { description: job.step })
        if (job.state === "failed") toast.error(`${job.systemName}: that didn't work`, { description: job.error })
        if (job.action === "rollback" && job.state === "shipped") window.setTimeout(() => window.location.reload(), 1200)
      }
      previous.current[job.systemId] = job.state
    }
  }, [state.jobs])

  const value = React.useMemo(
    () => ({
      state,
      refresh,
      ship: async (systemId: string, options: ShipOptions = {}) => {
        const data = await post({ action: "ship", systemId, ...options })
        await refresh()
        return !!data
      },
      rollback: async (systemId: string, version: number) => {
        const data = await post({ action: "rollback", systemId, version })
        await refresh()
        return !!data
      },
      pull: async () => {
        const data = await post({ action: "pull" })
        await refresh()
        return !!data
      },
      cancel: async (systemId: string) => {
        const data = await post({ action: "cancel", systemId })
        await refresh()
        return !!data
      },
      seen,
      acknowledge: (systemId: string) => {
        const finishedAt = state.jobs[systemId]?.finishedAt
        if (finishedAt) setSeen((current) => ({ ...current, [systemId]: finishedAt }))
      },
    }),
    [state, refresh, seen]
  )
  return <ShipContext.Provider value={value}>{children}</ShipContext.Provider>
}

export function useShip() {
  const context = React.useContext(ShipContext)
  if (!context) throw new Error("useShip must be used inside ShipProvider")
  return context
}

const blockedByReview = (job?: ShipJob) =>
  job?.state === "blocked" && (job.blockedBy === "review" || (!job.blockedBy && job.step.startsWith("The review")))

type View = "configure" | "running" | "result"

function viewOf(job: ShipJob | undefined, seenAt: number | undefined): View {
  if (busy(job)) return "running"
  if (job && job.action !== "pull" && job.state !== "cancelled" && job.finishedAt && job.finishedAt !== seenAt) return "result"
  return "configure"
}

function ResultTitle({ job }: { job: ShipJob }) {
  if (job.state === "shipped")
    return (
      <>
        <RocketIcon className="size-6 shrink-0 text-success" />
        Shipped v{job.version}
      </>
    )
  if (job.state === "nothing")
    return (
      <>
        <CircleIcon className="size-6 shrink-0 text-muted-foreground" />
        Nothing new to ship.
      </>
    )
  return (
    <>
      <TriangleAlertIcon className="size-6 shrink-0 text-destructive" />
      {blockedByReview(job) ? "The review blocked this ship." : job.state === "blocked" ? "The build found problems." : "That didn't work."}
    </>
  )
}

function RepoLink({ repo, url, visibility }: { repo: string; url: string; visibility?: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group/repo flex w-fit items-center gap-2 text-sm">
      <span className="truncate font-mono underline decoration-foreground/40 underline-offset-3 group-hover/repo:decoration-foreground">{repo}</span>
      {visibility ? <Badge variant="outline">{visibility}</Badge> : null}
    </a>
  )
}

export function ShipBadge({ systemId, saved }: { systemId: string; saved: boolean }) {
  const { state } = useShip()
  const job = state.jobs[systemId]
  if (busy(job)) return <Badge variant="outline"><Spinner />Shipping</Badge>
  if (job?.state === "blocked" || job?.state === "failed") return <Badge variant="outline" className="text-destructive">Needs attention</Badge>
  if (!saved) return <Badge variant="outline">Not saved</Badge>
  const status = state.status[systemId]
  if (status?.status === "shipped") return <Badge variant="secondary">v{status.version}</Badge>
  if (status?.status === "changed") return <Badge variant="outline">{status.version ? `Changed since v${status.version}` : "Not shipped"}</Badge>
  if (status?.status === "behind") return <Badge variant="outline">Entries changed</Badge>
  if (status?.status === "unshipped") return <Badge variant="outline">Not shipped</Badge>
  return null
}

function NewRepoFields({ id, owners, value, onChange }: { id: string; owners: string[]; value: NewRepo; onChange: (next: NewRepo) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Owner</Label>
        <Select value={value.owner} onValueChange={(owner) => onChange({ ...value, owner: String(owner) })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {owners.map((owner) => (
              <SelectItem key={owner} value={owner}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`repo-${id}`} className="text-xs">
          Repo name
        </Label>
        <Input id={`repo-${id}`} value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value.trim() })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Visibility</Label>
        <ToggleGroup
          variant="outline"
          value={[value.visibility]}
          onValueChange={(next: string[]) => next[0] && onChange({ ...value, visibility: next[0] as NewRepo["visibility"] })}
        >
          <ToggleGroupItem value="private">
            <LockIcon />
            Private
          </ToggleGroupItem>
          <ToggleGroupItem value="public">
            <GlobeIcon />
            Public
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}

export function useShipping() {
  const ds = useDesignSystems()
  const { state } = useShip()
  return busy(state.jobs[ds.active?.system.id ?? ""])
}

export function ShipDialogContent({ onDone }: { onDone: () => void }) {
  const ds = useDesignSystems()
  const { state, ship, rollback, cancel, seen, acknowledge } = useShip()
  const [review, setReview] = React.useState(false)
  const active = ds.active
  const id = active?.system.id ?? ""
  const owners = state.ready?.owners ?? []
  const [create, setCreate] = React.useState<NewRepo>({ owner: "", name: `${id}-design-system`, visibility: "private" })
  if (!active) return null
  const job = state.jobs[id]
  const view = viewOf(job, seen[id])
  const dirty = ds.systems.find((s) => s.id === id)?.dirty
  const status = state.status[id]
  const ready = state.ready
  const firstShip = !status || status.status === "unshipped"
  const target = { ...create, owner: create.owner || owners[0] || "" }

  const go = async (options: ShipOptions = {}) => {
    if (dirty) {
      const saved = await ds.save()
      if (!saved.ok) {
        toast.error(saved.error, { description: saved.issues?.slice(0, 3).map((i) => `${i.where}: ${i.message}`).join("\n") })
        return
      }
    }
    await ship(id, { review, ...(firstShip ? { create: target } : {}), ...options })
  }

  const done = () => {
    acknowledge(id)
    onDone()
  }

  const versions = status?.version ? Array.from({ length: status.version - 1 }, (_, i) => status.version! - 1 - i) : []
  const reviewed = blockedByReview(job)
  const repo = status?.repo ?? (job?.url ? { repo: job.url.replace("https://github.com/", ""), url: job.url, visibility: undefined } : undefined)

  return (
    <>
      <DialogHeader className="flex-row items-center justify-between gap-4">
        <DialogTitle className="flex min-w-0 items-center gap-2.5 text-2xl leading-8 font-semibold tracking-tight">
          {view === "result" && job ? <ResultTitle job={job} /> : `Ship ${active.system.name}`}
        </DialogTitle>
        {view !== "running" ? (
          <DialogClose render={<Button variant="ghost" size="icon-sm" />}>
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogClose>
        ) : null}
      </DialogHeader>

      {view === "running" && job ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-medium">
            <Spinner />
            {job.step}
          </div>
          {job.action === "ship" && job.cancellable ? (
            <Button variant="outline" onClick={() => void cancel(id)}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}

      {view === "result" && job ? (
        <>
          {job.state === "shipped" && repo ? <RepoLink {...repo} /> : null}
          {job.findings ? (
            <Findings
              text={job.findings}
              format={job.state === "blocked" && !reviewed ? "log" : "markdown"}
              copyText={
                reviewed
                  ? `Claude reviewed the ${job.systemName} design system before shipping it and asked for these changes:\n\n${job.findings}`
                  : job.findings
              }
            />
          ) : null}
          {job.error ? <p className="whitespace-pre-wrap text-destructive">{job.error}</p> : null}
          {reviewed ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void go({ review: true })}>
                <RocketIcon data-icon="inline-start" />
                Review again
              </Button>
              <Button variant="outline" onClick={() => void go({ review: false })}>
                Ship without the review
              </Button>
            </div>
          ) : job.action === "ship" && (job.state === "blocked" || job.state === "failed") ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void go()}>
                <RocketIcon data-icon="inline-start" />
                Try again
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button onClick={done}>Done</Button>
            </div>
          )}
        </>
      ) : null}

      {view === "configure" ? (
        !ready ? (
          <p className="text-muted-foreground">Checking GitHub…</p>
        ) : ready.problems.length ? (
          <div className="flex flex-col gap-2">
            <span className="font-medium">Shipping isn&apos;t set up yet</span>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
              {ready.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {!firstShip && repo ? <RepoLink {...repo} /> : null}
            {firstShip ? <NewRepoFields id={id} owners={owners} value={target} onChange={setCreate} /> : null}
            {versions.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium">Roll back to</span>
                {versions.slice(0, 8).map((version) => (
                  <Button key={version} size="xs" variant="outline" onClick={() => void rollback(id, version)}>
                    <Undo2Icon data-icon="inline-start" />v{version}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="ship-review" className="text-xs">
                  Review first with Claude
                </Label>
                <Switch id="ship-review" checked={review} onCheckedChange={setReview} disabled={!ready.claude} />
              </div>
              <Button disabled={firstShip && (!target.owner || !target.name)} onClick={() => void go()}>
                <RocketIcon data-icon="inline-start" />
                {firstShip ? "Create the repo and ship v1" : `Ship ${active.system.name}`}
              </Button>
            </div>
          </>
        )
      ) : null}
    </>
  )
}

function PullProgress({ job }: { job: ShipJob }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-center gap-2 font-medium">
        {busy(job) ? <Spinner /> : job.state === "failed" ? <TriangleAlertIcon className="size-4 text-destructive" /> : <CheckIcon className="size-4 text-success" />}
        {job.state === "failed" ? "That didn't work" : job.step}
      </div>
      {job.error ? <p className="text-xs whitespace-pre-wrap text-destructive">{job.error}</p> : null}
      {job.note ? <p className="text-xs whitespace-pre-wrap text-muted-foreground text-pretty">{job.note}</p> : null}
    </div>
  )
}

export function PullButton() {
  const { state, pull } = useShip()
  const [open, setOpen] = React.useState(false)
  const job = state.jobs[PULL_JOB]
  const was = React.useRef(job?.state)
  React.useEffect(() => {
    if (was.current === "running" && job?.state === "shipped" && /cloned|up to date/.test(job.note ?? "")) window.location.reload()
    was.current = job?.state
  }, [job?.state, job?.note])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" variant="outline" />}>
        {busy(job) ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
        Pull
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground text-pretty">
            Finds every design-system repo you or your orgs own (tagged unending-design-system on GitHub), clones the ones missing here and
            updates the rest. Systems with changes that haven&apos;t shipped are left alone.
          </p>
          {job ? <PullProgress job={job} /> : null}
          <Button size="sm" disabled={busy(job)} onClick={() => void pull()}>
            <DownloadIcon data-icon="inline-start" />
            Pull
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
