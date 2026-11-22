"use client"

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block"
import { installCommand } from "@/lib/catalog"

export function InstallCommand({ name }: { name: string }) {
  const command = installCommand(name)
  return (
    <div className="flex max-w-2xl flex-col gap-1.5">
      <CodeBlock size="sm">
        <CodeBlockActions>
          <CodeBlockCopyButton value={command} />
        </CodeBlockActions>
        <CodeBlockContent>{command}</CodeBlockContent>
      </CodeBlock>
      <p className="text-xs text-muted-foreground">
        In a project linked to a design system with /unending:setup. It arrives tuned for that system.
      </p>
    </div>
  )
}
