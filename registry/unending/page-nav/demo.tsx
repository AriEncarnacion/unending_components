"use client"

import { useParams } from "next/navigation"

import { Example } from "@/components/showcase/example"

// The stock sidebar switches to a sheet below 768px, so frames keep a
// desktop width and scroll sideways on small screens instead.
function Frame({ query, title, mobile = false }: { query: string; title: string; mobile?: boolean }) {
  // Frames follow the design system in the catalog URL.
  const { system } = useParams<{ system: string }>()
  return (
    <div className="overflow-x-auto rounded-lg border">
      <iframe
        title={title}
        src={`/${system}/preview/page-nav?${query}`}
        className={mobile ? "mx-auto block h-[30rem] w-[390px] bg-background" : "block h-[30rem] w-full min-w-[860px] bg-background"}
      />
    </div>
  )
}

export default function PageNavDemo() {
  return (
    <>
      <Example
        title="Grouped pages with sub-pages"
        description="The current page’s group opens on load and the page is marked. Click pages to move around. This app has 14 pages, past the default threshold of 12, so a filter appears: try “run”. Press ⌘B or Ctrl+B with the frame focused, or use the header button, to collapse to icons with tooltips."
        className="p-0 max-sm:p-0"
      >
        <Frame title="Page navigation" query="path=/rotations/primary" />
      </Example>
      <Example
        title="Short lists skip the filter"
        description="With the threshold raised above the page count, there is no filter field."
        className="p-0 max-sm:p-0"
      >
        <Frame title="Page navigation without filter" query="path=/coverage&filter=40" />
      </Example>
      <Example
        title="Starts collapsed"
        description="Icon-only, for dense tools. The state is remembered in a cookie by the stock sidebar."
        className="p-0 max-sm:p-0"
      >
        <Frame title="Collapsed page navigation" query="path=/incidents&collapsed=1" />
      </Example>
      <Example
        title="Phone width"
        description="Below 768px the stock sidebar becomes a sheet. Open it with the header button."
        className="p-4"
      >
        <Frame title="Page navigation on a phone" query="path=/knowledge/runbooks" mobile />
      </Example>
    </>
  )
}
