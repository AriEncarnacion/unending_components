"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeftIcon, LockIcon, MenuIcon, MonitorIcon, MoonIcon, RocketIcon, SaveIcon, SunIcon } from "lucide-react"
import { cn } from "cn"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { clearLegacyOverrides, readLegacyOverrides, toStored, type FontOption } from "@/components/showcase/token-overrides"
import { semanticScales, type KeyColor, type Scale } from "@/lib/palette"

import { describeChanges } from "./changes"
import { useDesignSystems } from "./provider"
import { ShipPanel, useShip, useShipping } from "./ship"

export function UnsavedDot({ className }: { className?: string }) {
  return <span aria-label="Unsaved changes" className={cn("size-1.5 shrink-0 rounded-full bg-primary", className)} />
}

export function NewSystemDialog({
  open,
  onOpenChange,
  from,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  from?: { id: string; name: string }
  onCreated: (id: string) => void
}) {
  const ds = useDesignSystems()
  const [name, setName] = React.useState(() => ds.uniqueName(from ? `${from.name} copy` : "New design system"))
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const id = ds.create(ds.uniqueName(trimmed), from ? { kind: "duplicate", from: from.id } : { kind: "stock" })
    onOpenChange(false)
    onCreated(id)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{from ? `Duplicate ${from.name}` : "New design system"}</DialogTitle>
            <DialogDescription>
              {from
                ? "Copies its palette, tokens and every entry tuning."
                : "Starts on the shadcn base with the starting palette to work from."}{" "}
              It&apos;s a draft until you save it.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="new-system-name">Name</FieldLabel>
            <Input id="new-system-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {from ? "Duplicate" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RenameDialog({
  open,
  onOpenChange,
  system,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  system: { id: string; name: string }
}) {
  const ds = useDesignSystems()
  const [name, setName] = React.useState(system.name)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return
            ds.renameSystem(system.id, name)
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename {system.name}</DialogTitle>
            <DialogDescription>
              Only the name changes. Its address stays /{system.id}/ and its folder design-systems/{system.id}/.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="rename-system">Name</FieldLabel>
            <Input id="rename-system" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteDialog({
  open,
  onOpenChange,
  system,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  system: { id: string; name: string; saved: boolean }
}) {
  const ds = useDesignSystems()
  const { state } = useShip()
  const repo = state.status[system.id]?.repo
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {system.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {!system.saved
              ? "It was never saved, so its draft is all there is. This can't be undone."
              : repo
                ? `This deletes design-systems/${system.id}/ on this Mac only. Its repo, ${repo.repo}, keeps every version it shipped, so apps keep installing it and Pull brings it back. Delete or archive the repo on GitHub if you want it gone.`
                : `This deletes design-systems/${system.id}/ and any unsaved draft. It never shipped, so nothing can bring it back.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              const result = await ds.remove(system.id)
              if (!result.ok) return void toast.error(result.error)
              toast(`Deleted ${system.name} from this Mac`)
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function SaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ds = useDesignSystems()
  const active = ds.active
  const [saving, setSaving] = React.useState(false)
  const [problem, setProblem] = React.useState<{
    error: string
    issues?: { where: string; message: string }[]
    conflict?: boolean
  } | null>(null)
  if (!active || !open) return null
  const saved = ds.committedFor(active.system.id)
  const groups = describeChanges(saved ?? null, active)

  const run = async (force = false) => {
    setSaving(true)
    const result = await ds.save(force)
    setSaving(false)
    if (result.ok) {
      onOpenChange(false)
      toast(`Saved ${active.system.name}`)
    } else setProblem(result)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save {active.system.name}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto text-sm">
          {groups.length ? (
            groups.map((group) => (
              <div key={group.area} className="flex flex-col gap-1">
                <span className="font-medium">{group.area}</span>
                <ul className="flex flex-col gap-0.5 text-muted-foreground">
                  {group.items.map((item) => (
                    <li key={item} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nothing has changed since the last save.</p>
          )}
          {problem ? (
            <div className="flex flex-col gap-1 rounded-lg bg-destructive/10 p-3 text-destructive">
              <span className="font-medium">{problem.error}</span>
              {problem.conflict ? (
                <span className="text-foreground">
                  Something else changed these files (a git pull, or Claude). Save anyway to overwrite them with this draft, or
                  discard the draft to keep the files.
                </span>
              ) : null}
              {problem.issues?.map((issue) => (
                <span key={`${issue.where}-${issue.message}`} className="text-foreground">
                  <span className="font-mono text-xs">{issue.where}</span> {issue.message}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          {problem?.conflict ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  ds.discard(active.system.id)
                  onOpenChange(false)
                  toast("Draft discarded; showing the files as they are")
                }}
              >
                Discard my draft
              </Button>
              <Button disabled={saving} onClick={() => run(true)}>
                Save anyway
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={saving || !groups.length} onClick={() => run()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MigrationDialog({ fonts, onCreated }: { fonts: FontOption[]; onCreated: (id: string) => void }) {
  const ds = useDesignSystems()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("Jade")
  const checked = React.useRef(false)

  React.useEffect(() => {
    if (!ds.restored || checked.current) return
    checked.current = true
    let hasPalette = false
    try {
      hasPalette = !!localStorage.getItem("unending:palette")
    } catch {}
    if ((readLegacyOverrides() || hasPalette) && !ds.systems.length) setOpen(true)
  }, [ds.restored, ds.systems.length])

  const migrate = () => {
    const overrides = readLegacyOverrides() ?? { light: {}, dark: {}, theme: {} }
    let palette: { version?: number; scales: Scale[]; keys: KeyColor[] } | null = null
    try {
      palette = JSON.parse(localStorage.getItem("unending:palette") ?? "null")
    } catch {}
    const finalName = name.trim() || "Jade"
    const id = ds.create(finalName, {
      kind: "stock",
      build: (system) => {
        let next = system
        if (palette?.scales && palette.keys) {
          let scales = palette.scales
          if ((palette.version ?? 1) < 2) {
            const have = new Set(scales.map((s) => s.id))
            scales = [...scales, ...semanticScales.filter((s) => !have.has(s.id))]
          }
          next = { ...next, palette: { scales, keys: palette.keys } }
        }
        const stored = (scheme: "light" | "dark") =>
          Object.fromEntries(Object.entries(overrides[scheme]).map(([token, value]) => [token, toStored(value, next.palette)]))
        const theme = Object.fromEntries(
          Object.entries(overrides.theme).map(([key, value]) => [
            key,
            key.startsWith("--font-") ? (fonts.find((f) => f.family === value)?.id ?? value) : value,
          ])
        )
        return { ...next, tokens: { light: stored("light"), dark: stored("dark"), theme } }
      },
    })
    clearLegacyOverrides()
    setOpen(false)
    toast(`Moved your tuning into ${finalName}`, { description: "It's a draft until you save it." })
    onCreated(id)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            migrate()
          }}
        >
          <DialogHeader>
            <DialogTitle>Name your first design system</DialogTitle>
            <DialogDescription>
              The catalog now holds several design systems. Your current tuner changes and palette become the first one.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="migrate-name">Name</FieldLabel>
            <Input id="migrate-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Not now
            </Button>
            <Button type="submit">Create {name.trim() || "Jade"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type TraverseEvent = Event & {
  navigationType: "push" | "replace" | "reload" | "traverse"
  cancelable: boolean
  destination: { url: string; key: string }
}
type NavigationApi = EventTarget & { traverseTo: (key: string) => { finished: Promise<unknown> } }

export function BackButton() {
  const ds = useDesignSystems()
  const router = useRouter()
  const [leave, setLeave] = React.useState<(() => void) | null>(null)
  const [saving, setSaving] = React.useState(false)
  const active = ds.active
  const dirty = !!ds.systems.find((s) => s.id === ds.activeId)?.dirty
  const neverSaved = active ? !ds.committedFor(active.system.id) : false
  const guard = React.useRef<{ dirty: boolean; id: string; leavingTo: string | null }>({
    dirty,
    id: ds.activeId,
    leavingTo: null,
  })
  React.useEffect(() => {
    guard.current.dirty = dirty
    guard.current.id = ds.activeId
  }, [dirty, ds.activeId])

  React.useEffect(() => {
    const navigation = (window as Window & { navigation?: NavigationApi }).navigation
    if (!navigation) return
    const onNavigate = (event: Event) => {
      const e = event as TraverseEvent
      const { dirty, id, leavingTo } = guard.current
      if (!dirty || !e.cancelable || e.navigationType !== "traverse") return
      if (e.destination.key === leavingTo) return
      const path = new URL(e.destination.url).pathname
      if (path === `/${id}` || path.startsWith(`/${id}/`)) return
      e.preventDefault()
      const key = e.destination.key
      setLeave(() => () => {
        guard.current.leavingTo = key
        const settled = () => {
          if (guard.current.leavingTo === key) guard.current.leavingTo = null
        }
        navigation.traverseTo(key).finished.then(settled, settled)
      })
    }
    navigation.addEventListener("navigate", onNavigate)
    return () => navigation.removeEventListener("navigate", onNavigate)
  }, [])

  const go = () => {
    const next = leave
    setLeave(null)
    next?.()
  }

  const save = async () => {
    setSaving(true)
    const result = await ds.save()
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error, {
        description: result.conflict
          ? "Something else changed these files. Open Save from the menu to choose what to keep."
          : result.issues?.slice(0, 3).map((i) => `${i.where}: ${i.message}`).join("\n"),
      })
      return
    }
    go()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="All design systems"
        nativeButton={false}
        render={<Link href="/" />}
        onClick={(event) => {
          if (!dirty || !active) return
          event.preventDefault()
          setLeave(() => () => router.push("/"))
        }}
      >
        <ChevronLeftIcon />
      </Button>
      {active ? (
        <AlertDialog open={!!leave} onOpenChange={(open) => !open && setLeave(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save changes to {active.system.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {neverSaved
                  ? `${active.system.name} has never been saved. Discarding removes it.`
                  : "Discarding undoes every change since the last save."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={saving}
                onClick={() => {
                  ds.discard(active.system.id)
                  go()
                }}
              >
                Discard changes
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  )
}

export function SystemName() {
  const ds = useDesignSystems()
  const dirty = !!ds.systems.find((s) => s.id === ds.activeId)?.dirty
  return (
    <div className="flex min-w-0 items-center justify-center gap-1.5">
      {ds.activeId === "stock" ? <LockIcon className="size-3.5 shrink-0 text-muted-foreground" /> : null}
      <span className="min-w-0 truncate font-heading text-sm font-semibold">
        {ds.restored ? (ds.active?.system.name ?? (ds.activeId === "stock" ? "shadcn base" : "Not found")) : "…"}
      </span>
      {dirty ? <UnsavedDot /> : null}
    </div>
  )
}

export function SystemMenu() {
  const ds = useDesignSystems()
  const { theme, setTheme } = useTheme()
  const shipping = useShipping()
  const [saveOpen, setSaveOpen] = React.useState(0)
  const [shipOpen, setShipOpen] = React.useState(false)
  const dirty = !!ds.systems.find((s) => s.id === ds.activeId)?.dirty
  const lastPrompt = React.useRef(0)

  const { setReadOnlyHandler } = ds
  React.useEffect(() => {
    setReadOnlyHandler(() => {
      const now = Date.now()
      if (now - lastPrompt.current < 4000) return
      lastPrompt.current = now
      toast("The shadcn base is read-only", { description: "Start a design system from it on the home page." })
    })
    return () => setReadOnlyHandler(null)
  }, [setReadOnlyHandler])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Menu" className="relative" />}>
          {shipping ? <Spinner /> : <MenuIcon />}
          {dirty && !shipping ? <UnsavedDot className="absolute top-1 right-1" /> : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {ds.active ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem disabled={!dirty} onClick={() => setSaveOpen((n) => n + 1)}>
                  <SaveIcon />
                  Save
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShipOpen(true)}>
                  {shipping ? <Spinner /> : <RocketIcon />}
                  {shipping ? "Shipping…" : "Ship…"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(value as string)}>
              <DropdownMenuRadioItem value="light">
                <SunIcon />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <MonitorIcon />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveDialog key={saveOpen} open={saveOpen > 0} onOpenChange={(open) => !open && setSaveOpen(0)} />
      {ds.active ? (
        <Dialog open={shipOpen} onOpenChange={setShipOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ship {ds.active.system.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-sm">
              <ShipPanel />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
