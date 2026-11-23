// The Unending registry: serves design-system registries to the shadcn CLI,
// issues read-only tokens to org members, and takes new versions only from
// signed admin requests (and Stock only from GitHub Actions on main).
//
// No route redirects: the shadcn CLI drops Authorization on a redirect to
// another host. No route logs headers or bodies.
import { handleAdmin } from "./admin.ts"
import type { Env } from "./env.ts"
import { bearer, fail, githubTokenPattern } from "./http.ts"
import { handleLogin } from "./login.ts"
import { handleRead, handleSystems } from "./read.ts"
import { publishStock } from "./stock.ts"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env)
    } catch (error) {
      console.error("unhandled", (error as Error).name)
      return fail(500, "Something went wrong in the registry.")
    }
  },
} satisfies ExportedHandler<Env>

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const token = bearer(request)
  if (token && githubTokenPattern.test(token))
    return fail(401, "The registry never takes a GitHub token. Use a registry token from /unending:login.")

  const path = url.pathname.split("/").filter(Boolean)
  if (path.some((part) => part === "." || part === ".." || part.includes("%"))) return fail(400, "Bad path.")
  const [area, ...rest] = path

  if (request.method === "GET" || request.method === "HEAD") {
    if (!area) return new Response("Unending registry\n", { headers: { "content-type": "text/plain", "cache-control": "public, max-age=3600" } })
    if (area === "systems.json" && !rest.length) return handleSystems(request, env)
    if (area === "r") return handleRead(request, env, rest)
  }
  if (area === "login") return handleLogin(request, env, rest[0])
  if (area === "admin") return handleAdmin(request, env, rest)
  if (area === "publish" && rest[0] === "stock" && rest.length === 1 && request.method === "POST") {
    if (!token) return fail(401, "Publishing Stock needs a GitHub Actions OIDC token.")
    return publishStock(request, env, token)
  }
  return fail(404, "Not found.")
}
