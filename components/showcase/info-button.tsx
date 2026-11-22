"use client"

import { InfoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const REPO = "AriEncarnacion/unending_components"

const pages: { name: string; body: string }[] = [
  { name: "Design systems", body: "Every system. Open, duplicate, rename, delete, or start one on the shadcn base." },
  { name: "Entries", body: "The catalog's intent-level components, as the open system shows them." },
  { name: "Entry", body: "Live examples, install command, intent and UX notes, and the tuning inspector." },
  { name: "Design system", body: "Every token, live. Tune colour, radius, spacing, type and motion." },
  { name: "Palette", body: "Grade the raw colour scales and check contrast. Push steps into theme tokens." },
]

type CommandInfo = { name: string; body: string }

const commandSections: { title: string; context: string; commands: CommandInfo[] }[] = [
  {
    title: "In an app",
    context: "Run in a Claude session opened on a project that uses a design system.",
    commands: [
      { name: "/unending:setup", body: "Link the app to one design system and install its theme, fonts and design rules." },
      { name: "/unending:sync", body: "Show what changed in the linked system and pull only what you approve." },
    ],
  },
  {
    title: "In the catalog",
    context: "Run in a Claude session opened on this repo, to grow the catalog.",
    commands: [
      { name: "/unending:create <intent>", body: "Design and build a new entry from what someone is trying to do." },
      { name: "/unending:capture <screenshot or URL>", body: "Rebuild a pattern you spotted as a new entry on stock shadcn parts." },
      { name: "/unending:harvest <path>", body: "Promote a component from one of your apps into the catalog." },
      { name: "/unending:restyle <registry item>", body: "Adopt an item from another shadcn registry, restyled onto the catalog." },
    ],
  },
]

function Command({ value }: { value: string }) {
  return (
    <CodeBlock size="sm">
      <CodeBlockActions>
        <CodeBlockCopyButton value={value} />
      </CodeBlockActions>
      <CodeBlockContent>{value}</CodeBlockContent>
    </CodeBlock>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs text-muted-foreground">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  )
}

/** A small "i" pinned bottom-left that opens a guide to the catalog, its commands and installing from it. */
export function InfoButton() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="About the catalog"
            className="fixed bottom-4 left-4 z-40 rounded-full bg-background shadow-sm"
          />
        }
      >
        <InfoIcon />
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Unending catalog</DialogTitle>
          <DialogDescription>
            Tune a design system here, Ship it, then install its entries into any app.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="guide" className="min-h-0 flex-1">
          <TabsList>
            <TabsTrigger value="guide">Guide</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="install">Install</TabsTrigger>
          </TabsList>

          <TabsContent value="guide" className="-mx-4 overflow-y-auto px-4 pt-2">
            <dl className="flex flex-col gap-3">
              {pages.map((page) => (
                <div key={page.name} className="flex flex-col gap-0.5">
                  <dt className="font-medium">{page.name}</dt>
                  <dd className="text-muted-foreground">{page.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t pt-3 text-muted-foreground">
              Edits stay a draft in your browser. <span className="text-foreground">Save</span> writes the
              system&apos;s files; <span className="text-foreground">Ship</span> opens a PR, waits for CI and
              the Claude review, and merges. Keep the dev server running until it says Shipped.
            </p>
          </TabsContent>

          <TabsContent value="commands" className="-mx-4 overflow-y-auto px-4 pt-2">
            <div className="flex flex-col gap-5">
              {commandSections.map((section) => (
                <section key={section.title} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-medium">{section.title}</h3>
                    <p className="text-xs text-muted-foreground">{section.context}</p>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {section.commands.map((command) => (
                      <li key={command.name} className="flex flex-col gap-0.5">
                        <code className="font-mono text-xs font-medium break-all">{command.name}</code>
                        <p className="text-muted-foreground">{command.body}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <p className="mt-4 border-t pt-3 text-muted-foreground">
              Or just ask for UI. The catalog skill finds a matching entry by intent and installs it, already
              tuned for the app&apos;s system.
            </p>
          </TabsContent>

          <TabsContent value="install" className="-mx-4 overflow-y-auto px-4 pt-2">
            <ol className="flex flex-col gap-4">
              <Step n={1} title="Get access">
                <p className="text-muted-foreground">
                  The repo is private. Ask Ari for read access to <code className="font-mono text-xs">{REPO}</code>,
                  then sign in to GitHub on your machine.
                </p>
                <Command value="gh auth login" />
              </Step>
              <Step n={2} title="Install the plugin (once per machine)">
                <Command value={`claude plugin marketplace add ${REPO}`} />
                <Command value="claude plugin install unending@unending" />
              </Step>
              <Step n={3} title="Link the app to a shipped system">
                <p className="text-muted-foreground">
                  In a Claude session opened on the app, run <code className="font-mono text-xs">/unending:setup</code> and
                  pick the system. Only shipped systems are offered: setup reads what&apos;s merged on{" "}
                  <code className="font-mono text-xs">main</code>. Give it a token in the app&apos;s git-ignored{" "}
                  <code className="font-mono text-xs">.env.local</code>:
                </p>
                <Command value='echo "GITHUB_TOKEN=$(gh auth token)" >> .env.local' />
              </Step>
              <Step n={4} title="Install entries">
                <p className="text-muted-foreground">Ask Claude for the UI you need, or add an entry by name:</p>
                <Command value="npx shadcn@latest add @unending/review-deck" />
              </Step>
              <Step n={5} title="Pull later ships">
                <p className="text-muted-foreground">
                  After you Ship changes to that system, run <code className="font-mono text-xs">/unending:sync</code> in
                  the app. Plugin updates arrive with:
                </p>
                <Command value="claude plugin marketplace update unending" />
              </Step>
            </ol>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
