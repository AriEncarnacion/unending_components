import type { Knob } from "@/lib/design-systems/schema"

/** What a design system can tune in the file toolbar. Defaults match its useEntryTuning call. */
export const knobs: Knob[] = [
  { key: "actionVariant", label: "Action buttons", kind: "enum", default: "ghost", options: ["ghost", "outline", "secondary"], description: "The button style of actions shown in the bar." },
]
