import type { Knob } from "@/lib/design-systems/schema"

/** What a design system can tune in the agent chat. Defaults match its useEntryTuning call. */
export const knobs: Knob[] = [
  { key: "placeholder", label: "Placeholder", kind: "text", default: "Ask anything", description: "The composer's placeholder when the caller doesn't set one." },
]
