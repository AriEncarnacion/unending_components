"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  emptyEntryTuning,
  idPattern,
  isEmptyTuning,
  serialize,
  reservedSystemIds,
  STOCK_ID,
  type Committed,
  type Draft,
  type EntryTuningFile,
  type Origin,
  type ProposalFile,
  type SystemFile,
  type Working,
} from "@/lib/design-systems/schema"
import { seedKeys, seedScales, slug } from "@/lib/palette"

const DRAFT_PREFIX = "unending:draft:"
const LIMIT = 100
const MERGE_MS = 800

export const stockPalette: SystemFile["palette"] = { scales: seedScales, keys: seedKeys }

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function newSystem(id: string, name: string, origin: Origin): SystemFile {
  return { version: 1, id, name, origin, tokens: { light: {}, dark: {}, theme: {} }, palette: clone(stockPalette) }
}

export type CreateFrom =
  | { kind: "stock"; build?: (system: SystemFile) => SystemFile }
  | { kind: "duplicate"; from: string }
  | { kind: "preset"; preset: string; build: (system: SystemFile) => SystemFile }

type History = { past: Working[]; future: Working[] }

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string; issues?: { where: string; message: string }[]; conflict?: boolean }

export type SystemSummary = { id: string; name: string; saved: boolean; dirty: boolean }

type Api = {
  restored: boolean
  committed: Committed[]
  systems: SystemSummary[]
  activeId: string
  active: Working | null
  workingFor: (id: string) => Working | null
  missing: boolean
  readOnly: boolean
  update: (recipe: (working: Working) => Working, mergeKey?: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  select: (id: string) => void
  href: (path?: string) => string
  create: (name: string, start: CreateFrom) => string
  rename: (name: string) => void
  renameSystem: (id: string, name: string) => void
  remove: (id: string) => Promise<SaveResult>
  discard: (id: string) => void
  save: (force?: boolean) => Promise<SaveResult>
  committedFor: (id: string) => Committed | undefined
  proposals: Record<string, ProposalFile>
  acceptProposal: (entry: string) => Promise<SaveResult>
  rejectProposal: (entry: string) => Promise<SaveResult>
  setReadOnlyHandler: (handler: (() => void) | null) => void
  uniqueName: (base: string) => string
}

const Context = React.createContext<Api | null>(null)

export function useDesignSystems() {
  const api = React.useContext(Context)
  if (!api) throw new Error("useDesignSystems must be used inside DesignSystemsProvider")
  return api
}

function readDrafts(): Record<string, Draft> {
  const drafts: Record<string, Draft> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      const draft = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null
      if (draft?.version === 1 && draft.system?.id) drafts[draft.system.id] = draft
    }
  } catch {}
  return drafts
}

const noDrafts: Record<string, Draft> = {}
const draftListeners = new Set<() => void>()
let draftCache: Record<string, Draft> | null = null

function draftSnapshot() {
  draftCache ??= readDrafts()
  return draftCache
}

function emitDrafts() {
  for (const listener of draftListeners) listener()
}

function onDraftStorage(event: StorageEvent) {
  if (event.key !== null && !event.key.startsWith(DRAFT_PREFIX)) return
  draftCache = readDrafts()
  emitDrafts()
}

function subscribeDrafts(listener: () => void) {
  if (!draftListeners.size) window.addEventListener("storage", onDraftStorage)
  draftListeners.add(listener)
  return () => {
    draftListeners.delete(listener)
    if (draftListeners.size) return
    window.removeEventListener("storage", onDraftStorage)
    draftCache = null
  }
}

function setDraft(id: string, draft: Draft | null) {
  const next = { ...draftSnapshot() }
  if (draft) next[id] = draft
  else delete next[id]
  draftCache = next
  try {
    if (draft) localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(draft))
    else localStorage.removeItem(DRAFT_PREFIX + id)
  } catch {}
  emitDrafts()
}

const same = (a: Working, b: Working) => serialize({ s: a.system, e: a.entries }) === serialize({ s: b.system, e: b.entries })

function tidy(working: Working): Working {
  const entries = Object.fromEntries(Object.entries(working.entries).filter(([, tuning]) => !isEmptyTuning(tuning)))
  return Object.keys(entries).length === Object.keys(working.entries).length ? working : { ...working, entries }
}

