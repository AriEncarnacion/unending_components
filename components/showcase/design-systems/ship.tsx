"use client"

import * as React from "react"
import { CheckIcon, CircleIcon, DownloadIcon, KeyRoundIcon, RocketIcon, TriangleAlertIcon, Undo2Icon } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton } from "@/components/ui/code-block"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import type { Preflight, ShipJob, ShipOptions, ShipStatus } from "@/lib/ship/server"

import { useDesignSystems } from "./provider"

type Status = { status: ShipStatus; current?: number; latest?: number }
type ShipState = { ready?: Preflight; status: Record<string, Status>; jobs: Record<string, ShipJob> }
type SetupResult = { keyId: string; publicKey: string; keyFile: string }

const PULL_JOB = "__pull"

const ShipContext = React.createContext<{
  state: ShipState
  refresh: () => Promise<void>
  ship: (systemId: string, options?: ShipOptions) => Promise<boolean>
  rollback: (systemId: string, version: number) => Promise<boolean>
  pull: (force?: boolean) => Promise<boolean>
  setup: () => Promise<SetupResult | null>
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

/** Where each system stands against the registry, and any ship in progress. Polls while something runs. */
export function ShipProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ShipState>({ status: {}, jobs: {} })
  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch("/api/ship")
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
        if (job.state === "shipped") toast.success(job.action === "pull" ? "Pulled from the registry" : job.step, { description: job.note })
        if (job.state === "blocked") toast.error(`${job.systemName} didn't ship`, { description: job.step })
        if (job.state === "needs-allow") toast(`${job.systemName} needs your OK for new packages`, { description: "Open Ship to review them." })
        if (job.state === "failed") toast.error(`${job.systemName}: that didn't work`, { description: job.error })
      }
      previous.current[job.systemId] = job.state
    }
  }, [state.jobs])

  const after = React.useCallback(
    async (data: unknown) => {
      await refresh()
      return !!data
    },
    [refresh]
  )
  const value = React.useMemo(
    () => ({
      state,
      refresh,
      ship: async (systemId: string, options: ShipOptions = {}) => after(await post({ action: "ship", systemId, ...options })),
      rollback: async (systemId: string, version: number) => after(await post({ action: "rollback", systemId, version })),
      pull: async (force = false) => after(await post({ action: "pull", force })),
      setup: async () => {
        const data = await post({ action: "setup" })
        await refresh()
        return (data?.key as SetupResult) ?? null
      },
    }),
    [state, refresh, after]
  )
  return <ShipContext.Provider value={value}>{children}</ShipContext.Provider>
}

export function useShip() {
  const context = React.useContext(ShipContext)
  if (!context) throw new Error("useShip must be used inside ShipProvider")
  return context
}

function Copyable({ value }: { value: string }) {
  return (
    <CodeBlock size="sm">
      <CodeBlockActions>
        <CodeBlockCopyButton value={value} />
      </CodeBlockActions>
      <CodeBlockContent className="break-all whitespace-pre-wrap">{value}</CodeBlockContent>
    </CodeBlock>
  )
}

