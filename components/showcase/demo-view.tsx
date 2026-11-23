"use client"

import * as React from "react"

import { Skeleton } from "@/components/ui/skeleton"

type DemoModule = { default: React.ComponentType }

/**
 * Each entry's live states. Keep in step with registry.json.
 *
 * This map lives in a client module on purpose. Imported by a server
 * component, every `import()` here becomes a client reference, and Next lists
 * all of their chunks in the page's HTML: every page would download every
 * demo, Agent Chat's markdown and highlighting included.
 */
const demos: Record<string, () => Promise<DemoModule>> = {
  "timeline-scrubber": () => import("@/registry/unending/timeline-scrubber/demo"),
  "agent-chat": () => import("@/registry/unending/agent-chat/demo"),
  "review-deck": () => import("@/registry/unending/review-deck/demo"),
  "file-toolbar": () => import("@/registry/unending/file-toolbar/demo"),
  "inspector-panel": () => import("@/registry/unending/inspector-panel/demo"),
  "page-nav": () => import("@/registry/unending/page-nav/demo"),
  "agent-trace": () => import("@/registry/unending/agent-trace/demo"),
}

// One lazy component per entry, made once. Each demo is its own chunk, loaded
// only when that entry is shown.
const lazyDemos = Object.fromEntries(
  Object.entries(demos).map(([name, load]) => [name, React.lazy(load)])
)

/**
 * An entry's demo, loaded on demand. `after` renders inside the same Suspense
 * boundary, so it mounts only once the demo itself has.
 */
export function DemoView({ name, after }: { name: string; after?: React.ReactNode }) {
  const Demo = lazyDemos[name]
  if (!Demo) return null
  return (
    <React.Suspense fallback={<DemoSkeleton />}>
      <Demo key={name} />
      {after}
    </React.Suspense>
  )
}

export function hasDemo(name: string) {
  return name in lazyDemos
}

function DemoSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/**
 * Marks the frame ready once the demo is hydrated, its fonts are in and it has
 * painted: `<html data-frame-ready="true">`. The size audit waits for it, so
 * it checks the settled layout rather than the server HTML.
 */
export function FrameReady() {
  React.useEffect(() => {
    let cancelled = false
    void document.fonts.ready.then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) document.documentElement.dataset.frameReady = "true"
        })
      )
    )
    return () => {
      cancelled = true
      delete document.documentElement.dataset.frameReady
    }
  }, [])
  return null
}
