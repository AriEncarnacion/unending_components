"use client"

import * as React from "react"

import { Example } from "@/components/showcase/example"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  InspectorPanel,
  InspectorRow,
  InspectorSection,
  MIXED,
} from "@/registry/unending/inspector-panel/inspector-panel"

type Shift = {
  id: string
  person: string
  role: string
  start: string
  end: string
  notify: boolean
  note: string
}

const shifts: Shift[] = [
  { id: "s1", person: "Alex", role: "Primary", start: "2026-11-20T11:07", end: "2026-11-21T03:07", notify: true, note: "Covering for Mateo." },
  { id: "s2", person: "Jules", role: "Secondary", start: "2026-11-19T04:00", end: "2026-11-21T04:00", notify: true, note: "" },
  { id: "s3", person: "Priya", role: "Primary", start: "2026-11-22T08:00", end: "2026-11-24T08:00", notify: false, note: "" },
]

const roles = ["Primary", "Secondary", "Shadow"]

function ShiftInspector({ initial, idPrefix }: { initial: Shift[]; idPrefix: string }) {
  const [saved, setSaved] = React.useState(initial)
  const [draft, setDraft] = React.useState(initial)
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)

  // For each field, one shared value, or undefined when the selection disagrees.
  const shared = <K extends keyof Shift>(key: K) =>
    draft.every((shift) => shift[key] === draft[0]?.[key]) ? draft[0]?.[key] : undefined
  const set = <K extends keyof Shift>(key: K, value: Shift[K]) =>
    setDraft((previous) => previous.map((shift) => ({ ...shift, [key]: value })))

  const id = (name: string) => `${idPrefix}-${name}`
  const role = shared("role")
  const notify = shared("notify")

  return (
    <InspectorPanel
      className="h-[30rem] max-w-sm"
      kind="Shift"
      count={draft.length}
      title={draft[0] ? `${draft[0].person} · ${draft[0].role}` : undefined}
      dirty={dirty}
      onRevert={() => setDraft(saved)}
      onClose={() => setDraft([])}
    >
      <InspectorSection title="Assignment" summary={`${shared("person") ?? MIXED}, ${role ?? MIXED}`}>
        <InspectorRow label="Person" htmlFor={id("person")} mixed={shared("person") === undefined}>
          <Input
            id={id("person")}
            value={shared("person") ?? ""}
            placeholder={MIXED}
            onChange={(event) => set("person", event.target.value)}
          />
        </InspectorRow>
        <InspectorRow label="Role" htmlFor={id("role")} mixed={role === undefined}>
          <Select value={role ?? null} onValueChange={(value) => value && set("role", value)}>
            <SelectTrigger id={id("role")} className="w-full">
              <SelectValue placeholder={MIXED} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InspectorRow>
      </InspectorSection>
      <InspectorSection title="Time">
        <InspectorRow label="Starts" htmlFor={id("start")} mixed={shared("start") === undefined}>
          <Input
            id={id("start")}
            type="datetime-local"
            value={shared("start") ?? ""}
            onChange={(event) => set("start", event.target.value)}
            className="font-mono text-xs"
          />
        </InspectorRow>
        <InspectorRow
          label="Ends"
          htmlFor={id("end")}
          mixed={shared("end") === undefined}
          hint="Ends must come after starts."
        >
          <Input
            id={id("end")}
            type="datetime-local"
            value={shared("end") ?? ""}
            onChange={(event) => set("end", event.target.value)}
            className="font-mono text-xs"
          />
        </InspectorRow>
      </InspectorSection>
      <InspectorSection title="Notifications" summary={notify === undefined ? MIXED : notify ? "On" : "Off"}>
        <InspectorRow label="Notify person" htmlFor={id("notify")} mixed={notify === undefined}>
          <Switch
            id={id("notify")}
            checked={notify ?? false}
            onCheckedChange={(checked) => set("notify", checked)}
          />
        </InspectorRow>
      </InspectorSection>
      <InspectorSection
        title="Note"
        defaultOpen={false}
        summary={shared("note") === undefined ? MIXED : shared("note") || "None"}
      >
        <Textarea
          aria-label="Note"
          value={shared("note") ?? ""}
          placeholder={shared("note") === undefined ? MIXED : "Add a note for the person on shift"}
          onChange={(event) => set("note", event.target.value)}
        />
      </InspectorSection>
      <div className="flex justify-end gap-2 p-3">
        <Button type="button" size="sm" disabled={!dirty} onClick={() => setSaved(draft)}>
          {dirty ? "Save changes" : "Saved"}
        </Button>
      </div>
    </InspectorPanel>
  )
}

export default function InspectorPanelDemo() {
  return (
    <>
      <Example
        title="One selection"
        description="Edit, and Revert appears. Sections collapse to a one-line summary. Close empties the selection."
        className="bg-muted/30"
      >
        <ShiftInspector initial={shifts.slice(0, 1)} idPrefix="one" />
      </Example>
      <Example
        title="Three selected at once"
        description="Fields that disagree show “Mixed” and a badge. Editing one sets it for all three."
        className="bg-muted/30"
      >
        <ShiftInspector initial={shifts} idPrefix="many" />
      </Example>
      <Example title="Nothing selected" className="bg-muted/30">
        <InspectorPanel className="h-64 max-w-sm" kind="Shift" />
      </Example>
    </>
  )
}
