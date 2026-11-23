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
