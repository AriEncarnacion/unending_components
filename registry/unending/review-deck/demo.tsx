"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Example } from "@/components/showcase/example"
import {
  ReviewDeck,
  type DecisionValue,
  type ReviewAction,
} from "@/registry/unending/review-deck/review-deck"

type Request = { id: string; kind: string; title: string; when: string; why: string }

const requests: Request[] = [
  { id: "r1", kind: "Override", title: "Alex covers Primary", when: "Fri 20 Nov 11:07 → Sat 21 Nov 03:07 · 16h", why: "Replaces part of Mateo’s shift. Mateo asked for it." },
  { id: "r2", kind: "Swap", title: "Priya and Sam trade weekends", when: "Sat 28 Nov → Sun 6 Dec", why: "Both rotations stay covered. No gaps are created." },
  { id: "r3", kind: "Gap", title: "Secondary is empty for 4 hours", when: "Tue 24 Nov 04:00 → 08:00", why: "Noor’s shift ends before Rowan’s begins. Accept the gap, or send it back?" },
  { id: "r4", kind: "Override", title: "Jules covers Secondary", when: "Thu 26 Nov 18:00 → Fri 27 Nov 06:00 · 12h", why: "Holiday cover while Rowan is out." },
  { id: "r5", kind: "Swap", title: "Noor and Jules swap Mondays", when: "Every Monday in December", why: "Recurring. Jules has a standing conflict." },
]

function RequestCard({ request }: { request: Request }) {
  return (
    <div className="flex flex-col gap-3">
      <Badge variant="outline">{request.kind}</Badge>
      <h3 className="text-xl font-semibold tracking-tight text-balance">{request.title}</h3>
      <p className="font-mono text-sm">{request.when}</p>
      <p className="text-muted-foreground">{request.why}</p>
    </div>
  )
}

type Entry = { item: Request; value: DecisionValue }

function DeckWithUndo() {
  const [queue, setQueue] = React.useState(requests)
  const [history, setHistory] = React.useState<Entry[]>([])
  const [later, setLater] = React.useState<Request[]>([])
  const label = (value: DecisionValue) =>
    value === true ? "Approved" : value === false ? "Declined" : "Later"

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
      <ReviewDeck
        className="h-[30rem]"
        items={queue}
        getItemId={(request) => request.id}
        renderCard={(request) => <RequestCard request={request} />}
        terms={{
          positive: "Approve",
          negative: "Decline",
          later: "Discuss later",
          item: { singular: "request", plural: "requests" },
        }}
        onDecision={({ item, value }) => {
          setHistory((previous) => [...previous, { item, value }])
          if (value === null) setLater((previous) => [...previous, item])
          setQueue((previous) => previous.filter((request) => request.id !== item.id))
        }}
        canUndo={history.length > 0}
        onUndo={() => {
          const last = history.at(-1)
          if (!last) return
          setHistory((previous) => previous.slice(0, -1))
          setLater((previous) => previous.filter((request) => request.id !== last.item.id))
          setQueue((previous) => [last.item, ...previous])
        }}
      />
      <div className="flex flex-col gap-3 text-sm">
        <h4 className="font-medium">Decision log</h4>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Nothing decided yet.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {history.map((entry) => (
              <li key={entry.item.id} className="flex justify-between gap-2">
                <span className="truncate">{entry.item.title}</span>
                <span className="shrink-0 text-muted-foreground">{label(entry.value)}</span>
              </li>
            ))}
          </ol>
        )}
        {later.length > 0 && queue.length === 0 ? (
          <button
            type="button"
            className="self-start text-primary underline underline-offset-4"
            onClick={() => {
              setQueue(later)
              setLater([])
            }}
          >
            Review the {later.length} saved for later
          </button>
        ) : null}
      </div>
    </div>
  )
}

const curateActions = [
  { id: "keep", direction: "left", label: "Keep", shortcut: "K" },
  { id: "pass", direction: "right", label: "Pass", shortcut: "P" },
] as const satisfies readonly ReviewAction<"keep" | "pass">[]

function BooleanDeck() {
  const [queue, setQueue] = React.useState(requests.slice(0, 3))
  return (
    <ReviewDeck
      className="h-[26rem]"
      items={queue}
      getItemId={(request) => request.id}
      renderCard={(request) => <RequestCard request={request} />}
      actions={curateActions}
      onDecision={({ itemId }) => setQueue((previous) => previous.filter((request) => request.id !== itemId))}
    />
  )
}

function FlakyDeck() {
  const [queue, setQueue] = React.useState(requests.slice(0, 3))
  const attempts = React.useRef(0)
  return (
    <ReviewDeck
      className="h-[26rem]"
      items={queue}
      getItemId={(request) => request.id}
      renderCard={(request) => <RequestCard request={request} />}
      onDecision={async ({ itemId }) => {
        await new Promise((resolve) => setTimeout(resolve, 600))
        attempts.current += 1
        if (attempts.current % 2 === 1) throw new Error("Network")
        setQueue((previous) => previous.filter((request) => request.id !== itemId))
      }}
    />
  )
}

export default function ReviewDeckDemo() {
  return (
    <>
      <Example
        title="Approve, decline or discuss later, with undo"
        description="Drag the card left, right or down past the ring, or press F, J or Q while the deck is focused. Z undoes. The deck records nothing; the parent owns the queue, the log and the later pile."
      >
        <DeckWithUndo />
      </Example>
      <Example
        title="Two choices, your own words and keys"
        description="Custom actions with K and P. With no action pointing down, dragging down does nothing."
      >
        <BooleanDeck />
      </Example>
      <Example
        title="Slow and failing saves"
        description="Every other save fails after 600ms. The card comes back and an error asks you to try again."
      >
        <FlakyDeck />
      </Example>
      <Example title="Finished" description="The default empty state when the queue runs out.">
        <ReviewDeck className="h-72" items={[]} getItemId={() => ""} renderCard={() => null} onDecision={() => {}} />
      </Example>
    </>
  )
}
