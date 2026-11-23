import { Suspense } from "react"
import type { Metadata } from "next"

import { SystemPage, SystemPageWithParams } from "@/components/showcase/system/system-page"

export const metadata: Metadata = {
  title: "Design system",
  description: "Every token the catalog is built on, live and tunable.",
}

export default function Page() {
  return (
    <Suspense fallback={<SystemPage />}>
      <SystemPageWithParams />
    </Suspense>
  )
}
