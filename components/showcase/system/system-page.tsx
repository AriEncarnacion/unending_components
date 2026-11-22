"use client"

import * as React from "react"
import { SlidersHorizontalIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useTokens } from "@/components/showcase/token-overrides"

import { ColorSection } from "./color-section"
import { ComposedSection } from "./composed"
import { MotionSection } from "./motion-section"
import { OverlaysAndFeedback } from "./overlays"
import { BreakpointSection, ElevationSection, RadiusSection, SizingSection, SpacingSection } from "./scale-sections"
import { Tuner } from "./tuner"
import { TypeSection } from "./type-section"

const sections = [
  ["composed", "Composed"],
  ["overlays", "Overlays"],
  ["color", "Colour"],
  ["type", "Type"],
  ["spacing", "Spacing"],
  ["radius", "Radius"],
  ["elevation", "Elevation"],
  ["motion", "Motion"],
  ["sizing", "Controls"],
  ["layout", "Breakpoints"],
] as const

export function SystemPage() {
  const { changed } = useTokens()
  const [token, setToken] = React.useState("primary")
  // The scheme being tuned is the site theme, so the tuner toggle and the
  // header theme button always agree; flipping either flips both.
  const { resolvedTheme, setTheme } = useTheme()
  const scheme: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light"
  const setScheme = (next: "light" | "dark") => setTheme(next)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const wide = React.useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia("(min-width: 80rem)")
      media.addEventListener("change", notify)
      return () => media.removeEventListener("change", notify)
    },
    () => window.matchMedia("(min-width: 80rem)").matches,
    () => true
  )

  const select = (next: string) => {
    setToken(next)
    if (!wide) setSheetOpen(true)
  }
  const tuner = (className: string) => (
    <Tuner token={token} onTokenChange={setToken} scheme={scheme} onSchemeChange={setScheme} className={className} />
  )

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-16">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">base-nova</Badge>
            <Badge variant="outline">neutral</Badge>
            <Badge variant="outline">Base UI</Badge>
            <Badge variant="outline">Tailwind v4</Badge>
            {changed ? <Badge>{changed} tuned</Badge> : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">Design system</h1>
          <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
            Every token the catalog is built on: colour, type, space, shape, elevation and motion, with
            what uses each one. It’s stock shadcn for now. Tune anything with the tuner, see it
            composed, and export the result to app/globals.css.
          </p>
          <nav aria-label="Sections" className="flex flex-wrap gap-1.5">
            {sections.map(([id, label]) => (
              <Button key={id} size="sm" variant="outline" nativeButton={false} render={<a href={`#${id}`} />}>
                {label}
              </Button>
            ))}
          </nav>
        </header>

        <ComposedSection />
        <OverlaysAndFeedback />
        <ColorSection selected={token} onSelect={select} />
        <TypeSection />
        <SpacingSection />
        <RadiusSection />
        <ElevationSection />
        <MotionSection />
        <SizingSection />
        <BreakpointSection />
      </div>

      {wide ? (
        <aside aria-label="Token tuner" className="hidden xl:block">
          <div className="sticky top-16">{tuner("h-[calc(100svh-5rem)]")}</div>
        </aside>
      ) : (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <Button className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-20 shadow-lg" />
            }
          >
            <SlidersHorizontalIcon data-icon="inline-start" />
            Tune{changed ? ` (${changed})` : ""}
          </SheetTrigger>
          <SheetContent className="w-full gap-0 p-0 sm:max-w-sm">
            <SheetHeader className="sr-only">
              <SheetTitle>Token tuner</SheetTitle>
              <SheetDescription>Adjust design tokens and see them across the page.</SheetDescription>
            </SheetHeader>
            {tuner("h-full rounded-none border-0")}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
