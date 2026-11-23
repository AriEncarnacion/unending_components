"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CopyIcon, EllipsisIcon, MoonIcon, PencilIcon, PlusIcon, SunIcon, Trash2Icon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import type { FontOption } from "@/components/showcase/token-overrides"
import { effectiveTokens } from "@/lib/design-systems/resolve"
import type { Working } from "@/lib/design-systems/schema"
import { toCss } from "@/lib/palette"
import { baseTokens } from "@/lib/tokens"

import { useDesignSystems } from "./provider"
import { PullButton, ShipBadge, ShipProvider } from "./ship"
import { DeleteDialog, MigrationDialog, NewSystemDialog, RenameDialog, UnsavedDot } from "./switcher"

type Dialog =
  | { kind: "new"; from?: { id: string; name: string } }
  | { kind: "rename"; system: { id: string; name: string } }
  | { kind: "delete"; system: { id: string; name: string; saved: boolean } }

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  )
}

/** A small screen painted in the system's own tokens, fonts and palette. */
function Thumbnail({ working, fonts }: { working: Working; fonts: FontOption[] }) {
  const { resolvedTheme } = useTheme()
  const scheme = resolvedTheme === "dark" ? "dark" : "light"
  const tokens = effectiveTokens(baseTokens, working.system, "css")[scheme]
  const t = (token: string) => tokens[token]
  const family = (role: "heading" | "sans") =>
    fonts.find((f) => f.id === working.system.tokens.theme[`--font-${role}`])?.family ?? `var(--font-${role})`
  const radius = working.system.tokens.theme["--radius"] ?? baseTokens.light.radius
  const scales = working.system.palette.scales.filter((s) => !s.hidden && !s.semantic).slice(0, 5)
  return (
    <div
      aria-hidden
      className="flex aspect-[4/3] flex-col justify-between gap-3 p-4"
      style={{ background: t("background"), color: t("foreground") }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-2xl leading-none font-semibold" style={{ fontFamily: family("heading") }}>
            Aa
          </span>
          <span className="truncate text-[0.7rem]" style={{ color: t("muted-foreground"), fontFamily: family("sans") }}>
            The quick review
          </span>
        </div>
        <div className="flex gap-1">
          {["destructive", "warning", "success", "info"].map((token) => (
            <span key={token} className="size-2 rounded-full" style={{ background: t(token) }} />
          ))}
        </div>
      </div>
      <div
        className="flex flex-col gap-2 p-2.5"
        style={{ background: t("card"), border: `1px solid ${t("border")}`, borderRadius: `calc(${radius} * 1.4)` }}
      >
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: t("muted") }} />
        <div className="flex gap-1.5">
          <span
            className="px-2 py-1 text-[0.6rem] font-medium"
            style={{ background: t("primary"), color: t("primary-foreground"), borderRadius: radius, fontFamily: family("sans") }}
          >
            Approve
          </span>
          <span
            className="px-2 py-1 text-[0.6rem]"
            style={{ background: t("secondary"), color: t("secondary-foreground"), borderRadius: radius, fontFamily: family("sans") }}
          >
            Later
          </span>
        </div>
      </div>
      <div className="flex h-2.5 overflow-hidden" style={{ borderRadius: radius }}>
        {scales.flatMap((scale) =>
          [3, 6, 9].map((i) => <span key={`${scale.id}-${i}`} className="flex-1" style={{ background: toCss(scale.steps[i - 1]) }} />)
        )}
      </div>
    </div>
  )
}

function SystemCard({ id, fonts, onDialog }: { id: string; fonts: FontOption[]; onDialog: (dialog: Dialog) => void }) {
  const ds = useDesignSystems()
  const summary = ds.systems.find((s) => s.id === id)!
  const copy = ds.workingFor(id)
  if (!copy) return null
  const tuned = Object.keys(copy.entries).length
  return (
    <div className="group/card relative flex flex-col gap-2.5">
      <Link
        href={`/${id}/system`}
        className="overflow-hidden rounded-xl border bg-card outline-none transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Thumbnail working={copy} fonts={fonts} />
      </Link>
      <div className="flex items-start gap-2 px-0.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={`/${id}/system`} className="flex items-center gap-1.5 font-medium outline-none hover:underline focus-visible:underline">
            <span className="truncate">{summary.name}</span>
            {summary.dirty ? <UnsavedDot /> : null}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <ShipBadge systemId={id} saved={summary.saved} />
            <span>{tuned ? `${tuned} ${tuned === 1 ? "entry" : "entries"} tuned` : "No entries tuned"}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`${summary.name} actions`} />}>
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => ds.select(id)}>Open</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDialog({ kind: "new", from: { id, name: summary.name } })}>
                <CopyIcon />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDialog({ kind: "rename", system: { id, name: summary.name } })}>
                <PencilIcon />
                Rename
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDialog({ kind: "delete", system: { id, name: summary.name, saved: summary.saved } })}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/** Every design system, Figma-home style: open one, duplicate, rename, delete or start fresh. */
export function SystemsHome({ fonts }: { fonts: FontOption[] }) {
  const ds = useDesignSystems()
  const router = useRouter()
  const [dialog, setDialog] = React.useState<Dialog | null>(null)
  const [opened, setOpened] = React.useState(0)
  const open = (next: Dialog) => {
    setOpened((n) => n + 1)
    setDialog(next)
  }
  const close = (isOpen: boolean) => !isOpen && setDialog(null)
  const goTo = (id: string) => router.push(`/${id}/system`)

  return (
    <ShipProvider>
      <div className="min-h-svh bg-background">
        <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
            <span className="font-semibold tracking-tight">
              Unending
              <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">catalog</span>
            </span>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <PullButton />
              <Button size="sm" onClick={() => open({ kind: "new" })} aria-label="New design system">
                <PlusIcon data-icon="inline-start" />
                <span className="sm:hidden">New</span>
                <span className="hidden sm:inline">New design system</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Design systems</h1>
            <p className="text-sm text-muted-foreground text-pretty">
              Each one is a palette, tokens and tuned entries, handed off whole to the apps linked to it.
            </p>
          </div>
          {!ds.restored ? null : ds.systems.length ? (
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ds.systems.map((system) => (
                <SystemCard key={system.id} id={system.id} fonts={fonts} onDialog={open} />
              ))}
              <button
                type="button"
                onClick={() => open({ kind: "new" })}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground outline-none hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <PlusIcon className="size-5" />
                Start from the shadcn base
              </button>
            </div>
          ) : (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No design systems yet</EmptyTitle>
                <EmptyDescription>Start one on the shadcn base, then tune its palette, tokens and entries.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => open({ kind: "new" })}>
                  <PlusIcon data-icon="inline-start" />
                  New design system
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </main>
      </div>
      {dialog?.kind === "new" ? (
        <NewSystemDialog key={opened} open onOpenChange={close} from={dialog.from} onCreated={goTo} />
      ) : null}
      {dialog?.kind === "rename" ? <RenameDialog key={opened} open onOpenChange={close} system={dialog.system} /> : null}
      {dialog?.kind === "delete" ? <DeleteDialog key={opened} open onOpenChange={close} system={dialog.system} /> : null}
      <MigrationDialog fonts={fonts} onCreated={goTo} />
    </ShipProvider>
  )
}
