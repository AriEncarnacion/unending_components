"use client"

import type * as React from "react"

export const demoLoaders: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "timeline-scrubber": () => import("@/registry/unending/timeline-scrubber/demo"),
  "agent-chat": () => import("@/registry/unending/agent-chat/demo"),
  "review-deck": () => import("@/registry/unending/review-deck/demo"),
  "page-nav": () => import("@/registry/unending/page-nav/demo"),
  "inspector-panel": () => import("@/registry/unending/inspector-panel/demo"),
  "file-toolbar": () => import("@/registry/unending/file-toolbar/demo"),
  "agent-trace": () => import("@/registry/unending/agent-trace/demo"),
}
