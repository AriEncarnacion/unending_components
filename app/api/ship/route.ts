// Dev-only: ship a design system (PR, CI, Claude review, merge) and report
// where each system stands against the remote's default branch.
import { readCommitted } from "@/lib/design-systems/load"
import { idPattern } from "@/lib/design-systems/schema"
import { guardDevRead, guardDevWrite } from "@/lib/dev-guard"
import { jobs, preflight, reconcile, remoteSystemName, startShip, statuses } from "@/lib/ship/server"

const json = (body: unknown, status = 200) => Response.json(body, { status })
export async function GET(request: Request) {
  const blocked = guardDevRead(request)
  if (blocked) return blocked
  const fresh = new URL(request.url).searchParams.has("refresh")
  await reconcile()
  const ids = (await readCommitted()).map((c) => c.system.id)
  const [ready, status] = await Promise.all([preflight(fresh), statuses(ids)])
  return json({ ready, status, jobs: jobs() })
}

export async function POST(request: Request) {
  const blocked = guardDevWrite(request)
  if (blocked) return blocked
  let body: { systemId?: string; action?: "ship" | "delete" }
  try {
    body = await request.json()
  } catch {
    return json({ error: "The request wasn't valid JSON." }, 400)
  }
  const { systemId, action = "ship" } = body
  if (!systemId || !idPattern.test(systemId)) return json({ error: "Invalid system id." }, 400)
  if (action !== "ship" && action !== "delete") return json({ error: "Unknown action." }, 400)
  const committed = (await readCommitted()).find((c) => c.system.id === systemId)
  if (action === "ship" && !committed) return json({ error: "Save the system before shipping it." }, 400)
  // The name comes from the files (here, or on GitHub for a removal), never from the request.
  const name = committed?.system.name ?? (await remoteSystemName(systemId))
  if (action === "delete" && !name) return json({ error: "That system isn't on GitHub, so there's no removal to ship." }, 400)
  try {
    const job = startShip(systemId, name ?? systemId, action)
    return json({ job })
  } catch (error) {
    return json({ error: (error as Error).message }, 409)
  }
}
