"use client"

import * as React from "react"
import { cn } from "cn"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"

function MarkdownCode({ language, value }: { language: string; value: string }) {
  const lines = useHighlightedCode(value, language || "text")
  return (
    <CodeBlock size="sm" className="my-1">
      <CodeBlockHeader>
        <CodeBlockTitle className="font-mono">{language || "text"}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={value} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

const components: Components = {
  h1: ({ node, className, ...props }) => (
    <h1 className={cn("mt-2 text-xl font-semibold tracking-tight text-balance", className)} {...props} />
  ),
  h2: ({ node, className, ...props }) => (
    <h2 className={cn("mt-2 text-lg font-semibold tracking-tight text-balance", className)} {...props} />
  ),
  h3: ({ node, className, ...props }) => (
    <h3 className={cn("mt-1 font-semibold", className)} {...props} />
  ),
  h4: ({ node, className, ...props }) => (
    <h4 className={cn("font-medium", className)} {...props} />
  ),
  p: ({ node, className, ...props }) => (
    <p className={cn("leading-relaxed", className)} {...props} />
  ),
  a: ({ node, className, ...props }) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-4", className)}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  ul: ({ node, className, ...props }) => (
    <ul className={cn("ml-5 list-disc space-y-1 marker:text-muted-foreground [&_ul]:mt-1", className)} {...props} />
  ),
  ol: ({ node, className, ...props }) => (
    <ol className={cn("ml-5 list-decimal space-y-1 marker:text-muted-foreground [&_ol]:mt-1", className)} {...props} />
  ),
  li: ({ node, className, ...props }) => (
    <li className={cn("leading-relaxed [&.task-list-item]:-ml-5 [&.task-list-item]:list-none", className)} {...props} />
  ),
  input: ({ node, className, ...props }) => (
    <input className={cn("mr-1.5 align-middle accent-primary", className)} {...props} />
  ),
  blockquote: ({ node, className, ...props }) => (
    <blockquote className={cn("border-l-2 pl-4 text-muted-foreground italic", className)} {...props} />
  ),
  hr: ({ node, className, ...props }) => (
    <hr className={cn("my-2 border-border", className)} {...props} />
  ),
  table: ({ node, className, ...props }) => (
    <div className="my-1 w-full overflow-x-auto rounded-lg border">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  ),
  thead: ({ node, className, ...props }) => (
    <thead className={cn("bg-muted/50", className)} {...props} />
  ),
  tr: ({ node, className, ...props }) => (
    <tr className={cn("border-b last:border-0", className)} {...props} />
  ),
  th: ({ node, className, ...props }) => (
    <th className={cn("px-3 py-2 text-left font-medium", className)} {...props} />
  ),
  td: ({ node, className, ...props }) => (
    <td className={cn("px-3 py-2 align-top", className)} {...props} />
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ node, className, children, ...props }) => {
    const match = /language-([\w-]+)/.exec(className ?? "")
    const value = String(children ?? "")
    // Fenced blocks carry a language class or span several lines.
    if (match || value.includes("\n"))
      return <MarkdownCode language={match?.[1] ?? ""} value={value} />
    return (
      <code
        className={cn("rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]", className)}
        {...props}
      >
        {children}
      </code>
    )
  },
}

type ChatMarkdownProps = Omit<React.ComponentProps<"div">, "children"> & {
  children: string
  /** Shows a caret after the last character while text is still arriving. */
  streaming?: boolean
}

function ChatMarkdown({ children, streaming, className, ...props }: ChatMarkdownProps) {
  return (
    <div
      data-slot="chat-markdown"
      data-streaming={streaming || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-3 text-sm wrap-break-word",
        "data-streaming:[&>*:last-child]:after:ml-0.5 data-streaming:[&>*:last-child]:after:inline-block data-streaming:[&>*:last-child]:after:h-[1em] data-streaming:[&>*:last-child]:after:w-[0.5em] data-streaming:[&>*:last-child]:after:translate-y-[0.15em] data-streaming:[&>*:last-child]:after:animate-pulse data-streaming:[&>*:last-child]:after:bg-foreground data-streaming:[&>*:last-child]:after:content-['']",
        className
      )}
      {...props}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

export { ChatMarkdown }
