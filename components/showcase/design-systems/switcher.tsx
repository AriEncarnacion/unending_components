"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeftIcon, LockIcon } from "lucide-react"
import { cn } from "cn"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { clearLegacyOverrides, readLegacyOverrides, toStored, type FontOption } from "@/components/showcase/token-overrides"
import { semanticScales, type KeyColor, type Scale } from "@/lib/palette"

import { describeChanges } from "./changes"
import { useDesignSystems } from "./provider"
import { ShipButton, useShip } from "./ship"

export function UnsavedDot({ className }: { className?: string }) {
  return <span aria-label="Unsaved changes" className={cn("size-1.5 shrink-0 rounded-full bg-primary", className)} />
}

/** Name a new system: a fresh one on the shadcn base, or a copy of `from`. */
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
  const { state, ship } = useShip()
  const status = state.status[system.id]
  // On GitHub already (shipped, or shipped once and changed since): deleting ships the removal too.
  const onGitHub = !!state.ready?.ok && (status === "shipped" || (status === "unshipped" && system.saved))
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {system.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {!system.saved
              ? "It was never saved, so its draft is all there is. This can't be undone."
              : onGitHub
                ? `This deletes design-systems/${system.id}/ here and ships the removal: a pull request that merges once its checks pass. Apps already linked to it keep their own copy.`
                : `This deletes design-systems/${system.id}/ and any unsaved draft. Git can bring the files back until you commit. Apps already linked to it keep their own copy.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              const result = await ds.remove(system.id)
              if (!result.ok) return void toast.error(result.error)
              if (onGitHub) await ship(system.id, "delete", system.name)
              toast(onGitHub ? `Deleted ${system.name}; shipping the removal` : `Deleted ${system.name}`)
            }}
          >
            {onGitHub ? "Delete and ship" : "Delete"}
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
      toast(`Saved ${active.system.name}`, { description: `Wrote design-systems/${active.system.id}/. Ship puts it on GitHub.` })
    } else setProblem(result)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save {active.system.name}</DialogTitle>
          <DialogDescription>Writes design-systems/{active.system.id}/ on this machine. Ship puts it on GitHub.</DialogDescription>
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

/** Turns the pre-design-systems tuner state in this browser into a first system. */
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

/** The top of the sidebar inside a system: back to all systems, its name, Save and Ship. */
export function SystemHeader() {
  const ds = useDesignSystems()
  const [saveOpen, setSaveOpen] = React.useState(0)
  const summary = ds.systems.find((s) => s.id === ds.activeId)
  const dirty = !!summary?.dirty
  const lastPrompt = React.useRef(0)

  // Editing the read-only shadcn base points you home to start a system.
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
    <div className="flex flex-col gap-2">
      <Link
        href="/"
        className="flex items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeftIcon className="size-3.5" />
        All design systems
      </Link>
      <div className="flex items-center gap-1.5 px-1">
        {ds.activeId === "stock" ? <LockIcon className="size-3.5 text-muted-foreground" /> : null}
        <span className="min-w-0 truncate font-heading text-sm font-semibold">
          {ds.restored ? (ds.active?.system.name ?? (ds.activeId === "stock" ? "shadcn base" : "Not found")) : "…"}
        </span>
        {dirty ? <UnsavedDot /> : null}
      </div>
      {ds.active ? (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="flex-1" disabled={!dirty} onClick={() => setSaveOpen((n) => n + 1)}>
            Save
          </Button>
          <ShipButton className="flex-1" />
        </div>
      ) : null}
      <SaveDialog key={saveOpen} open={saveOpen > 0} onOpenChange={(open) => !open && setSaveOpen(0)} />
    </div>
  )
}
