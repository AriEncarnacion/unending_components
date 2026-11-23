// /login/*: how org members get a read-only registry token.
//
//   POST /login/device   starts GitHub's device flow for the registry's own
//                        OAuth app, asking for read:org and nothing else
//   POST /login/token    { device_code, org }: once you approve on github.com,
//                        checks you're an active member and issues unr_…
//   POST /login/revoke   with the token as Bearer: revokes it
//
// The Worker only issues tokens for orgs that have a private system here.
import type { Env } from "./env.ts"
import { bearer, fail, json, parseJson, readBody } from "./http.ts"
import { orgPattern } from "./shared/protocol.ts"
import { readState } from "./store.ts"
import { checkMembership, githubUser, issueToken, revokeToken } from "./tokens.ts"

export const GITHUB_WEB = "https://github.com"

async function form(url: string, fields: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded", "user-agent": "unending-registry" },
    body: new URLSearchParams(fields).toString(),
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

export async function handleLogin(request: Request, env: Env, action: string | undefined): Promise<Response> {
  if (request.method !== "POST") return fail(405, "Use POST.")
  if (!env.GITHUB_CLIENT_ID) return fail(503, "Login isn't set up on this registry yet.")
  const body = await readBody(request, 4096)
  if (body instanceof Response) return body

  if (action === "device") {
    const started = await form(`${GITHUB_WEB}/login/device/code`, { client_id: env.GITHUB_CLIENT_ID, scope: "read:org" })
    if (typeof started.device_code !== "string") return fail(502, "GitHub didn't start a login.")
    return json({
      device_code: started.device_code,
      user_code: started.user_code,
      verification_uri: started.verification_uri,
      interval: started.interval,
      expires_in: started.expires_in,
    })
  }

  if (action === "token") {
    const input = parseJson<{ device_code?: unknown; org?: unknown }>(body)
    const deviceCode = input?.device_code
    const org = typeof input?.org === "string" ? input.org.toLowerCase() : ""
    if (typeof deviceCode !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(deviceCode)) return fail(400, "device_code is missing.")
    if (!orgPattern.test(org)) return fail(400, "org must be a GitHub org login.")
    const { state } = await readState(env)
    if (!Object.values(state.systems).some((s) => s.visibility === "private" && s.org === org))
      return fail(404, "This registry has no private systems for that org.")

    const answer = await form(`${GITHUB_WEB}/login/oauth/access_token`, {
      client_id: env.GITHUB_CLIENT_ID,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    })
    if (answer.error === "authorization_pending" || answer.error === "slow_down")
      return json({ pending: true, interval: answer.interval }, 202)
    if (typeof answer.access_token !== "string") return fail(400, "GitHub didn't approve the login.", { reason: answer.error })

    const githubToken = answer.access_token
    const user = await githubUser(githubToken)
    const scopes = user.scopes.split(",").map((s) => s.trim()).filter(Boolean)
    if (scopes.some((s) => s !== "read:org")) return fail(400, "The GitHub token has more than read:org, so it wasn't kept.")
    if (!(await checkMembership(githubToken, org))) return fail(403, "You're not an active member of that org.")
    const issued = await issueToken(env, { userId: user.id, org }, githubToken)
    return json({ token: issued.token, expiresAt: issued.expiresAt, org })
  }

  if (action === "revoke") {
    const token = bearer(request)
    if (!token || !(await revokeToken(env, token))) return fail(404, "No such token.")
    return json({ revoked: true })
  }

  return fail(404, "No such login route.")
}
