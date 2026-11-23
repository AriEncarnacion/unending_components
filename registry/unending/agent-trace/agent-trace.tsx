"use client"

import * as React from "react"
import { cn } from "cn"
import {
  BrainIcon,
  CheckIcon,
  CircleDashedIcon,
  FilePenIcon,
  GlobeIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { Spinner } from "@/components/ui/spinner"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { useEntryTuning } from "@/lib/tuning"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"

export type AgentStepStatus = "pending" | "running" | "done" | "error"
export type AgentStepKind = "think" | "search" | "read" | "edit" | "command" | "web" | "tool"

export type AgentStep = {
  id: string
  /** Present tense while running ("Searching the rota"), past once done. */
  title: string
  status: AgentStepStatus
  kind?: AgentStepKind
  /** Epoch ms. With startedAt and no endedAt, a running step shows a live timer. */
  startedAt?: number
  endedAt?: number
  /** A short result shown after the title, e.g. "12 matches". */
  result?: string
  /** Plain text shown when the step is opened: reasoning, a summary, an error. */
  detail?: string
  /** Tool input or output shown when the step is opened. */
  code?: { language: string; value: string; title?: string }
  steps?: AgentStep[]
}

const kindIcon: Record<AgentStepKind, React.ComponentType> = {
  think: BrainIcon,
  search: SearchIcon,
  read: CircleDashedIcon,
  edit: FilePenIcon,
  command: TerminalIcon,
  web: GlobeIcon,
  tool: WrenchIcon,
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

let second = Date.now()
function subscribeSecond(notify: () => void) {
  second = Date.now()
  const interval = window.setInterval(() => {
    second = Date.now()
    notify()
  }, 1000)
  return () => window.clearInterval(interval)
}
const noop = () => () => {}

function useNow(live: boolean) {
  return React.useSyncExternalStore<number | null>(
    live ? subscribeSecond : noop,
    () => second,
    () => null
  )
}

function StepCode({ code }: { code: NonNullable<AgentStep["code"]> }) {
  const lines = useHighlightedCode(code.value, code.language)
  return (
    <CodeBlock size="sm">
      {code.title ? (
        <CodeBlockHeader>
          <CodeBlockTitle className="font-mono">{code.title}</CodeBlockTitle>
        </CodeBlockHeader>
      ) : null}
      <CodeBlockContent wrap className="max-h-56 scroll-fade-y">
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

function StepRow({ step, now }: { step: AgentStep; now: number | null }) {
  const tuning = useEntryTuning("agent-trace", { openErrors: true })
  const Icon = step.kind ? kindIcon[step.kind] : WrenchIcon
  const elapsed =
    step.startedAt === undefined
      ? undefined
      : (step.endedAt ?? (step.status === "running" ? now ?? step.startedAt : step.startedAt)) -
        step.startedAt
  const traceStatus =
    step.status === "running" ? "running" : step.status === "error" ? "error" : step.status === "pending" ? "pending" : undefined
  const line = (
    <TraceLine status={traceStatus} className="data-[status=pending]:opacity-100">
      <TraceIcon>
        {step.status === "running" ? (
          <Spinner />
        ) : step.status === "error" ? (
          <XIcon />
        ) : (
          <Icon />
        )}
      </TraceIcon>
      <TraceTitle>{step.title}</TraceTitle>
      {step.result || elapsed ? (
        <TraceDescription className="text-muted-foreground">
          {[step.result, elapsed !== undefined && elapsed >= 1000 ? formatDuration(elapsed) : null]
            .filter(Boolean)
            .join(" · ")}
        </TraceDescription>
      ) : null}
    </TraceLine>
  )
  const hasBody = Boolean(step.detail || step.code || step.steps?.length)
  if (!hasBody) return <div>{line}</div>
  return (
    <TraceCollapsible defaultOpen={tuning.openErrors && step.status === "error"}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="flex flex-col gap-2">
          {step.detail ? <p className="whitespace-pre-wrap">{step.detail}</p> : null}
          {step.code ? <StepCode code={step.code} /> : null}
          {step.steps?.length ? <StepList steps={step.steps} now={now} /> : null}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

function StepList({ steps, now }: { steps: AgentStep[]; now: number | null }) {
  return (
    <Trace>
      {steps.map((step) => (
        <StepRow key={step.id} step={step} now={now} />
      ))}
    </Trace>
  )
}

function flatten(steps: AgentStep[]): AgentStep[] {
  return steps.flatMap((step) => [step, ...flatten(step.steps ?? [])])
}

export type AgentTraceProps = Omit<React.ComponentProps<"div">, "children"> & {
  steps: AgentStep[]
  /** Collapse the whole run into its summary line. Defaults to open while running. */
  defaultOpen?: boolean
}

function AgentTrace({ steps, defaultOpen, className, ...props }: AgentTraceProps) {
  const all = flatten(steps)
  const running = all.find((step) => step.status === "running")
  const failed = all.filter((step) => step.status === "error").length
  const now = useNow(Boolean(running))
  const [open, setOpen] = React.useState(defaultOpen ?? Boolean(running))

  const starts = all.flatMap((step) => (step.startedAt === undefined ? [] : [step.startedAt]))
  const ends = all.flatMap((step) => (step.endedAt === undefined ? [] : [step.endedAt]))
  const first = starts.length ? Math.min(...starts) : undefined
  const last = running ? now ?? first : ends.length ? Math.max(...ends) : undefined
  const duration = first !== undefined && last !== undefined ? formatDuration(last - first) : null

  const summary = running
    ? running.title
    : failed
      ? `Stopped after ${failed === 1 ? "an error" : `${failed} errors`}`
      : `Worked${duration ? ` for ${duration}` : ""}`
  const count = `${steps.length} ${steps.length === 1 ? "step" : "steps"}`

  return (
    <div data-slot="agent-trace" className={cn("flex min-w-0 flex-col", className)} {...props}>
      <Trace>
        <TraceCollapsible open={open} onOpenChange={setOpen}>
          <TraceCollapsibleTrigger>
            <TraceLine status={running ? "running" : failed ? "error" : undefined}>
              <TraceIcon>{running ? <Spinner /> : failed ? <XIcon /> : <CheckIcon />}</TraceIcon>
              <TraceTitle>{summary}</TraceTitle>
              <TraceDescription className="text-muted-foreground">
                {[running && duration, count].filter(Boolean).join(" · ")}
              </TraceDescription>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <StepList steps={steps} now={now} />
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
      <span className="sr-only" aria-live="polite">
        {running ? running.title : summary}
      </span>
    </div>
  )
}

export { AgentTrace }
