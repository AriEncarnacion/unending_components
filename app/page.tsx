import type { Metadata } from "next"

import { fontOptions } from "@/app/fonts"
import { DesignSystemsProvider } from "@/components/showcase/design-systems/provider"
import { SystemsHome } from "@/components/showcase/design-systems/home"
import { InfoButton } from "@/components/showcase/info-button"
import { readCommitted } from "@/lib/design-systems/load"

export const metadata: Metadata = {
  title: "Design systems",
  description: "Every design system in the Unending catalog.",
}

export default async function HomePage() {
  const committed = await readCommitted()
  return (
    <DesignSystemsProvider initial={committed}>
      <SystemsHome fonts={[...fontOptions.sans, ...fontOptions.heading, ...fontOptions.mono]} />
      <InfoButton />
    </DesignSystemsProvider>
  )
}
