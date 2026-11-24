import { notFound } from "next/navigation"

import { PageNavPreview } from "@/registry/unending/page-nav/preview"

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { name } = await params
  const query = await searchParams
  if (name === "page-nav")
    return (
      <PageNavPreview
        collapsed={query.collapsed === "1"}
        initialPath={query.path}
        filterThreshold={query.filter ? Number(query.filter) : undefined}
      />
    )
  notFound()
}