/** What a job is doing or did: steps, findings and what to do next. */
export function ShipProgress({
  job,
  onRetry,
  onAllow,
}: {
  job: ShipJob
  onRetry?: (options?: ShipOptions) => void
  onAllow?: (packages: string[]) => void
}) {
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
          <TriangleAlertIcon className={cn("size-4", job.state === "needs-allow" ? "text-warning" : "text-destructive")} />
        )}
        <span>{job.state === "failed" ? "That didn't work" : job.state === "nothing" ? "Nothing to ship" : job.step}</span>
      </div>
      {job.unknownPackages?.length ? (
        <div className="flex flex-col gap-2 text-xs">
          <p className="text-muted-foreground text-pretty">
            This version installs npm packages the registry hasn&apos;t allowed yet. Every app that installs it gets them, so check each one is
            what you expect.
          </p>
          <ul className="flex flex-col gap-0.5 font-mono">
            {job.unknownPackages.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {onAllow ? (
            <Button size="sm" onClick={() => onAllow(job.unknownPackages!)}>
              Allow and ship
            </Button>
          ) : null}
        </div>
      ) : null}
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
  if (job?.state === "blocked" || job?.state === "failed" || job?.state === "needs-allow")
    return <Badge variant="outline" className="text-destructive">Needs attention</Badge>
  if (!saved) return <Badge variant="outline">Not saved</Badge>
  const status = state.status[systemId]
  if (status?.status === "shipped") return <Badge variant="secondary">v{status.current}</Badge>
  if (status?.status === "older") return <Badge variant="outline">Serving v{status.current} of {status.latest}</Badge>
  if (status?.status === "changed") return <Badge variant="outline">Changed since v{status.latest}</Badge>
  if (status?.status === "behind") return <Badge variant="outline">Entries changed</Badge>
  if (status?.status === "unshipped") return <Badge variant="outline">Not shipped</Badge>
  return null
}

/** Makes this Mac's admin key, then says how to enrol it. */
function SetUpThisMac() {
  const { setup } = useShip()
  const [working, setWorking] = React.useState(false)
  const [made, setMade] = React.useState<SetupResult | null>(null)
  if (made)
    return (
      <div className="flex flex-col gap-2 text-xs">
        <span className="text-sm font-medium">This Mac has an admin key</span>
        <p className="text-muted-foreground text-pretty">
          Key {made.keyId}. Its private half stays in the Secure Enclave. Two steps before it can ship:
        </p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-muted-foreground text-pretty">
          <li>
            In the Cloudflare dashboard, open the unending-registry Worker&apos;s settings and add this public key to the{" "}
            <span className="font-mono">ADMIN_KEYS</span> secret (comma-separated). Remove any Mac you no longer have.
          </li>
          <li>
            It&apos;s also pinned in <span className="font-mono">plugin/keys.json</span>, so apps trust its releases. Merge that change in a PR.
          </li>
        </ol>
        <Copyable value={made.publicKey} />
      </div>
    )
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium">Set up this Mac</span>
      <p className="text-xs text-muted-foreground text-pretty">
        Shipping signs each upload with a key that lives in this Mac&apos;s Secure Enclave and asks for Touch ID every time. It can&apos;t be
        copied off this Mac, so each Mac gets its own.
      </p>
      <Button
        size="sm"
        disabled={working}
        onClick={async () => {
          setWorking(true)
          setMade(await setup())
          setWorking(false)
        }}
      >
        {working ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
        Make this Mac&apos;s key
      </Button>
    </div>
  )
}

