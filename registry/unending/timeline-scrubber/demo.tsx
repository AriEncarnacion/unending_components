"use client"

import * as React from "react"

import { Example } from "@/components/showcase/example"
import {
  TimelineScrubber,
  withOverrides,
  type TimelineEvent,
  type TimelineLane,
} from "@/registry/unending/timeline-scrubber/timeline-scrubber"

const HOUR = 3_600_000
const DAY = 24 * HOUR
// A fixed "now" keeps the demo stable between server and client renders.
const NOW = new Date(2026, 10, 20, 17, 0).getTime()

const people = ["Rowan", "Jules", "Priya", "Mateo", "Sam", "Noor"]

function rotation(
  id: string,
  offsetHours: number,
  shift: number,
  lengthHours = 48
): TimelineEvent[] {
  const start = new Date(2026, 10, 1, 8).getTime()
  return Array.from({ length: 30 }, (_, index) => ({
    id: `${id}-${index}`,
    start: start + (index * lengthHours + offsetHours) * HOUR,
    end: start + ((index + 1) * lengthHours + offsetHours) * HOUR,
    label: people[(index + shift) % people.length],
    tone: (((index + shift) % 5) + 1) as TimelineEvent["tone"],
  }))
}

const override: TimelineEvent = {
  id: "override-alex",
  start: NOW - 6 * HOUR,
  end: NOW + 10 * HOUR,
  label: "Alex",
}

const coverage: TimelineLane[] = [
  {
    id: "primary",
    label: "Primary",
    events: withOverrides(rotation("primary", 0, 0), [override]),
  },
  { id: "secondary", label: "Secondary", events: rotation("secondary", 24, 3) },
]

const untoned = coverage.map((lane) => ({
  ...lane,
  events: lane.events.map(({ tone, ...event }) => event),
}))

const rooms: TimelineLane[] = [
  {
    id: "studio",
    label: "Studio A",
    events: [
      { id: "s1", start: NOW - 3 * HOUR, end: NOW + 1 * HOUR, label: "Mix review" },
      { id: "s2", start: NOW + 2 * HOUR, end: NOW + 5 * HOUR, label: "Tracking" },
      { id: "s3", start: NOW + 26 * HOUR, end: NOW + 30 * HOUR, label: "Mastering" },
    ],
  },
  {
    id: "booth",
    label: "Vocal booth",
    events: [
      { id: "b1", start: NOW - 1 * HOUR, end: NOW + 3 * HOUR, label: "Takes" },
      { id: "b2", start: NOW + 20 * HOUR, end: NOW + 23 * HOUR, label: "Overdubs" },
    ],
  },
  {
    id: "edit",
    label: "Edit suite",
    events: [
      { id: "e1", start: NOW - 30 * HOUR, end: NOW - 26 * HOUR, label: "Assembly" },
      { id: "e2", start: NOW + 4 * HOUR, end: NOW + 9 * HOUR, label: "Picture lock" },
    ],
  },
]

const hourFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

export default function TimelineScrubberDemo() {
  const [value, setValue] = React.useState(NOW + 3 * DAY)
  return (
    <>
      <Example
        title="On-call rotation with an override"
        description="Two lanes, the day ruler between them, and Alex covering part of Mateo's shift. Drag the track, flick it, scroll sideways, or focus the slider and use the arrow keys (Page Up and Page Down jump a day)."
      >
        <TimelineScrubber lanes={coverage} now={NOW} />
      </Example>
      <Example
        title="Without tones"
        description="Only the event under the playhead is filled. Use this when color would suggest a category that does not exist."
      >
        <TimelineScrubber lanes={untoned} now={NOW} />
      </Example>
      <Example
        title="Three lanes over two days"
        description="A shorter span suits bookings measured in hours. The ruler stays under the first lane."
      >
        <TimelineScrubber
          lanes={rooms}
          now={NOW}
          span={2 * DAY}
          range={7 * DAY}
          formatTime={(time) => hourFormat.format(time)}
        />
      </Example>
      <Example
        title="Controlled, away from now"
        description="The parent owns the playhead. The Now button appears whenever the playhead is away from the present."
      >
        <TimelineScrubber
          lanes={coverage}
          now={NOW}
          value={value}
          onValueChange={setValue}
        />
      </Example>
      <Example
        title="Empty lanes"
        description="Lanes with nothing in view say so in place, so the layout does not jump."
      >
        <TimelineScrubber
          lanes={[
            { id: "primary", label: "Primary", events: [], emptyLabel: "No schedule" },
            { id: "secondary", label: "Secondary", events: [] },
          ]}
          now={NOW}
        />
      </Example>
    </>
  )
}
