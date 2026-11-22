import { InfoButton } from "@/components/showcase/info-button"
import { SiteShell } from "@/components/showcase/site-shell"
import { entries } from "@/lib/catalog"

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell entries={entries.map(({ name, title, status }) => ({ name, title, status }))}>
      {children}
      <InfoButton />
    </SiteShell>
  )
}
