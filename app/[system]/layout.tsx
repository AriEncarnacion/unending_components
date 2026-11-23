import { fontOptions } from "@/app/fonts"
import { DesignSystemsProvider } from "@/components/showcase/design-systems/provider"
import { TokenOverridesProvider } from "@/components/showcase/token-overrides"
import { readCommitted } from "@/lib/design-systems/load"

// Everything under /<system>/ shows that design system: the catalog pages and
// the full-page preview frames. The id is the system's folder name, so
// renaming a system never changes its URLs.
export default async function SystemLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ system: string }>
}) {
  const [{ system }, committed] = await Promise.all([params, readCommitted()])
  return (
    <DesignSystemsProvider initial={committed} activeId={decodeURIComponent(system)}>
      <TokenOverridesProvider fonts={fontOptions}>{children}</TokenOverridesProvider>
    </DesignSystemsProvider>
  )
}
