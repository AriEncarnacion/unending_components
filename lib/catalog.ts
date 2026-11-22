import type * as React from "react"

import registry from "@/registry.json"

/** Where the registry lives. Entries install as `<REGISTRY_ADDRESS>/<name>`. */
export const REGISTRY_ADDRESS = "AriEncarnacion/unending_components"

export type EntryStatus = "draft" | "refined" | "stable"

export type CatalogEntry = {
  name: string
  title: string
  description: string
  intent: string
  status: EntryStatus
  origin: string
  categories: string[]
  files: string[]
  registryDependencies: string[]
  dependencies: string[]
}

type RegistryItem = (typeof registry.items)[number] & {
  categories?: string[]
  dependencies?: string[]
  registryDependencies?: string[]
  files?: { path: string }[]
  meta?: { entry?: boolean; intent?: string; status?: string; origin?: string }
}

export const entries: CatalogEntry[] = (registry.items as RegistryItem[])
  .filter((item) => item.meta?.entry)
  .map((item) => ({
    name: item.name,
    title: item.title ?? item.name,
    description: item.description ?? "",
    intent: item.meta?.intent ?? "",
    status: (item.meta?.status as EntryStatus) ?? "draft",
    origin: item.meta?.origin ?? "",
    categories: item.categories ?? [],
    files: (item.files ?? []).map((file) => file.path),
    registryDependencies: item.registryDependencies ?? [],
    dependencies: item.dependencies ?? [],
  }))

export function getEntry(name: string) {
  return entries.find((entry) => entry.name === name)
}

/** In a project linked to a design system (/unending:setup), entries install tuned for it. */
export function installCommand(name: string) {
  return `npx shadcn@latest add @unending/${name}`
}

type DemoModule = { default: React.ComponentType }

/** Each entry's live states. Keep in step with registry.json. */
export const demos: Record<string, () => Promise<DemoModule>> = {
  "timeline-scrubber": () => import("@/registry/unending/timeline-scrubber/demo"),
  "agent-chat": () => import("@/registry/unending/agent-chat/demo"),
  "review-deck": () => import("@/registry/unending/review-deck/demo"),
  "file-toolbar": () => import("@/registry/unending/file-toolbar/demo"),
  "inspector-panel": () => import("@/registry/unending/inspector-panel/demo"),
  "page-nav": () => import("@/registry/unending/page-nav/demo"),
  "agent-trace": () => import("@/registry/unending/agent-trace/demo"),
}
