import type { Knob } from "@/lib/design-systems/schema"

export const knobs: Knob[] = [
  { key: "sectionMs", label: "Section open", kind: "duration", default: 200, min: 0, max: 600, step: 10, unit: "ms", description: "How long a section takes to open or close." },
  { key: "sectionsOpen", label: "Sections start open", kind: "boolean", default: true, description: "Whether sections start open when the caller doesn't say." },
]
