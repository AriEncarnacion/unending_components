"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

const block = "mt-[2em] first:mt-0"
const heading = `${block} font-semibold`
const list = `${block} flex flex-col gap-[0.6em] pl-[1.5em] [h3+&]:mt-[0.75em] [h4+&]:mt-[0.75em] [li>&]:mt-[0.6em]`

const markdownComponents: Components = {
  h1: ({ children }) => <h3 className={heading}>{children}</h3>,
  h2: ({ children }) => <h3 className={heading}>{children}</h3>,
  h3: ({ children }) => <h3 className={heading}>{children}</h3>,
  h4: ({ children }) => <h4 className={heading}>{children}</h4>,
  p: ({ children }) => <p className={`${block} text-pretty [li>&]:mt-0`}>{children}</p>,
  ul: ({ children }) => <ul className={`${list} list-disc`}>{children}</ul>,
  ol: ({ children }) => <ol className={`${list} list-decimal`}>{children}</ol>,
  li: ({ children }) => <li className="text-pretty">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  pre: ({ children }) => <pre className={`${block} overflow-x-auto rounded-md bg-background p-3 font-mono text-xs`}>{children}</pre>,
  blockquote: ({ children }) => <blockquote className={`${block} border-l-2 pl-3 text-muted-foreground`}>{children}</blockquote>,
  hr: () => <hr className={`${block} border-border`} />,
  table: ({ children }) => (
    <div className={`${block} overflow-x-auto`}>
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
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
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {copied ? "Copied" : label}
    </Button>
  )
}

export function Findings({ text, copyText, format }: { text: string; copyText: string; format: "markdown" | "log" }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <CopyButton text={copyText} label="Copy feedback" />
      </div>
      <div className="max-h-[30rem] overflow-y-auto rounded-lg bg-muted p-4 text-sm leading-[1.75] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_50%,transparent)_transparent] [scrollbar-width:thin]">
        {format === "markdown" ? (
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {text}
          </Markdown>
        ) : (
          <pre className="font-mono text-xs whitespace-pre-wrap">{text}</pre>
        )}
      </div>
    </section>
  )
}
