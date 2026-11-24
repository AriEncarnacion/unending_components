"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronRightIcon, MousePointerClickIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEntryTuning } from "@/lib/tuning"

export const MIXED = "Mixed"

type InspectorPanelProps = Omit<React.ComponentProps<"aside">, "title"> & {
  title?: React.ReactNode
  kind?: string
  count?: number
  dirty?: boolean
  onRevert?: () => void
  onClose?: () => void
  empty?: React.ReactNode
}

function InspectorPanel({
  title,
  kind,
  count = title === undefined ? 0 : 1,
  dirty = false,
  onRevert,
  onClose,
  empty,
  className,
  children,
  ...props
}: InspectorPanelProps) {
  const nothing = count === 0
  return (
    <aside
      data-slot="inspector-panel"
      aria-label={kind ? `${kind} inspector` : "Inspector"}
      className={cn(
        "@container/inspector-panel flex min-h-0 w-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground",
        className
      )}
      {...props}
    >
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b py-2.5 pr-2.5 pl-4">
        <div className="flex min-w-0 flex-1 flex-col">
          {kind ? (
            <span className="text-xs text-muted-foreground">
              {count > 1 ? `${count} ${kind.toLowerCase()}s selected` : kind}
            </span>
          ) : null}
          <h2 className="truncate text-sm font-medium">
            {nothing ? "Nothing selected" : count > 1 ? `Editing ${count} at once` : title}
          </h2>
        </div>
        {dirty && onRevert ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRevert}>
            <RotateCcwIcon data-icon="inline-start" />
            Revert
          </Button>
        ) : null}
        {onClose ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close inspector" onClick={onClose}>
            <XIcon />
          </Button>
        ) : null}
      </header>
      {nothing ? (
        <div className="grid flex-1 place-items-center p-4">
          {empty ?? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MousePointerClickIcon />
                </EmptyMedia>
                <EmptyTitle>Select something to inspect</EmptyTitle>
                <EmptyDescription>Its details and settings appear here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      ) : (
        <div
          data-slot="inspector-body"
          className="grid min-h-0 flex-1 auto-rows-[minmax(auto,max-content)] content-start overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      )}
    </aside>
  )
}

type InspectorSectionProps = Omit<React.ComponentProps<typeof Collapsible>, "title"> & {
  title: React.ReactNode
  summary?: React.ReactNode
}

function InspectorSection({
  title,
  summary,
  defaultOpen,
  className,
  children,
  ...props
}: InspectorSectionProps) {
  const tuning = useEntryTuning("inspector-panel", { sectionMs: 200, sectionsOpen: true })
  return (
    <Collapsible
      data-slot="inspector-section"
      defaultOpen={defaultOpen ?? tuning.sectionsOpen}
      className={cn(
        "flex min-h-11 flex-col border-b last:border-b-0",
        className
      )}
      {...props}
    >
      <CollapsibleTrigger className="group/inspector-trigger flex h-11 w-full shrink-0 items-center gap-2 px-4 text-left text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-aria-expanded/inspector-trigger:rotate-90" />
        <span className="truncate">{title}</span>
        {summary ? (
          <span className="ml-auto truncate text-xs font-normal text-muted-foreground group-aria-expanded/inspector-trigger:hidden">
            {summary}
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent
        className="flex h-(--collapsible-panel-height) min-h-0 flex-col overflow-hidden transition-[height] data-ending-style:h-0 data-starting-style:h-0"
        style={{ transitionDuration: `${tuning.sectionMs}ms` }}
      >
        <ScrollArea className="mr-1.5 mb-1.5 flex min-h-0 flex-1 flex-col [&>[data-slot=scroll-area-viewport]]:min-h-0 [&>[data-slot=scroll-area-viewport]]:overscroll-contain">
          <div className="flex flex-col gap-4 pt-1 pr-6.5 pb-4 pl-4">{children}</div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  )
}

type InspectorRowProps = Omit<React.ComponentProps<typeof Field>, "children"> & {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  mixed?: boolean
  children: React.ReactNode
}

function InspectorRow({ label, htmlFor, hint, mixed, className, children, ...props }: InspectorRowProps) {
  return (
    <Field
      data-slot="inspector-row"
      data-mixed={mixed || undefined}
      orientation="horizontal"
      className={cn(
        "grid grid-cols-1 items-center gap-x-4 gap-y-1.5 @sm/inspector-panel:grid-cols-[6.5rem_minmax(0,1fr)]",
        className
      )}
      {...props}
    >
      <FieldLabel htmlFor={htmlFor} className="flex-wrap gap-x-1 gap-y-0.5 text-xs font-normal text-muted-foreground">
        <span>{label}</span>
        {mixed ? (
          <Badge variant="outline" className="h-4 px-1 text-[0.6875rem] font-normal">
            mixed
          </Badge>
        ) : null}
      </FieldLabel>
      <div className="min-w-0">{children}</div>
      {hint ? (
        <FieldDescription className="text-xs @sm/inspector-panel:col-start-2">{hint}</FieldDescription>
      ) : null}
    </Field>
  )
}

export { InspectorPanel, InspectorSection, InspectorRow }
