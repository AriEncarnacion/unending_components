// Dev-only: ship design systems to their own GitHub repos, roll back, and pull
// them. Everything runs through your own git and gh login.
import { readCommitted } from "@/lib/design-systems/load"
import { idPattern } from "@/lib/design-systems/schema"
import { guardDevRead, guardDevWrite } from "@/lib/dev-guard"
import { jobs, ownerPattern, preflight, repoPattern, startPull, startRollback, startShip, statuses, type NewRepo } from "@/lib/ship/server"

const json = (body: unknown, status = 200) => Response.json(body, { status })

export async function GET(request: Request) {
  const blocked = guardDevRead(request)
  if (blocked) return blocked
  const fresh = new URL(request.url).searchParams.has("refresh")
  const ids = (await readCommitted()).map((c) => c.system.id)
  const [ready, status] = await Promise.all([preflight(fresh), statuses(ids)])
  return json({ ready, status, jobs: jobs() })
}

type Body =
  | { action: "ship"; systemId: string; create?: NewRepo; review?: boolean }
  | { action: "rollback"; systemId: string; version: number }
  | { action: "pull" }

export async function POST(request: Request) {
  const blocked = guardDevWrite(request)
  if (blocked) return blocked
  let body: Body
  try {
    body = await request.json()
    if (!body || typeof body !== "object") throw new Error()
  } catch {
    return json({ error: "The request wasn't valid JSON." }, 400)
  }
  try {
    if (body.action === "pull") return json({ job: startPull() })
    if (body.action !== "ship" && body.action !== "rollback") return json({ error: "Unknown action." }, 400)
    if (typeof body.systemId !== "string" || !idPattern.test(body.systemId)) return json({ error: "Invalid system id." }, 400)
    // The name comes from the saved files, never from the request.
    const committed = (await readCommitted()).find((c) => c.system.id === body.systemId)
    if (!committed) return json({ error: "Save the system first." }, 400)
    const name = committed.system.name
    if (body.action === "rollback") {
      if (!Number.isInteger(body.version) || body.version < 1) return json({ error: "Pick a version." }, 400)
      return json({ job: startRollback(body.systemId, name, body.version) })
    }
    const create = body.create
    if (
      create !== undefined &&
      (typeof create?.owner !== "string" ||
        !ownerPattern.test(create.owner) ||
        typeof create.name !== "string" ||
        !repoPattern.test(create.name) ||
        (create.visibility !== "private" && create.visibility !== "public"))
    )
      return json({ error: "Choose an owner, a repo name and a visibility." }, 400)
    return json({ job: startShip(body.systemId, name, { create, review: body.review === true }) })
  } catch (error) {
    return json({ error: (error as Error).message }, 409)
  }
}
