// Verifies signed admin requests. A request passes only if all of these hold:
//
//   - it names an enrolled key (ADMIN_KEYS; ids are computed, never trusted);
//   - the signature covers the method, host, path and query, time, nonce and
//     a SHA-256 of the exact body;
//   - its time is within a minute of the Worker's;
//   - its nonce has never been seen (recorded create-only, after the
//     signature checks out, so nobody else can fill the nonce store).
import { adminMessage, HEADER, MAX_SKEW_SECONDS, nonceSyntax, parseKeys, sha256Hex, verify } from "./shared/protocol.ts"
import type { Env } from "./env.ts"
import { fail } from "./http.ts"
import { createOnly, keys } from "./store.ts"

export type Admin = { keyId: string; publicKey: string }

export async function authenticateAdmin(request: Request, body: Uint8Array, env: Env): Promise<Admin | Response> {
  const keyId = request.headers.get(HEADER.key) ?? ""
  const time = request.headers.get(HEADER.time) ?? ""
  const nonce = request.headers.get(HEADER.nonce) ?? ""
  const signature = request.headers.get(HEADER.signature) ?? ""
  const unauthorized = () => fail(401, "This needs a request signed by an enrolled admin key.")
  if (!keyId || !time || !nonce || !signature) return unauthorized()
  if (!/^\d{1,12}$/.test(time) || !nonceSyntax.test(nonce)) return unauthorized()
  if (Math.abs(Date.now() / 1000 - Number(time)) > MAX_SKEW_SECONDS) return fail(401, "The request is too old, or this Mac's clock is off.")

  let enrolled
  try {
    enrolled = await parseKeys(env.ADMIN_KEYS)
  } catch {
    return fail(500, "ADMIN_KEYS is malformed.")
  }
  const key = enrolled.find((k) => k.keyId === keyId)
  if (!key) return unauthorized()

  const url = new URL(request.url)
  const message = adminMessage({
    method: request.method,
    host: url.host,
    path: url.pathname + url.search,
    time,
    nonce,
    bodyHash: await sha256Hex(body),
  })
  if (!(await verify(key.publicKey, signature, message))) return unauthorized()
  if (!(await createOnly(env, keys.nonce(nonce), time, "text/plain"))) return fail(401, "This request was already used.")
  return key
}
