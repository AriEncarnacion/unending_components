"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="mt-3 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-3 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-3 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 font-semibold first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mt-2 leading-relaxed text-pretty first:mt-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-4 first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-1.5 flex list-decimal flex-col gap-1.5 pl-4 first:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed text-pretty">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-md bg-background p-2 font-mono first:mt-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 pl-3 text-muted-foreground first:mt-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto first:mt-0">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b px-2 py-1 align-top">{children}</td>
  ),
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1_500)
    return () => window.clearTimeout(timer)
  }, [copied])
  return (
    <Button
      size="xs"
      variant="ghost"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => toast.error("Couldn’t copy to the clipboard")
        )
      }
    >
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      {copied ? "Copied" : label}
    </Button>
  )
}

export function Findings({
  title,
  text,
  copyText,
  format,
}: {
  title: string
  text: string
  copyText: string
  format: "markdown" | "log"
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
        <CopyButton text={copyText} label="Copy" />
      </div>
      <div className="max-h-80 overflow-y-auto rounded-md bg-muted p-3 text-xs">
        {format === "markdown" ? (
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {text}
          </Markdown>
        ) : (
          <pre className="font-mono whitespace-pre-wrap">{text}</pre>
        )}
      </div>
    </section>
  )
}
