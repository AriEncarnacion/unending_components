"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLinkIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { DemoView, hasDemo } from "@/components/showcase/demo-view"
import { useDesignSystems } from "@/components/showcase/design-systems/provider"
import { EntryTuner } from "@/components/showcase/design-systems/entry-tuner"
import { Pane, PaneButton, useTunerOpen } from "@/components/showcase/pane"
import { getEntry } from "@/lib/catalog"

/**
 * An entry opened beside the design system: its demo, with its tuner floating
 * over the corner, so a token change on the left and a knob change here both
 * show at once.
 */
export function EntryPane({ name, onClose }: { name: string; onClose: () => void }) {
  const { href } = useDesignSystems()
  const entry = getEntry(name)
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
      {entry && hasDemo(name) ? (
        <div className="flex flex-col gap-10 p-4 @xl:p-6">
          <DemoView name={name} />
        </div>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">There’s no entry called “{name}”.</p>
      )}
    </Pane>
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
