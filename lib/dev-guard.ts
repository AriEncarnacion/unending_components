const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"])

const deny = (error: string, status = 403) => Response.json({ error }, { status })

export function guardDevRead(request: Request): Response | null {
  if (process.env.NODE_ENV !== "development") return deny("This only works on the local dev server (npm run dev).")

  const host = request.headers.get("host") ?? ""
  if (!localHosts.has(host.replace(/:\d+$/, ""))) return deny("Requests must come to localhost.")

  const site = request.headers.get("sec-fetch-site")
  if (site && site !== "same-origin") return deny("Cross-site requests aren't allowed.")
  return null
}

export function guardDevWrite(request: Request): Response | null {
  const blocked = guardDevRead(request)
  if (blocked) return blocked
  const host = request.headers.get("host") ?? ""

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return deny("Requests must be JSON.", 415)

  const origin = request.headers.get("origin")
  if (origin) {
    try {
      if (new URL(origin).host !== host) return deny("Cross-origin requests aren't allowed.")
    } catch {
      return deny("Invalid origin.")
    }
  }
  return null
}