/** Ship in the sidebar: saves if needed, then builds, signs (Touch ID) and uploads. */
export function ShipButton({ className }: { className?: string }) {
  const ds = useDesignSystems()
  const { state, ship, rollback } = useShip()
  const [open, setOpen] = React.useState(false)
  const [org, setOrg] = React.useState("")
  const [review, setReview] = React.useState(false)
  const active = ds.active
  if (!active) return null
  const id = active.system.id
  const job = state.jobs[id]
  const dirty = ds.systems.find((s) => s.id === id)?.dirty
  const status = state.status[id]
  const ready = state.ready
  const firstShip = !status || status.status === "unshipped"

  const go = async (options: ShipOptions = {}) => {
    if (dirty) {
      const saved = await ds.save()
      if (!saved.ok) {
        toast.error(saved.error, {
          description: saved.issues?.slice(0, 3).map((i) => `${i.where}: ${i.message}`).join("\n"),
        })
        return
      }
    }
    await ship(id, { review, ...(firstShip && org ? { org } : {}), ...options })
  }

  const versions = status?.latest ? Array.from({ length: status.latest }, (_, i) => status.latest! - i).filter((v) => v !== status.current) : []
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" variant={busy(job) ? "outline" : "default"} className={cn(className)} />}>
        {busy(job) ? <Spinner data-icon="inline-start" /> : <RocketIcon data-icon="inline-start" />}
        {busy(job) ? "Shipping" : "Ship"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {!ready ? (
          <p className="text-sm text-muted-foreground">Checking…</p>
        ) : ready.problems.length ? (
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Shipping isn&apos;t set up yet</span>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
              {ready.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : !ready.key ? (
          <SetUpThisMac />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground text-pretty">
              Ship builds {active.system.name}, signs it with this Mac&apos;s key (Touch ID) and uploads it to {ready.registry.replace(/^https:\/\//, "")}.
              Nothing goes through GitHub.
              {status?.status === "shipped" && !dirty ? ` The registry serves version ${status.current}, which matches what's saved here.` : ""}
              {status?.status === "older" ? ` The registry serves version ${status.current}; your latest is ${status.latest}. Serve v${status.latest} below to undo the rollback.` : ""}
              {status?.status === "behind" ? " The catalog's entries changed since it last shipped, so shipping again rebuilds them." : ""}
            </p>
            {!ready.key.pinned ? (
              <p className="text-xs text-warning text-pretty">
                This Mac&apos;s key ({ready.key.keyId}) isn&apos;t pinned in plugin/keys.json on this branch yet, so apps won&apos;t trust what it ships
                until that change is merged.
              </p>
            ) : null}
            {job ? (
              <ShipProgress
                job={job}
                onRetry={(options) => void go(options)}
                onAllow={(packages) => void go({ allow: packages })}
              />
            ) : null}
            {!busy(job) && job?.state !== "needs-allow" ? (
              <div className="flex flex-col gap-3 border-t pt-3">
                {firstShip ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ship-org" className="text-xs">
                      GitHub org that may read it
                    </Label>
                    <Input id="ship-org" value={org} onChange={(event) => setOrg(event.target.value.trim())} placeholder="org-login" />
                    <p className="text-xs text-muted-foreground text-pretty">
                      New systems are private to one org. Its active members get read-only tokens with /unending:login. If it already shipped
                      from another Mac, Pull first.
                    </p>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="ship-review" className="text-xs">
                    Review first with Claude
                  </Label>
                  <Switch id="ship-review" checked={review} onCheckedChange={setReview} disabled={!ready.claude} />
                </div>
                <Button size="sm" disabled={firstShip && !org} onClick={() => void go()}>
                  <RocketIcon data-icon="inline-start" />
                  Ship {active.system.name}
                </Button>
                {versions.length ? (
                  <div className="flex flex-col gap-1.5 border-t pt-3">
                    <span className="text-xs text-muted-foreground">Serve an earlier version instead (nothing is rebuilt):</span>
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

/** Pull on the home page: fetch every system's current source from the registry, verified. */
export function PullButton() {
  const { state, pull } = useShip()
  const [open, setOpen] = React.useState(false)
  const job = state.jobs[PULL_JOB]
  const ready = state.ready
  // Pulled files change what's saved here; reload so every page reads them.
  const was = React.useRef(job?.state)
  React.useEffect(() => {
    if (was.current === "running" && job?.state === "shipped" && /pulled version/.test(job.note ?? "")) window.location.reload()
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
            Fetches every design system&apos;s current version from the registry, checks each one&apos;s signature and files, and saves it here.
            Systems with saved changes that haven&apos;t shipped are left alone.
          </p>
          {job ? <ShipProgress job={job} /> : null}
          {!ready?.key ? (
            <p className="text-xs text-muted-foreground">Set up this Mac from Ship inside a system first.</p>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy(job)} onClick={() => void pull()}>
                <DownloadIcon data-icon="inline-start" />
                Pull
              </Button>
              <Button size="sm" variant="outline" disabled={busy(job)} onClick={() => void pull(true)}>
                Replace local changes
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
