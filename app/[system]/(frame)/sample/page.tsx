import type { Metadata } from "next"

import { ComposedScreen } from "@/components/showcase/system/composed"

export const metadata: Metadata = { robots: { index: false } }

export default function SamplePage() {
  return (
    <div className="min-h-svh bg-background p-6">
      <style>{"nextjs-portal{display:none!important}"}</style>
      <div data-sample="" className="mx-auto w-full max-w-6xl">
        <ComposedScreen />
      </div>
    </div>
  )
}
