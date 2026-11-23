"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLinkIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useDesignSystems } from "@/components/showcase/design-systems/provider"
import { EntryTuner } from "@/components/showcase/design-systems/entry-tuner"
import { Pane, PaneButton, useTunerOpen } from "@/components/showcase/pane"
import { demos, getEntry } from "@/lib/catalog"

// One lazy component per entry, made once so switching entries back and forth
// doesn't reload a demo that has already loaded.
const lazyDemos = Object.fromEntries(
  Object.entries(demos).map(([name, load]) => [name, React.lazy(load)])
)

/**
 * An entry opened beside the design system: its demo, with its tuner floating
 * over the corner, so a token change on the left and a knob change here both
 * show at once.
 */
export function EntryPane({ name, onClose }: { name: string; onClose: () => void }) {
  const { href } = useDesignSystems()
  const entry = getEntry(name)
  const Demo = lazyDemos[name]
  const [tunerOpen, setTunerOpen] = useTunerOpen("entry")

  return (
    <Pane
      label={entry ? `${entry.title} entry` : "Entry"}
      title={entry?.title ?? name}
      badge={
        entry ? (
          <Badge variant="secondary" className="shrink-0">
            {entry.status}
          </Badge>
        ) : null
      }
      actions={
        <>
          {entry ? (
            <PaneButton label="Open full page" render={<Link href={href(`/c/${name}`)} />} nativeButton={false}>
              <ExternalLinkIcon />
            </PaneButton>
          ) : null}
          <PaneButton label="Close" onClick={onClose}>
            <XIcon />
          </PaneButton>
        </>
      }
      tuner={(className) => (entry ? <EntryTuner key={name} name={name} className={className} /> : null)}
      tunerOpen={tunerOpen}
      onTunerOpenChange={setTunerOpen}
    >
      {entry && Demo ? (
        <div className="flex flex-col gap-10 p-4 @xl:p-6">
          <React.Suspense fallback={<DemoSkeleton />}>
            <Demo key={name} />
          </React.Suspense>
        </div>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">There’s no entry called “{name}”.</p>
      )}
    </Pane>
  )
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

/** An entry's own page (/c/<name>), as one pane with the same floating tuner. */
export function EntryPagePane({
  name,
  title,
  status,
  children,
}: {
  name: string
  title: string
  status: string
  children: React.ReactNode
}) {
  const [tunerOpen, setTunerOpen] = useTunerOpen("entry")
  return (
    <Pane
      label={`${title} entry`}
      title={title}
      badge={
        <Badge variant="secondary" className="shrink-0">
          {status}
        </Badge>
      }
      tuner={(className) => <EntryTuner name={name} className={className} />}
      tunerOpen={tunerOpen}
      onTunerOpenChange={setTunerOpen}
    >
      {children}
    </Pane>
  )
}
