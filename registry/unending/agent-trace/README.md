## Intent

Watch what an agent is doing, step by step, and look closer at any step without being buried in detail. While the agent works, the trace says what it's doing right now. When it's done, the run folds into one line you can open if you want to check its work.

## When to use

- Above or beside an agent's answer (pair it with **Agent Chat**), or in a job or run log.
- Runs of a few to a few dozen steps, possibly with sub-steps.

Don't use it for logs with thousands of lines. Use a `CodeBlock` with scrolling for those.

## Anatomy

| Part | Built from | Notes |
| --- | --- | --- |
| Run summary | `TraceCollapsible` + `TraceLine` | Shows the current step while running, "Worked for 34s · 5 steps" when done, and "Stopped after an error" on failure. |
| Step | `TraceLine` + `TraceIcon` + `TraceTitle` + `TraceDescription` | The icon is by kind: think, search, read, edit, command, web or tool. Running steps show a `Spinner` and a `shimmer` title. The description holds the result and duration. |
| Step body | `TraceCollapsibleContent` | Holds reasoning text, highlighted tool input or output (`CodeBlock` + `useHighlightedCode`), and nested steps. |
| States | `TraceLine status` | `running`, `error` (opens itself) and `pending` (muted text and its own icon, at full opacity: stock's 60% fade drops it below 4.5:1 contrast). |

## Writing step titles

Titles change tense with status: "Searching the rota" while it runs, "Searched the rota" when it's done. The agent, or your adapter, sends the right one. Put results in `result` ("12 matches"), not in the title, so titles stay scannable.

## Live time

A shared one-second clock runs only while some step is `running`. It reads as null on the server, so durations appear right after hydration and never cause a mismatch.

## Not yet decided

- Collapsing automatically when a run finishes. Today the run stays as the reader left it.
- Mapping AI SDK tool parts to steps automatically. An adapter belongs in a separate entry.
