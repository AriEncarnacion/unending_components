"use client"

import * as React from "react"

import { demoLoaders } from "@/components/showcase/demo-loaders"
import { Skeleton } from "@/components/ui/skeleton"

const lazyDemos = Object.fromEntries(
  Object.entries(demoLoaders).map(([name, load]) => [name, React.lazy(load)])
)

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
