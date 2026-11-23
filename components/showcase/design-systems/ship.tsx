"use client"

import * as React from "react"
import { CheckIcon, CircleIcon, DownloadIcon, ExternalLinkIcon, RocketIcon, TriangleAlertIcon, Undo2Icon } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { NewRepo, Preflight, ShipJob, ShipOptions, SystemStatus } from "@/lib/ship/server"

import { useDesignSystems } from "./provider"

type ShipState = { ready?: Preflight; status: Record<string, SystemStatus>; jobs: Record<string, ShipJob> }

const PULL_JOB = "__pull"

const ShipContext = React.createContext<{
  state: ShipState
  refresh: (fresh?: boolean) => Promise<void>
  ship: (systemId: string, options?: ShipOptions) => Promise<boolean>
  rollback: (systemId: string, version: number) => Promise<boolean>
  pull: () => Promise<boolean>
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

/** Where each system stands against its GitHub repo, and any job in progress. Polls while something runs. */
export function ShipProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ShipState>({ status: {}, jobs: {} })
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

  // Announce a job finishing, wherever you are in the catalog.
  const previous = React.useRef<Record<string, ShipJob["state"]>>({})
  React.useEffect(() => {
    for (const job of Object.values(state.jobs)) {
      const before = previous.current[job.systemId]
      if (before === "running" && job.state !== "running") {
        if (job.state === "shipped") toast.success(job.action === "pull" ? "Pulled design systems" : `${job.systemName}: ${job.step}`, { description: job.note })
        if (job.state === "blocked") toast.error(`${job.systemName} didn't ship`, { description: job.step })
        if (job.state === "failed") toast.error(`${job.systemName}: that didn't work`, { description: job.error })
        // A rollback rewrites the saved files on disk; reload so every page reads them.
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
    }),
    [state, refresh]
  )
  return <ShipContext.Provider value={value}>{children}</ShipContext.Provider>
}

export function useShip() {
  const context = React.useContext(ShipContext)
  if (!context) throw new Error("useShip must be used inside ShipProvider")
  return context
}

/** What a job is doing or did: steps, findings and what to do next. */
export function ShipProgress({ job, onRetry }: { job: ShipJob; onRetry?: (options?: ShipOptions) => void }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        {busy(job) ? (
          <Spinner />
        ) : job.state === "shipped" ? (
          <CheckIcon className="size-4 text-success" />
        ) : job.state === "nothing" ? (
          <CircleIcon className="size-4 text-muted-foreground" />
        ) : (
          <TriangleAlertIcon className="size-4 text-destructive" />
        )}
        <span>{job.state === "failed" ? "That didn't work" : job.state === "nothing" ? "Nothing to ship" : job.step}</span>
      </div>
      {job.findings ? (
        <div className="max-h-48 overflow-y-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">{job.findings}</div>
      ) : null}
      {job.error ? <p className="text-xs whitespace-pre-wrap text-destructive">{job.error}</p> : null}
      {job.note ? <p className="text-xs whitespace-pre-wrap text-muted-foreground text-pretty">{job.note}</p> : null}
      {!busy(job) && job.log.length ? (
        <ol className="flex flex-col gap-0.5 border-t pt-2 text-xs text-muted-foreground">
          {job.log.map((entry) => (
            <li key={entry.at}>{entry.text}</li>
          ))}
        </ol>
      ) : null}
      {onRetry && job.action === "ship" && (job.state === "blocked" || job.state === "failed") ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onRetry()}>
            <RocketIcon data-icon="inline-start" />
            Ship again
          </Button>
          {job.step.startsWith("The review") ? (
            <Button size="sm" variant="outline" onClick={() => onRetry({ review: false })}>
              Ship without the review
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
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

/** Where a system's first ship creates its repo. */
function NewRepoFields({ id, owners, value, onChange }: { id: string; owners: string[]; value: NewRepo; onChange: (next: NewRepo) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Owner</Label>
        <Select value={value.owner} onValueChange={(owner) => onChange({ ...value, owner: String(owner) })}>
          <SelectTrigger size="sm" className="w-full">
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
          size="sm"
          value={[value.visibility]}
          onValueChange={(next: string[]) => next[0] && onChange({ ...value, visibility: next[0] as NewRepo["visibility"] })}
        >
          <ToggleGroupItem value="private">Private</ToggleGroupItem>
          <ToggleGroupItem value="public">Public</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground text-pretty">
          {value.visibility === "private"
            ? "Only people who can read the repo can install it. For an org's design system, put it in that org."
            : "Anyone on the internet can install it."}{" "}
          Change it later in the repo&apos;s settings on GitHub.
        </p>
      </div>
    </div>
  )
}

/** Ship in the sidebar: saves if needed, then builds, commits, tags and pushes to the system's repo. */
export function ShipButton({ className }: { className?: string }) {
  const ds = useDesignSystems()
  const { state, ship, rollback } = useShip()
  const [open, setOpen] = React.useState(false)
  const [review, setReview] = React.useState(false)
  const active = ds.active
  const id = active?.system.id ?? ""
  const owners = state.ready?.owners ?? []
  const [create, setCreate] = React.useState<NewRepo>({ owner: "", name: `${id}-design-system`, visibility: "private" })
  if (!active) return null
  const job = state.jobs[id]
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

  const versions = status?.version ? Array.from({ length: status.version - 1 }, (_, i) => status.version! - 1 - i) : []
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" variant={busy(job) ? "outline" : "default"} className={cn(className)} />}>
        {busy(job) ? <Spinner data-icon="inline-start" /> : <RocketIcon data-icon="inline-start" />}
        {busy(job) ? "Shipping" : "Ship"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {!ready ? (
          <p className="text-sm text-muted-foreground">Checking GitHub…</p>
        ) : ready.problems.length ? (
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Shipping isn&apos;t set up yet</span>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
              {ready.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {status?.repo ? (
              <a
                href={status.repo.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                <span className="truncate font-mono">{status.repo.repo}</span>
                <Badge variant="outline">{status.repo.visibility}</Badge>
                <ExternalLinkIcon className="size-3 shrink-0" />
              </a>
            ) : null}
            <p className="text-xs text-muted-foreground text-pretty">
              {firstShip
                ? `Ship creates ${active.system.name}'s own GitHub repo, builds the system into it as a shadcn registry and tags v1.`
                : `Ship builds ${active.system.name}, commits it to its repo and tags the next version.`}
              {status?.status === "shipped" && !dirty ? ` v${status.version} matches what's saved here.` : ""}
              {status?.status === "behind" ? " The catalog's entries changed since it last shipped, so shipping again rebuilds them." : ""}
            </p>
            {job ? <ShipProgress job={job} onRetry={(options) => void go(options)} /> : null}
            {!busy(job) ? (
              <div className="flex flex-col gap-3 border-t pt-3">
                {firstShip ? <NewRepoFields id={id} owners={owners} value={target} onChange={setCreate} /> : null}
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="ship-review" className="text-xs">
                    Review first with Claude
                  </Label>
                  <Switch id="ship-review" checked={review} onCheckedChange={setReview} disabled={!ready.claude} />
                </div>
                <Button size="sm" disabled={firstShip && (!target.owner || !target.name)} onClick={() => void go()}>
                  <RocketIcon data-icon="inline-start" />
                  {firstShip ? "Create the repo and ship v1" : `Ship ${active.system.name}`}
                </Button>
                {versions.length ? (
                  <div className="flex flex-col gap-1.5 border-t pt-3">
                    <span className="text-xs text-muted-foreground text-pretty">
                      Roll back: ship v{status!.version! + 1} with an earlier version&apos;s files. Apps pinned to a version keep it.
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {versions.slice(0, 8).map((version) => (
                        <Button key={version} size="xs" variant="outline" onClick={() => void rollback(id, version)}>
                          <Undo2Icon data-icon="inline-start" />v{version}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Pull on the home page: clone or update every design-system repo you or your orgs own. */
export function PullButton() {
  const { state, pull } = useShip()
  const [open, setOpen] = React.useState(false)
  const job = state.jobs[PULL_JOB]
  // Pulled files change what's saved here; reload so every page reads them.
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
          {job ? <ShipProgress job={job} /> : null}
          <Button size="sm" disabled={busy(job)} onClick={() => void pull()}>
            <DownloadIcon data-icon="inline-start" />
            Pull
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
