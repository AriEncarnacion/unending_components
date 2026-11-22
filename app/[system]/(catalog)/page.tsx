import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { entries, REGISTRY_ADDRESS } from "@/lib/catalog"

export default async function CatalogPage({ params }: { params: Promise<{ system: string }> }) {
  const { system } = await params
  return (
    <div className="flex flex-col gap-10">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Components named for what you’re trying to do
        </h1>
        <p className="text-muted-foreground">
          Each entry is an intent, such as scrubbing through parallel schedules
          or reading an agent’s answer as it streams. It’s built from stock
          shadcn parts on one shared theme and installs with one command from{" "}
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            {REGISTRY_ADDRESS}
          </code>
          .
        </p>
      </header>
      <ItemGroup className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => (
          <Item
            key={entry.name}
            variant="outline"
            render={<Link href={`/${system}/c/${entry.name}`} />}
            className="items-start"
          >
            <ItemContent>
              <ItemTitle>{entry.title}</ItemTitle>
              <ItemDescription className="line-clamp-3">{entry.intent}</ItemDescription>
            </ItemContent>
            <ItemFooter className="justify-start gap-1.5">
              <Badge variant="secondary">{entry.status}</Badge>
              {entry.categories.map((category) => (
                <Badge key={category} variant="outline">
                  {category}
                </Badge>
              ))}
            </ItemFooter>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}
