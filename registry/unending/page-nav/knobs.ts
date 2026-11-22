import type { Knob } from "@/lib/design-systems/schema"

/** What a design system can tune in page navigation. Defaults match its useEntryTuning call. */
export const knobs: Knob[] = [
  { key: "filterThreshold", label: "Filter from", kind: "number", default: 12, min: 0, max: 40, step: 1, description: "Show the page filter once the nav has this many pages." },
  { key: "collapsible", label: "Collapses to", kind: "enum", default: "icon", options: ["icon", "offcanvas", "none"], description: "What the nav does when collapsed, unless the caller sets it." },
]
