// Each entry's declared knobs (registry/unending/<name>/knobs.ts), for the
// tuning inspector and the Save route's validation. Keep in step with the
// entries that call useEntryTuning; registry:check verifies it.
import type { Knob } from "@/lib/design-systems/schema"
import { knobs as agentChat } from "@/registry/unending/agent-chat/knobs"
import { knobs as agentTrace } from "@/registry/unending/agent-trace/knobs"
import { knobs as fileToolbar } from "@/registry/unending/file-toolbar/knobs"
import { knobs as inspectorPanel } from "@/registry/unending/inspector-panel/knobs"
import { knobs as pageNav } from "@/registry/unending/page-nav/knobs"
import { knobs as reviewDeck } from "@/registry/unending/review-deck/knobs"
import { knobs as timelineScrubber } from "@/registry/unending/timeline-scrubber/knobs"

export const entryKnobs: Record<string, Knob[]> = {
  "agent-chat": agentChat,
  "agent-trace": agentTrace,
  "file-toolbar": fileToolbar,
  "inspector-panel": inspectorPanel,
  "page-nav": pageNav,
  "review-deck": reviewDeck,
  "timeline-scrubber": timelineScrubber,
}
