import type { Knob } from "@/lib/design-systems/schema"

export const knobs: Knob[] = [
  { key: "openErrors", label: "Open failed steps", kind: "boolean", default: true, description: "Failed steps start expanded so the error is visible." },
]
