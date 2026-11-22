// Guards the catalog's dev-only write routes (Save, Delete, Ship) against
// other sites in your browser: cross-site POSTs (CSRF) and DNS rebinding.
// Returns a Response to send back when the request isn't allowed.

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"])

export function guardDevWrite(request: Request): Response | null {
  const deny = (error: string, status = 403) => Response.json({ error }, { status })
  if (process.env.NODE_ENV !== "development") return deny("This only works on the local dev server (npm run dev).")

  // DNS rebinding: a hostile name that resolves to 127.0.0.1 still carries its own Host header.
  const host = request.headers.get("host") ?? ""
  if (!localHosts.has(host.replace(/:\d+$/, ""))) return deny("Requests must come to localhost.")

  // A JSON content type can't be sent cross-site without a CORS preflight, which this route never approves.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return deny("Requests must be JSON.", 415)

  // Browsers say where a request came from; only the catalog's own pages may write.
  const site = request.headers.get("sec-fetch-site")
  if (site && site !== "same-origin") return deny("Cross-site requests aren't allowed.")
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
