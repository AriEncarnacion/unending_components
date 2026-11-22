import type { Knob } from "@/lib/design-systems/schema"

/** What a design system can tune in the agent trace. Defaults match its useEntryTuning call. */
export const knobs: Knob[] = [
  { key: "openErrors", label: "Open failed steps", kind: "boolean", default: true, description: "Failed steps start expanded so the error is visible." },
]
