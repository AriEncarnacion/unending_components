import type { Metadata } from "next"

import { SystemPage } from "@/components/showcase/system/system-page"

export const metadata: Metadata = {
  title: "Design system",
  description: "Every token the catalog is built on, live and tunable.",
}

export default function Page() {
  return <SystemPage />
}
