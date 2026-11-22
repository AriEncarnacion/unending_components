"use client"

import * as React from "react"
import { cn } from "cn"
import { ArrowUpIcon, SquareIcon, TriangleAlertIcon } from "lucide-react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { useEntryTuning } from "@/lib/tuning"
import { Spinner } from "@/components/ui/spinner"

import { ChatMarkdown } from "./chat-markdown"

export type AgentChatMessage = {
  id: string
  role: "user" | "assistant"
  /** Markdown. Assistant text may be partial while it streams. */
  content: string
}

/** Mirrors the AI SDK's `useChat` status so the two can be wired directly. */
export type AgentChatStatus = "ready" | "submitted" | "streaming" | "error"

export type AgentChatProps = Omit<React.ComponentProps<"div">, "onSubmit"> & {
  messages: AgentChatMessage[]
  status?: AgentChatStatus
  onSubmit?: (text: string) => void
  onStop?: () => void
  error?: string
  placeholder?: string
  /** Shown before the first message. */
  empty?: React.ReactNode
}

function AgentChat({
  messages,
  status = "ready",
  onSubmit,
  onStop,
  error,
  placeholder: placeholderProp,
  empty,
  className,
  ...props
}: AgentChatProps) {
  const tuning = useEntryTuning("agent-chat", { placeholder: "Ask anything" })
  const placeholder = placeholderProp ?? tuning.placeholder
  const [draft, setDraft] = React.useState("")
  const busy = status === "submitted" || status === "streaming"
  const last = messages.at(-1)

  const submit = () => {
    const text = draft.trim()
    if (!text || busy) return
    onSubmit?.(text)
    setDraft("")
  }

  return (
    <div
      data-slot="agent-chat"
      data-status={status}
      className={cn("flex min-h-0 flex-col gap-3", className)}
      {...props}
    >
      <MessageScrollerProvider>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="p-1">
              {messages.length === 0 && empty ? (
                <div className="m-auto max-w-sm text-center text-sm text-muted-foreground">
                  {empty}
                </div>
              ) : null}
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      {message.role === "user" ? (
                        <Bubble variant="muted">
                          <BubbleContent className="whitespace-pre-wrap">
                            {message.content}
                          </BubbleContent>
                        </Bubble>
                      ) : (
                        <ChatMarkdown
                          streaming={
                            status === "streaming" && message.id === last?.id
                          }
                        >
                          {message.content}
                        </ChatMarkdown>
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              {status === "submitted" ? (
                <MessageScrollerItem scrollAnchor={false}>
                  <Marker role="status">
                    <MarkerIcon>
                      <Spinner />
                    </MarkerIcon>
                    <MarkerContent className="shimmer">Thinking…</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              ) : null}
              {status === "error" ? (
                <MessageScrollerItem scrollAnchor={false}>
                  <Marker role="alert" className="text-destructive">
                    <MarkerIcon>
                      <TriangleAlertIcon />
                    </MarkerIcon>
                    <MarkerContent>
                      {error ?? "The reply stopped early. Send again to retry."}
                    </MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <InputGroup>
          <InputGroupTextarea
            aria-label="Message"
            placeholder={placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
            className="max-h-40 min-h-10"
          />
          <InputGroupAddon align="block-end" className="justify-end">
            {busy ? (
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant="secondary"
                aria-label="Stop"
                onClick={onStop}
              >
                <SquareIcon className="fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                size="icon-sm"
                variant="default"
                aria-label="Send"
                disabled={!draft.trim()}
              >
                <ArrowUpIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  )
}

export { AgentChat }
