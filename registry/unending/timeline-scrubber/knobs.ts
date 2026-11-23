import type { Knob } from "@/lib/design-systems/schema"

export const knobs: Knob[] = [
  { key: "spanDays", label: "Visible span", kind: "number", default: 14, min: 3, max: 42, step: 1, unit: "days", description: "How much time the track shows when the caller doesn't set span." },
  { key: "glideMinMs", label: "Glide, short", kind: "duration", default: 320, min: 120, max: 800, step: 10, unit: "ms", description: "Duration of the shortest animated move." },
  { key: "glideMaxMs", label: "Glide, longest", kind: "duration", default: 700, min: 200, max: 1400, step: 10, unit: "ms", description: "Cap on animated moves across the track." },
  { key: "snapPercent", label: "Snap reach", kind: "number", default: 4, min: 0, max: 12, step: 0.5, unit: "%", description: "How close to an event edge, as a share of the span, a release snaps to it." },
  { key: "flickCarry", label: "Flick carry", kind: "number", default: 200, min: 0, max: 600, step: 10, description: "How far a flick keeps travelling after release." },
]
