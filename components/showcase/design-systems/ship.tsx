"use client"

import * as React from "react"
import { CheckIcon, CircleIcon, ExternalLinkIcon, RocketIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import type { Preflight, ShipJob, ShipStatus } from "@/lib/ship/server"

import { useDesignSystems } from "./provider"

type ShipState = { ready?: Preflight; status: Record<string, ShipStatus>; jobs: Record<string, ShipJob> }

const ShipContext = React.createContext<{
  state: ShipState
  refresh: (fresh?: boolean) => Promise<void>
  ship: (systemId: string, action?: "ship" | "delete", name?: string) => Promise<boolean>
} | null>(null)

const busy = (job?: ShipJob) => job?.state === "running" || job?.state === "checking"

/** Where each system stands on GitHub, and any ship in progress. Polls while something is shipping. */
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
    const timer = window.setInterval(() => void refresh(), active ? 3_000 : 60_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [refresh, active])

  // Announce a ship finishing, wherever you are in the catalog.
  const previous = React.useRef<Record<string, ShipJob["state"]>>({})
  React.useEffect(() => {
    for (const job of Object.values(state.jobs)) {
      const before = previous.current[job.systemId]
      if (before && before !== job.state) {
        if (job.state === "merged") toast.success(`Shipped ${job.systemName}`, { description: job.note })
        if (job.state === "blocked") toast.error(`${job.systemName} didn't ship`, { description: "The checks found problems. Open Ship to see them." })
        if (job.state === "failed") toast.error(`Shipping ${job.systemName} failed`, { description: job.error })
      }
      previous.current[job.systemId] = job.state
    }
  }, [state.jobs])

  const ship = React.useCallback(
    async (systemId: string, action: "ship" | "delete" = "ship", name?: string) => {
      const response = await fetch("/api/ship", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ systemId, action, name }),
      }).catch(() => null)
      const data = response ? await response.json().catch(() => ({})) : { error: "Couldn't reach the dev server." }
      if (!response?.ok) {
        toast.error(data.error ?? "Couldn't start shipping.")
        return false
      }
      await refresh()
      return true
    },
    [refresh]
  )

  return <ShipContext.Provider value={{ state, refresh, ship }}>{children}</ShipContext.Provider>
}

export function useShip() {
  const context = React.useContext(ShipContext)
  if (!context) throw new Error("useShip must be used inside ShipProvider")
  return context
}

const checkIcon = (bucket: string) =>
  bucket === "pass" ? (
    <CheckIcon className="text-success" />
  ) : bucket === "fail" || bucket === "cancel" ? (
    <XIcon className="text-destructive" />
  ) : (
    <Spinner />
  )

/** What a ship is doing or did: steps, the PR, its checks and the review's findings. */
export function ShipProgress({ job, onRetry }: { job: ShipJob; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        {busy(job) ? <Spinner /> : job.state === "merged" ? <CheckIcon className="size-4 text-success" /> : job.state === "nothing" ? <CircleIcon className="size-4 text-muted-foreground" /> : <TriangleAlertIcon className="size-4 text-destructive" />}
        <span>
          {job.state === "merged"
            ? "Shipped"
            : job.state === "blocked"
              ? "Not shipped: the checks found problems"
              : job.state === "failed"
                ? "Shipping failed"
                : job.state === "nothing"
                  ? "Nothing to ship"
                  : job.step}
        </span>
      </div>
      {job.pr ? (
        <a href={job.pr.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
          Pull request #{job.pr.number}
          <ExternalLinkIcon className="size-3" />
        </a>
      ) : null}
      {job.checks?.length ? (
        <ul className="flex flex-col gap-1 text-xs">
          {job.checks.map((check) => (
            <li key={check.name} className="flex items-center gap-1.5 [&_svg]:size-3.5">
              {checkIcon(check.bucket)}
              {check.link ? (
                <a href={check.link} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  {check.name}
                </a>
              ) : (
                check.name
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {job.findings && job.state !== "merged" ? (
        <div className="max-h-48 overflow-y-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">{job.findings}</div>
      ) : null}
      {job.error ? <p className="text-xs text-destructive whitespace-pre-wrap">{job.error}</p> : null}
      {job.note ? <p className="text-xs text-muted-foreground text-pretty">{job.note}</p> : null}
      {!busy(job) ? (
        <ol className="flex flex-col gap-0.5 border-t pt-2 text-xs text-muted-foreground">
          {job.log.map((entry) => (
            <li key={entry.at}>{entry.text}</li>
          ))}
        </ol>
      ) : null}
      {onRetry && (job.state === "blocked" || job.state === "failed") ? (
        <Button size="sm" onClick={onRetry}>
          <RocketIcon data-icon="inline-start" />
          Ship again
        </Button>
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
  if (status === "shipped") return <Badge variant="secondary">Shipped</Badge>
  if (status === "unshipped") return <Badge variant="outline">Not shipped</Badge>
  return null
}

/** Ship in the sidebar: saves if needed, then runs the PR, review and merge. */
export function ShipButton({ className }: { className?: string }) {
  const ds = useDesignSystems()
  const { state, ship } = useShip()
  const [open, setOpen] = React.useState(false)
  const active = ds.active
  if (!active) return null
  const id = active.system.id
  const job = state.jobs[id]
  const dirty = ds.systems.find((s) => s.id === id)?.dirty
  const status = state.status[id]
  const ready = state.ready

  const go = async () => {
    if (dirty) {
      const saved = await ds.save()
      if (!saved.ok) {
        toast.error(saved.error, {
          description: saved.issues?.slice(0, 3).map((i) => `${i.where}: ${i.message}`).join("\n"),
        })
        return
      }
    }
    setOpen(true)
    await ship(id)
  }

  const label = busy(job) ? "Shipping" : "Ship"
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant={busy(job) ? "outline" : "default"}
            className={cn(className)}
            onClick={(event) => {
              // With nothing to show yet, the click ships; otherwise it opens the status.
              if (ready?.ok && !busy(job) && job?.state !== "blocked" && job?.state !== "failed") {
                event.preventDefault()
                void go()
              }
            }}
          />
        }
      >
        {busy(job) ? <Spinner data-icon="inline-start" /> : <RocketIcon data-icon="inline-start" />}
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {!ready ? (
          <p className="text-sm text-muted-foreground">Checking GitHub…</p>
        ) : !ready.ok ? (
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
            <p className="text-xs text-muted-foreground text-pretty">
              Ship saves {active.system.name}, opens a pull request on {ready.base} with the system and the registry built from it,
              and merges it once CI and the Claude review pass.
              {status === "shipped" && !dirty ? " It matches what's on GitHub right now." : ""}
            </p>
            {job ? <ShipProgress job={job} onRetry={() => void go()} /> : null}
            {!busy(job) && job?.state !== "blocked" && job?.state !== "failed" ? (
              <Button size="sm" onClick={() => void go()}>
                <RocketIcon data-icon="inline-start" />
                Ship {active.system.name}
              </Button>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
