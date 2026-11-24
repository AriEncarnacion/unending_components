import type { Knob } from "@/lib/design-systems/schema"

export const knobs: Knob[] = [
  { key: "actionVariant", label: "Action buttons", kind: "enum", default: "ghost", options: ["ghost", "outline", "secondary"], description: "The button style of actions shown in the bar." },
]
