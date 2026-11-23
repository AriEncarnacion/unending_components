import { ShipProvider } from "@/components/showcase/design-systems/ship"
import { InfoButton } from "@/components/showcase/info-button"
import { SiteShell } from "@/components/showcase/site-shell"
import { entries } from "@/lib/catalog"

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    // Ship status (git, polled) is for the catalog's menus only, not preview frames.
    <ShipProvider>
      <SiteShell entries={entries.map(({ name, title, status }) => ({ name, title, status }))}>
        {children}
        <InfoButton />
      </SiteShell>
    </ShipProvider>
  )
}
