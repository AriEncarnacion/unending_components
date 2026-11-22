## Intent

Read an AI agent's answer while it's still being written, and reply. Agent answers are markdown, so tables, code and lists need to render properly, and stay readable while half-finished.

## When to use

- A single conversation with one agent, inside a panel or page that has a fixed height.
- Answers that mix prose, code and structured lists.

Don't use it for multi-party chat, or where messages need avatars, reactions or threads. Build those from `Message` and `Bubble` directly.

## Anatomy

| Part | Built from | Notes |
| --- | --- | --- |
| Transcript | `MessageScroller` | When you send, your message is anchored near the top and the answer streams in below it, so you read from its start. A jump-to-latest button appears once the answer runs past the bottom. |
| Your message | `Message align="end"` + `Bubble variant="muted"` | Plain text with line breaks preserved. |
| Agent message | `Message` + `ChatMarkdown` | No bubble: answers get the full column width, which tables and code need. |
| Code | `CodeBlock` + `useHighlightedCode` | Shiki highlighting that streams line by line, with a language label and a copy button. |
| Thinking | `Marker` + `Spinner` + `shimmer` | Shown between sending and the first token. |
| Error | `Marker` in `text-destructive` | The partial answer stays visible above it. |
| Composer | `InputGroup` + `InputGroupTextarea` | Enter sends and Shift+Enter adds a new line. IME composition is respected. Send becomes Stop while the agent is busy. |

## States

`status` mirrors the AI SDK's `useChat`: `ready`, `submitted`, `streaming` and `error`. To wire it up, map each UI message's text parts into `content`.

## Wiring to the AI SDK

```tsx
const { messages, sendMessage, status, stop } = useChat()

<AgentChat
  messages={messages.map((m) => ({
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    content: m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join(""),
  }))}
  status={status}
  onSubmit={(text) => sendMessage({ text })}
  onStop={stop}
/>
```

## Not yet decided

- Tool calls and reasoning parts are dropped. The **Agent activity trace** entry is the intended companion for them.
- Unclosed markdown (for example a `**` still streaming) shows literally until it closes. A streaming-aware parser would fix this, at the cost of a dependency.
