"use client"

import * as React from "react"

import { Example } from "@/components/showcase/example"
import {
  AgentChat,
  type AgentChatMessage,
  type AgentChatStatus,
} from "@/registry/unending/agent-chat/agent-chat"
import { ChatMarkdown } from "@/registry/unending/agent-chat/chat-markdown"

const REPLY = `Here's the coverage for tonight.

| Lane | Who | Until |
| --- | --- | --- |
| Primary | **Alex** (override) | Sat 03:07 |
| Secondary | Jules | Sat 04:00 |

The override splits Mateo's shift in two, so he's back on at \`03:07\`. This is the check I ran:

\`\`\`ts
const shift = lanes.primary.find(
  (s) => s.start <= now && now < s.end
)
if (!shift) return "No coverage"
return \`\${shift.label} · \${remaining(shift, now)}\`
\`\`\`

Things to watch:

1. **Handoff at 03:07.** Mateo hasn't acknowledged it yet.
2. Secondary has a *4-hour gap* on Tuesday.
   - [x] Flagged in #support-rota
   - [ ] Someone assigned

> Want a reminder an hour before the handoff?`

const FORMATTING = `### Everything the renderer handles

Text can be **bold**, *italic*, ~~struck~~, \`inline code\` or a [link](https://ui.shadcn.com).

- Lists, nested:
  - like this
- Task lists:
  - [x] done
  - [ ] not yet

\`\`\`bash
npx shadcn@latest add AriEncarnacion/unending_components/agent-chat
\`\`\`

\`\`\`json
{ "lanes": 2, "gaps": 0 }
\`\`\`

---

> Quotes for caveats.`

const seed: AgentChatMessage[] = [
  { id: "u1", role: "user", content: "Who's covering primary tonight, and when does it hand back?" },
]

function useScriptedAgent(initial: AgentChatMessage[]) {
  const [messages, setMessages] = React.useState(initial)
  const [status, setStatus] = React.useState<AgentChatStatus>("ready")
  const timers = React.useRef<number[]>([])

  const clear = React.useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }, [])
  React.useEffect(() => clear, [clear])

  const reply = React.useCallback((text: string, fail = false) => {
    clear()
    setStatus("submitted")
    const id = `a${Date.now()}`
    const chunks = text.match(/[\s\S]{1,6}/g) ?? []
    timers.current.push(
      window.setTimeout(() => {
        setStatus("streaming")
        setMessages((previous) => [...previous, { id, role: "assistant", content: "" }])
        chunks.forEach((_, index) => {
          timers.current.push(
            window.setTimeout(() => {
              if (fail && index === Math.floor(chunks.length / 3)) {
                clear()
                setStatus("error")
                return
              }
              const content = chunks.slice(0, index + 1).join("")
              setMessages((previous) =>
                previous.map((message) => (message.id === id ? { ...message, content } : message))
              )
              if (index === chunks.length - 1) setStatus("ready")
            }, index * 24)
          )
        })
      }, 900)
    )
  }, [clear])

  const send = (text: string, answer = REPLY, fail = false) => {
    setMessages((previous) => [...previous, { id: `u${Date.now()}`, role: "user", content: text }])
    reply(answer, fail)
  }
  const stop = () => {
    clear()
    setStatus("ready")
  }
  return { messages, status, send, stop, reply, cancel: clear }
}

function LiveChat() {
  const chat = useScriptedAgent(seed)
  const { reply, cancel } = chat
  React.useEffect(() => {
    // Answer the seeded question. Cancelling on cleanup lets Strict Mode's
    // mount, unmount, mount cycle restart the reply instead of stranding it.
    reply(REPLY)
    return cancel
  }, [reply, cancel])
  return (
    <AgentChat
      className="h-[34rem]"
      messages={chat.messages}
      status={chat.status}
      onSubmit={(text) => chat.send(text)}
      onStop={chat.stop}
    />
  )
}

function FailingChat() {
  const chat = useScriptedAgent([])
  return (
    <AgentChat
      className="h-80"
      messages={chat.messages}
      status={chat.status}
      onSubmit={(text) => chat.send(text, REPLY, true)}
      onStop={chat.stop}
      empty="Send anything. This agent fails a third of the way through its reply."
    />
  )
}

export default function AgentChatDemo() {
  return (
    <>
      <Example
        title="Streamed reply"
        description="Send a message to stream a scripted answer with a table, code, a numbered list and task items. Your message is anchored near the top and the answer streams in beneath it. While it streams, Send becomes Stop. A jump-to-latest button appears once the answer runs past the bottom."
      >
        <LiveChat />
      </Example>
      <Example
        title="Error mid-stream"
        description="The partial answer stays put and a destructive marker explains what to do next."
      >
        <FailingChat />
      </Example>
      <Example
        title="Formatting reference"
        description="The markdown renderer on its own, at rest. It is exported separately as ChatMarkdown."
      >
        <ChatMarkdown>{FORMATTING}</ChatMarkdown>
      </Example>
    </>
  )
}