export function DesignSystemsProvider({
  initial,
  activeId = STOCK_ID,
  children,
}: {
  initial: Committed[]
  activeId?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [committed, setCommitted] = React.useState(initial)
  const stored = React.useSyncExternalStore(subscribeDrafts, draftSnapshot, () => null)
  const restored = stored !== null
  const drafts = stored ?? noDrafts
  const [histories, setHistories] = React.useState<Record<string, History>>({})
  const last = React.useRef<{ key?: string; at: number }>({ at: 0 })
  const onReadOnlyEdit = React.useRef<(() => void) | null>(null)
  const setReadOnlyHandler = React.useCallback((handler: (() => void) | null) => {
    onReadOnlyEdit.current = handler
  }, [])

  const committedFor = React.useCallback((id: string) => committed.find((c) => c.system.id === id), [committed])

  const workingFor = React.useCallback(
    (id: string): Working | null => {
      if (id === STOCK_ID) return null
      const draft = drafts[id]
      if (draft) return { system: draft.system, entries: draft.entries }
      const saved = committedFor(id)
      return saved ? { system: saved.system, entries: saved.entries } : null
    },
    [drafts, committedFor]
  )

  const resolvedActiveId = activeId
  const active = workingFor(activeId)
  const missing = activeId !== STOCK_ID && !active

  const select = React.useCallback(
    (id: string) => {
      last.current = { at: 0 }
      router.push(`/${id}/system`)
    },
    [router]
  )
  const href = React.useCallback((path = "") => `/${activeId}${path}`, [activeId])

  const putWorking = React.useCallback(
    (id: string, working: Working, savedHash?: string) => {
      const saved = committedFor(id)
      if (saved && same(saved, working)) {
        setDraft(id, null)
        return
      }
      setDraft(id, {
        version: 1,
        savedHash: savedHash ?? draftSnapshot()[id]?.savedHash ?? saved?.hash ?? "",
        system: working.system,
        entries: working.entries,
      })
    },
    [committedFor]
  )

  const update = React.useCallback(
    (recipe: (working: Working) => Working, mergeKey?: string) => {
      if (!active) {
        onReadOnlyEdit.current?.()
        return
      }
      const next = tidy(recipe(active))
      if (next === active || same(next, active)) return
      const now = Date.now()
      const merge = mergeKey !== undefined && last.current.key === mergeKey && now - last.current.at < MERGE_MS
      last.current = { key: mergeKey, at: now }
      const id = active.system.id
      setHistories((h) => {
        const history = h[id] ?? { past: [], future: [] }
        return {
          ...h,
          [id]: { past: merge ? history.past : [...history.past.slice(-LIMIT + 1), active], future: [] },
        }
      })
      putWorking(id, next)
    },
    [active, putWorking]
  )

  const activeKey = active?.system.id
  const history = React.useMemo<History>(
    () => (activeKey ? (histories[activeKey] ?? { past: [], future: [] }) : { past: [], future: [] }),
    [activeKey, histories]
  )

  const undo = React.useCallback(() => {
    if (!active || !history.past.length) return
    const id = active.system.id
    const previous = history.past[history.past.length - 1]
    last.current = { at: 0 }
    setHistories((h) => ({ ...h, [id]: { past: history.past.slice(0, -1), future: [active, ...history.future] } }))
    putWorking(id, previous)
  }, [active, history, putWorking])

  const redo = React.useCallback(() => {
    if (!active || !history.future.length) return
    const id = active.system.id
    const next = history.future[0]
    last.current = { at: 0 }
    setHistories((h) => ({ ...h, [id]: { past: [...history.past, active], future: history.future.slice(1) } }))
    putWorking(id, next)
  }, [active, history, putWorking])

  const ids = React.useMemo(() => {
    const all = new Set([...committed.map((c) => c.system.id), ...Object.keys(drafts)])
    return [...all]
  }, [committed, drafts])

  const systems: SystemSummary[] = React.useMemo(
    () =>
      ids
        .map((id) => {
          const working = workingFor(id)!
          return { id, name: working.system.name, saved: !!committedFor(id), dirty: !!drafts[id] }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [ids, workingFor, committedFor, drafts]
  )

  const uniqueName = React.useCallback(
    (base: string) => {
      const names = new Set(systems.map((s) => s.name.toLowerCase()))
      let name = base
      for (let n = 2; names.has(name.toLowerCase()); n++) name = `${base} ${n}`
      return name
    },
    [systems]
  )

  const uniqueId = React.useCallback(
    (name: string) => {
      const base = slug(name) || "system"
      const taken = new Set([...ids, ...reservedSystemIds])
      let id = idPattern.test(base) ? base : "system"
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
      return id
    },
    [ids]
  )

  const create: Api["create"] = React.useCallback(
    (name, start) => {
      const id = uniqueId(name)
      let working: Working
      if (start.kind === "duplicate") {
        const source = start.from === STOCK_ID ? null : workingFor(start.from)
        working = source
          ? { system: { ...clone(source.system), id, name, origin: { kind: "duplicate", from: start.from } }, entries: clone(source.entries) }
          : { system: newSystem(id, name, { kind: "stock" }), entries: {} }
      } else if (start.kind === "preset") {
        working = { system: start.build(newSystem(id, name, { kind: "preset", preset: start.preset })), entries: {} }
      } else {
        const system = newSystem(id, name, { kind: "stock" })
        working = { system: start.build ? start.build(system) : system, entries: {} }
      }
      putWorking(id, working, "")
      return id
    },
    [uniqueId, workingFor, putWorking]
  )

  const rename = React.useCallback(
    (name: string) => update((w) => ({ ...w, system: { ...w.system, name: name.trim() || w.system.name } }), "rename"),
    [update]
  )

  const renameSystem = React.useCallback(
    (id: string, name: string) => {
      const working = workingFor(id)
      if (!working || !name.trim()) return
      putWorking(id, { ...working, system: { ...working.system, name: name.trim() } })
    },
    [workingFor, putWorking]
  )

  const discard = React.useCallback(
    (id: string) => {
      setDraft(id, null)
      setHistories((h) => ({ ...h, [id]: { past: [], future: [] } }))
    },
    []
  )

  const post = React.useCallback(async (body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> => {
    try {
      const response = await fetch("/api/design-systems", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (Array.isArray(data.committed)) setCommitted(data.committed as Committed[])
      return { ok: response.ok, status: response.status, data }
    } catch {
      return { ok: false, status: 0, data: { error: "Couldn't reach the dev server. Saving only works while npm run dev is running." } }
    }
  }, [])

  const failure = (data: Record<string, unknown>, status: number): SaveResult => ({
    ok: false,
    error: String(data.error ?? `Request failed (${status})`),
    issues: data.issues as { where: string; message: string }[] | undefined,
    conflict: data.conflict === true,
  })

  const save = React.useCallback(
    async (force = false): Promise<SaveResult> => {
      if (!active) return { ok: false, error: "Stock is read-only." }
      const id = active.system.id
      const { ok, status, data } = await post({
        action: "save",
        working: active,
        expectedHash: drafts[id]?.savedHash ?? committedFor(id)?.hash ?? "",
        force,
      })
      if (!ok) return failure(data, status)
      setDraft(id, null)
      return { ok: true }
    },
    [active, drafts, committedFor, post]
  )

  const remove = React.useCallback(
    async (id: string): Promise<SaveResult> => {
      if (committedFor(id)) {
        const { ok, status, data } = await post({ action: "delete", id })
        if (!ok) return failure(data, status)
      }
      discard(id)
      return { ok: true }
    },
    [committedFor, post, discard]
  )

  const proposals = React.useMemo(
    () => (active ? (committedFor(active.system.id)?.proposals ?? {}) : {}),
    [active, committedFor]
  )

  const rejectProposal = React.useCallback(
    async (entry: string): Promise<SaveResult> => {
      if (!active) return { ok: false, error: "Stock is read-only." }
      const { ok, status, data } = await post({ action: "dismiss-proposal", id: active.system.id, entry })
      return ok ? { ok: true } : failure(data, status)
    },
    [active, post]
  )

  const acceptProposal = React.useCallback(
    async (entry: string): Promise<SaveResult> => {
      const proposal = proposals[entry]
      if (!active || !proposal) return { ok: false, error: "No proposal to accept." }
      const { note: _note, ...tuning } = proposal
      void _note
      update((w) => ({ ...w, entries: { ...w.entries, [entry]: { ...emptyEntryTuning(entry), ...tuning } as EntryTuningFile } }))
      return rejectProposal(entry)
    },
    [active, proposals, update, rejectProposal]
  )

  const value: Api = {
    restored,
    committed,
    systems,
    activeId: resolvedActiveId,
    active,
    workingFor,
    missing,
    readOnly: !active,
    update,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    select,
    href,
    create,
    rename,
    renameSystem,
    remove,
    discard,
    save,
    committedFor,
    proposals,
    acceptProposal,
    rejectProposal,
    setReadOnlyHandler,
    uniqueName,
  }

  return <Context.Provider value={value}>{children}</Context.Provider>
}
