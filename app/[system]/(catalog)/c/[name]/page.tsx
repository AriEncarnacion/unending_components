import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { EntryTuner } from "@/components/showcase/design-systems/entry-tuner"
import { InstallCommand } from "@/components/showcase/install-command"
import { Notes } from "@/components/showcase/notes"
import { demos, entries, getEntry } from "@/lib/catalog"

export function generateStaticParams() {
  return entries.map((entry) => ({ name: entry.name }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>
}): Promise<Metadata> {
  const { name } = await params
  const entry = getEntry(name)
  return entry ? { title: entry.title, description: entry.intent } : {}
}

export default async function EntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const entry = getEntry(name)
  const loadDemo = demos[name]
  if (!entry || !loadDemo) notFound()

  const { default: Demo } = await loadDemo()
  const notes = await readFile(
    path.join(process.cwd(), "registry/unending", name, "README.md"),
    "utf8"
  ).catch(() => "")

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{entry.status}</Badge>
          {entry.categories.map((category) => (
            <Badge key={category} variant="outline">
              {category}
            </Badge>
          ))}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {entry.title}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
          {entry.intent}
        </p>
        <p className="text-sm text-muted-foreground">{entry.origin}</p>
        <InstallCommand name={entry.name} />
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <EntryTuner
          name={entry.name}
          className="xl:sticky xl:top-16 xl:order-last xl:max-h-[calc(100svh-5rem)] xl:self-start"
        />
        <div className="flex min-w-0 flex-col gap-10">
          <Demo />
        </div>
      </div>

      {notes ? (
        <>
          <Separator />
          <Notes source={notes} />
        </>
      ) : null}

      <Separator />
      <section className="grid gap-6 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Files</h2>
          <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
            {entry.files.map((file) => (
              <li key={file} className="break-all">
                {file.split("/").at(-1)}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Built from</h2>
          <ul className="flex flex-wrap gap-1.5">
            {entry.registryDependencies.map((dependency) => (
              <li key={dependency}>
                <Badge variant="outline" className="font-mono font-normal">
                  {dependency.split("/").at(-1)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Packages</h2>
          <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
            {entry.dependencies.map((dependency) => (
              <li key={dependency}>{dependency}</li>
            ))}
          </ul>
        </div>
      </section>
    </article>
  )
}
