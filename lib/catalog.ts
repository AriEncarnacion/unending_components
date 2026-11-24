import registry from "@/registry.json"

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

export function installCommand(name: string) {
  return `npx shadcn@4.23.0 add @unending/${name}`
}
