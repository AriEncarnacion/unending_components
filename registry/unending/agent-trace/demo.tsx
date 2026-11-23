"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Example } from "@/components/showcase/example"
import { AgentTrace, type AgentStep } from "@/registry/unending/agent-trace/agent-trace"

type Script = { step: Omit<AgentStep, "status" | "startedAt" | "endedAt">; ms: number }[]

const script: Script = [
  {
    ms: 1800,
    step: {
      id: "think",
      kind: "think",
      title: "Worked out what “tonight” means",
      detail: "Tonight is Fri 20 Nov from 17:00 to Sat 08:00, local time. Both primary and secondary lanes count.",
    },
  },
  {
    ms: 2200,
    step: {
      id: "search",
      kind: "search",
      title: "Searched the rota",
      result: "2 schedules",
      code: { language: "json", title: "rota.search", value: `{ "lanes": ["primary", "secondary"], "from": "2026-11-20T17:00", "to": "2026-11-21T08:00" }` },
    },
  },
  {
    ms: 2600,
    step: {
      id: "overrides",
      kind: "read",
      title: "Checked overrides",
      result: "1 found",
      steps: [
        { id: "o1", kind: "read", title: "Read primary overrides", status: "done", result: "Alex, 11:07 → 03:07" },
        { id: "o2", kind: "read", title: "Read secondary overrides", status: "done", result: "none" },
      ],
    },
  },
  {
    ms: 1600,
    step: {
      id: "compute",
      kind: "command",
      title: "Ran the coverage check",
      code: {
        language: "bash",
        title: "terminal",
        value: "$ bearing coverage --at now\nPrimary    Alex (override)   until Sat 03:07\nSecondary  Jules             until Sat 04:00\n✓ no gaps",
      },
    },
  },
  {
    ms: 1200,
    step: { id: "answer", kind: "edit", title: "Wrote the answer" },
  },
]

const present: Record<string, string> = {
  think: "Working out what “tonight” means",
  search: "Searching the rota",
  overrides: "Checking overrides",
  compute: "Running the coverage check",
  answer: "Writing the answer",
}

function useRun() {
  const [steps, setSteps] = React.useState<AgentStep[]>([])
  const timers = React.useRef<number[]>([])
  const stop = React.useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }, [])
  // Schedules the scripted run. The effect starts it on mount; Run again
  // clears the previous run first.
  const schedule = React.useCallback(() => {
    stop()
    let at = 0
    script.forEach(({ step, ms }, index) => {
      timers.current.push(
        window.setTimeout(() => {
          const now = Date.now()
          setSteps((previous) => [
            ...previous.map((s) => (s.status === "running" ? { ...s, status: "done" as const, endedAt: now, title: script.find((x) => x.step.id === s.id)!.step.title } : s)),
            { ...step, title: present[step.id], status: "running", startedAt: now, result: undefined },
          ])
          if (index === script.length - 1)
            timers.current.push(
              window.setTimeout(() => {
                const end = Date.now()
                setSteps((previous) =>
                  previous.map((s) => (s.status === "running" ? { ...s, status: "done" as const, endedAt: end, title: step.title } : s))
                )
              }, ms)
            )
        }, at)
      )
      at += ms
    })
    // Fill results as each step finishes.
    let finish = 0
    script.forEach(({ step, ms }) => {
      finish += ms
      timers.current.push(
        window.setTimeout(() => {
          setSteps((previous) => previous.map((s) => (s.id === step.id ? { ...s, result: step.result } : s)))
        }, finish)
      )
    })
  }, [stop])
  React.useEffect(() => {
    schedule()
    return stop
  }, [schedule, stop])
  const restart = () => {
    setSteps([])
    schedule()
  }
  return { steps, restart }
}

const T0 = new Date(2026, 10, 20, 17, 0, 0).getTime()

const finished: AgentStep[] = script.map(({ step }, index) => ({
  ...step,
  status: "done",
  startedAt: T0 + index * 6_000,
  endedAt: T0 + index * 6_000 + 4_000 + index * 500,
}))

const failed: AgentStep[] = [
  { ...finished[0] },
  { ...finished[1] },
  {
    id: "deploy",
    kind: "command",
    title: "Couldn’t publish the rota",
    status: "error",
    startedAt: T0 + 12_000,
    endedAt: T0 + 15_000,
    detail: "PagerDuty rejected the request: the override overlaps a locked shift.",
    code: { language: "bash", value: "$ bearing publish --rota primary\nerror: 409 conflict (shift locked by Mateo)" },
  },
  { id: "notify", kind: "tool", title: "Notify the team", status: "pending" },
]

function LiveRun() {
  const { steps, restart } = useRun()
  return (
    <div className="flex flex-col gap-4">
      <AgentTrace key={steps.length === 0 ? "fresh" : "run"} steps={steps} defaultOpen />
      <Button variant="outline" size="sm" className="self-start" onClick={restart}>
        Run again
      </Button>
    </div>
  )
}

export default function AgentTraceDemo() {
  return (
    <>
      <Example
        title="A run in progress"
        description="Each step is in the present tense while it runs, with a live timer, then settles into the past tense with its result. Open a step to see its reasoning, tool input or output, or sub-steps."
      >
        <LiveRun />
      </Example>
      <Example title="Finished, collapsed" description="A done run folds into one line: how long it worked and how many steps it took.">
        <AgentTrace steps={finished} />
      </Example>
      <Example title="Stopped by an error" description="The failed step opens itself; steps that never ran stay muted, marked by their icon.">
        <AgentTrace steps={failed} defaultOpen />
      </Example>
    </>
  )
}
