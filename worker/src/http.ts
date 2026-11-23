// Response helpers. Every response says how it may be cached: public data
// briefly or forever (pinned versions), anything else never.

export type CacheMode = "current" | "pinned" | "none"

const cacheControl: Record<CacheMode, string> = {
  current: "public, max-age=60",
  pinned: "public, max-age=31536000, immutable",
  none: "private, no-store",
}

export function json(body: unknown, status = 200, cache: CacheMode = "none", extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, status < 300 ? 2 : 0), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl[cache],
      "x-content-type-options": "nosniff",
      ...extra,
    },
  })
}

export function raw(body: ReadableStream | string, cache: CacheMode, extra: Record<string, string> = {}) {
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl[cache],
      "x-content-type-options": "nosniff",
      ...extra,
    },
  })
}

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status)

/** GitHub tokens are refused on every route: the registry never takes one. */
export const githubTokenPattern = /^(?:gh[pousr]_|github_pat_)/

export function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match ? match[1] : undefined
}

/** Reads a body up to `limit` bytes, whatever Content-Length claims. */
export async function readBody(request: Request, limit: number): Promise<Uint8Array | Response> {
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (declared > limit) return fail(413, `Requests are limited to ${limit} bytes.`)
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      return fail(413, `Requests are limited to ${limit} bytes.`)
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.byteLength
  }
  return out
}

export function parseJson<T>(data: Uint8Array): T | undefined {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(data)) as T
  } catch {
    return undefined
  }
}
