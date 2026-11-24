"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useRouter, useSearchParams } from "next/navigation"
import { useDefaultLayout } from "react-resizable-panels"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { useDesignSystems } from "@/components/showcase/design-systems/provider"
import { Pane, useTunerOpen } from "@/components/showcase/pane"
import { panelStorage, useHydrated } from "@/components/showcase/panel-layout"
import { useTokens } from "@/components/showcase/token-overrides"

import { ColorSection } from "./color-section"
import { ComposedSection } from "./composed"
import { EntryPane } from "./entry-pane"
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

export function SystemPageWithParams() {
  return <SystemPage entry={useSearchParams().get("entry")} />
}

export function SystemPage({ entry = null }: { entry?: string | null }) {
  const { changed } = useTokens()
  const { href } = useDesignSystems()
  const router = useRouter()
  const [token, setToken] = React.useState("primary")
  const { resolvedTheme, setTheme } = useTheme()
  const scheme: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light"
  const setScheme = (next: "light" | "dark") => setTheme(next)
  const [tunerOpen, setTunerOpen] = useTunerOpen("tokens")
  const layout = useDefaultLayout({
    id: "unending:system-split",
    panelIds: entry ? ["system", "entry"] : ["system"],
    storage: panelStorage,
    onlySaveAfterUserInteractions: true,
  })
  const hydrated = useHydrated()

  const closeEntry = () => router.push(href("/system"), { scroll: false })

  const select = (next: string) => {
    setToken(next)
    setTunerOpen(true)
  }
  const tuner = (className: string) => (
    <Tuner token={token} onTokenChange={setToken} scheme={scheme} onSchemeChange={setScheme} className={className} />
  )

  const content = (
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
  )

  if (!hydrated) return null
  return (
    <ResizablePanelGroup
      className="min-h-0 flex-1"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      <ResizablePanel id="system" minSize="16rem">
        <Pane
          label="Design system"
          title="Design system"
          tuner={tuner}
          tunerOpen={tunerOpen}
          onTunerOpenChange={setTunerOpen}
        >
          <div className="mx-auto w-full max-w-[96rem] px-4 py-10 @xl:px-8">{content}</div>
        </Pane>
      </ResizablePanel>
      {entry ? (
        <>
          <ResizableHandle />
          <ResizablePanel id="entry" defaultSize="45" minSize="18rem">
            <EntryPane name={entry} onClose={closeEntry} />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  )
}
