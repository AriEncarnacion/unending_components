import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DemoView, FrameReady } from "@/components/showcase/demo-view"
import { getEntry } from "@/lib/catalog"

export const metadata: Metadata = { robots: { index: false } }

/**
 * Just an entry's demo, with no showcase around it, for checking sizes. The
 * Sizes view loads it in a frame sized to a device. `?w=<px>` puts the demo in
 * a container that wide, to test a narrow container in a wide window.
 *
 * Dynamic on purpose: it reads `searchParams`, a request-time API, so it has no
 * `generateStaticParams`.
 */
export default async function FramePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ name }, query] = await Promise.all([params, searchParams])
  if (!getEntry(name)) notFound()
  const width = Number(query.w)

  return (
    <div className="min-h-svh bg-background p-4">
      {/* A frame shows the component alone: no dev overlay over it. */}
      <style>{"nextjs-portal{display:none!important}"}</style>
      <div
        data-frame-root=""
        className="flex min-w-0 flex-col gap-10"
        style={width > 0 ? { width, maxWidth: "100%" } : undefined}
      >
        <DemoView name={name} after={<FrameReady />} />
      </div>
    </div>
  )
}
