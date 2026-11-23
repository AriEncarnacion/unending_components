import type { Knob } from "@/lib/design-systems/schema"

export const knobs: Knob[] = [
  { key: "flightMs", label: "Card flight", kind: "duration", default: 180, min: 80, max: 600, step: 10, unit: "ms", description: "How long a decided card takes to fly off." },
  { key: "flightEase", label: "Flight easing", kind: "easing", default: "cubic-bezier(0.2, 0, 0, 1)" },
  { key: "flightDistance", label: "Flight distance", kind: "distance", default: 260, min: 80, max: 600, step: 10, unit: "px", description: "How far a decided card travels before it fades out." },
  { key: "commitDistance", label: "Commit distance", kind: "distance", default: 110, min: 40, max: 240, step: 5, unit: "px", description: "How far a drag must go before release decides." },
  { key: "deadZone", label: "Dead zone", kind: "distance", default: 18, min: 0, max: 60, step: 1, unit: "px", description: "Movement below this is ignored." },
]
