// Dev-only writes for the design-system tuner: Save, Delete and dismissing a
// proposal. The catalog is a local tool, so this refuses to run anywhere but
// `next dev`, and it only ever touches design-systems/.
import { entries } from "@/lib/catalog"
import { deleteProposal, deleteSystem, readCommitted, writeWorking } from "@/lib/design-systems/load"
import { idPattern, validate, type Working } from "@/lib/design-systems/schema"
import { entryKnobs } from "@/lib/entry-knobs"
import { baseTokens } from "@/lib/tokens"

type Body =
  | { action: "save"; working: Working; expectedHash: string; force?: boolean }
  | { action: "delete"; id: string }
  | { action: "dismiss-proposal"; id: string; entry: string }

const json = (body: unknown, status = 200) => Response.json(body, { status })

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return json({ error: "Saving design systems only works on the local dev server (npm run dev)." }, 403)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return json({ error: "The request wasn't valid JSON." }, 400)
  }

  if (body.action === "save") {
    const { working } = body
    const known = new Set(entries.map((entry) => entry.name))
    const unknown = Object.keys(working.entries ?? {}).filter((name) => !known.has(name))
    if (unknown.length) return json({ error: `Unknown entries: ${unknown.join(", ")}` }, 400)
    const issues = validate(working, baseTokens, entryKnobs)
    if (issues.length) return json({ error: "The system has problems to fix before it can be saved.", issues }, 422)

    const current = (await readCommitted()).find((c) => c.system.id === working.system.id)
    if (current && current.hash !== body.expectedHash && !body.force)
      return json({ error: "The files changed since this draft began.", conflict: true, committed: await readCommitted() }, 409)
    if (!current && body.expectedHash && !body.force)
      return json({ error: "This system's files were deleted since the draft began.", conflict: true, committed: await readCommitted() }, 409)

    await writeWorking(working)
    return json({ committed: await readCommitted() })
  }

  if (body.action === "delete") {
    if (!idPattern.test(body.id)) return json({ error: "Invalid system id." }, 400)
    await deleteSystem(body.id)
    return json({ committed: await readCommitted() })
  }

  if (body.action === "dismiss-proposal") {
    if (!idPattern.test(body.id) || !idPattern.test(body.entry)) return json({ error: "Invalid id." }, 400)
    await deleteProposal(body.id, body.entry)
    return json({ committed: await readCommitted() })
  }

  return json({ error: "Unknown action." }, 400)
}
