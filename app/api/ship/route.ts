// Dev-only: ship design systems straight to the registry host, roll back,
// pull, and set up this Mac's admin key. Every registry call is signed by the
// Mac's Secure Enclave key and asks for Touch ID.
import { readCommitted } from "@/lib/design-systems/load"
import { idPattern } from "@/lib/design-systems/schema"
import { guardDevRead, guardDevWrite } from "@/lib/dev-guard"
import { jobs, preflight, setUpThisMac, startPull, startRollback, startShip, statuses } from "@/lib/ship/server"
import { orgPattern } from "@/worker/src/shared/protocol"

const json = (body: unknown, status = 200) => Response.json(body, { status })
const packagePattern = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/

export async function GET(request: Request) {
  const blocked = guardDevRead(request)
  if (blocked) return blocked
  const ids = (await readCommitted()).map((c) => c.system.id)
  return json({ ready: await preflight(), status: statuses(ids), jobs: jobs() })
}

type Body =
  | { action: "ship"; systemId: string; org?: string; allow?: string[]; review?: boolean }
  | { action: "rollback"; systemId: string; version: number }
  | { action: "pull"; force?: boolean }
  | { action: "setup" }

export async function POST(request: Request) {
  const blocked = guardDevWrite(request)
  if (blocked) return blocked
  let body: Body
  try {
    body = await request.json()
  } catch {
    return json({ error: "The request wasn't valid JSON." }, 400)
  }
  try {
    if (body.action === "setup") return json({ key: await setUpThisMac() })
    if (body.action === "pull") return json({ job: startPull(body.force === true) })
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
    if (body.org !== undefined && (typeof body.org !== "string" || !orgPattern.test(body.org)))
      return json({ error: "The org must be a GitHub org login." }, 400)
    if (body.allow !== undefined && (!Array.isArray(body.allow) || !body.allow.every((p) => typeof p === "string" && packagePattern.test(p))))
      return json({ error: "allow must be npm package names." }, 400)
    return json({ job: startShip(body.systemId, name, { org: body.org, allow: body.allow, review: body.review === true }) })
  } catch (error) {
    return json({ error: (error as Error).message }, 409)
  }
}
