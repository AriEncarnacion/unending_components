"use client"

import { ChatMarkdown } from "@/registry/unending/agent-chat/chat-markdown"

/** Renders an entry's README with the catalog's own markdown renderer. */
export function Notes({ source }: { source: string }) {
  return (
    <ChatMarkdown className="max-w-3xl text-[0.9375rem] [&_h2]:mt-6 [&_h2]:first:mt-0">
      {source}
    </ChatMarkdown>
  )
}
