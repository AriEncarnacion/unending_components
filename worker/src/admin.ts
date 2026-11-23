// /admin/*: signed requests from your Macs only. Nothing here deletes a version.
//
//   GET  /admin/systems[?source]              every system, with its recent log (and current source, for Pull)
//   GET  /admin/systems/<id>/source[?version] a version's source and release, for Pull
//   POST /admin/systems/<id>/versions         ship a new version
//   POST /admin/systems/<id>/current          roll back (or forward) to a version
//   GET  /admin/allowlist                     the npm allowlist
//   POST /admin/allowlist                     add packages to it
//   POST /admin/tokens/revoke                 revoke registry tokens by user or org
import { alert } from "./alerts.ts"
import { authenticateAdmin, type Admin } from "./admin-auth.ts"
import type { Env } from "./env.ts"
import { fail, json, parseJson, readBody } from "./http.ts"
import { Conflict, writeVersion } from "./publish.ts"
import {
  HEADER,
  LIMITS,
  namePattern,
  orgPattern,
  parseKeys,
  parseManifest,
  releaseMessage,
  reservedSystemIds,
  sha256Hex,
  verify,
  type ShipBody,
} from "./shared/protocol.ts"
import { checkBundle, packageName, systemNamePattern } from "./shared/validate.ts"
import { keys, nextVersion, readState, updateState } from "./store.ts"

const packagePattern = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/

export async function handleAdmin(request: Request, env: Env, path: string[]): Promise<Response> {
  const body = await readBody(request, LIMITS.bodyBytes)
  if (body instanceof Response) return body
  const admin = await authenticateAdmin(request, body, env)
  if (admin instanceof Response) return admin

  const [area, id, action] = path
  const method = request.method
  if (area === "systems" && !id && method === "GET") return listSystems(env, new URL(request.url).searchParams.has("source"))
  if (area === "systems" && id) {
    if (!namePattern.test(id)) return fail(400, "Invalid system id.")
    if (action === "source" && method === "GET") return source(env, id, new URL(request.url).searchParams.get("version"))
    if (action === "versions" && method === "POST") return ship(env, admin, id, body, request.headers.get(HEADER.releaseSignature) ?? "")
    if (action === "current" && method === "POST") return setCurrent(env, admin, id, body)
  }
  if (area === "allowlist" && !id && method === "GET") return json({ allowlist: (await readState(env)).state.allowlist })
  if (area === "allowlist" && !id && method === "POST") return allow(env, admin, body)
  if (area === "tokens" && id === "revoke" && method === "POST") return revokeTokens(env, admin, body)
  return fail(404, "No such admin route.")
}

async function listSystems(env: Env, withSource: boolean) {
  const { state } = await readState(env)
  const systems = await Promise.all(
    Object.entries(state.systems).map(async ([id, system]) => {
      const listing = await env.REGISTRY.list({ prefix: keys.logPrefix(id) })
      const recent = listing.objects.slice(-20)
      const log = await Promise.all(recent.map(async (o) => (await env.REGISTRY.get(o.key))?.json()))
      const found = withSource && id !== "stock" ? await sourceOf(env, id, system.current) : undefined
      return { id, ...system, log: log.filter(Boolean), ...(found ? { source: found } : {}) }
    })
  )
  return json({ systems })
}

/** A version's release and source files. */
async function sourceOf(env: Env, id: string, version: number) {
  const releaseObject = await env.REGISTRY.get(keys.release(id, version))
  if (!releaseObject) return undefined
  const release = (await releaseObject.json()) as { payload: string }
  const manifest = parseManifest(release.payload)
  const files: Record<string, string> = {}
  for (const path of Object.keys(manifest.source)) {
    const object = await env.REGISTRY.get(keys.source(id, version, path))
    if (!object) throw new Error(`Version ${version} of ${id} is missing ${path}.`)
    files[path] = await object.text()
  }
  return { version, release, files }
}

async function source(env: Env, id: string, versionParam: string | null) {
  const { state } = await readState(env)
  const system = state.systems[id]
  if (!system) return fail(404, "No such system.")
  const version = versionParam === null ? system.current : Number(versionParam)
  if (!Number.isInteger(version) || version < 1 || version > system.latest) return fail(400, "No such version.")
  const found = await sourceOf(env, id, version)
  if (!found) return fail(404, "No such version.")
  return json({ system: id, name: system.name, visibility: system.visibility, ...found })
}

async function ship(env: Env, admin: Admin, id: string, raw: Uint8Array, releaseSignature: string) {
  const body = parseJson<ShipBody>(raw)
  if (!body || typeof body !== "object") return fail(400, "The body must be JSON.")
  if (reservedSystemIds.includes(id)) return fail(400, `"${id}" is reserved.`)
  if (typeof body.name !== "string" || !systemNamePattern.test(body.name)) return fail(400, "The system name isn't valid.")
  if (body.summary !== undefined && (typeof body.summary !== "string" || body.summary.length > LIMITS.summary))
    return fail(400, "The summary is too long.")

  const { state } = await readState(env)
  const existing = state.systems[id]
  if (!existing) {
    if (typeof body.org !== "string" || !orgPattern.test(body.org) || !Number.isSafeInteger(body.orgId) || (body.orgId as number) < 1)
      return fail(400, "A system's first ship must name the GitHub org whose members may read it, with its numeric id.")
  } else if (body.org !== undefined && (typeof body.org !== "string" || body.org.toLowerCase() !== existing.org)) {
    return fail(400, "Changing who can read a system is a separate action.")
  }

  const expected = await nextVersion(env, id, state)
  if (body.version !== expected) return fail(409, `The next version of ${id} is ${expected}.`, { expectedVersion: expected })

  // The release: signed by an enrolled key, for this system and version, listing exactly these files.
  const release = body.release
  if (!release || typeof release.payload !== "string" || typeof release.keyId !== "string" || !releaseSignature)
    return fail(400, "The release or its signature is missing.")
  const key = (await parseKeys(env.ADMIN_KEYS)).find((k) => k.keyId === release.keyId)
  if (!key || release.keyId !== admin.keyId) return fail(400, "The release must be signed by the key that signed this request.")
  if (!(await verify(key.publicKey, releaseSignature, releaseMessage(release.payload)))) return fail(400, "The release signature doesn't verify.")
  let manifest
  try {
    manifest = parseManifest(release.payload)
  } catch (error) {
    return fail(400, (error as Error).message)
  }
  if (manifest.system !== id || manifest.version !== body.version) return fail(400, "The release is for a different system or version.")
  if (Math.abs(Date.parse(manifest.createdAt) - Date.now()) > 10 * 60_000) return fail(400, "The release's date is more than ten minutes off.")

  const files = body.files
  if (!files || typeof files !== "object" || Array.isArray(files)) return fail(400, "files must be an object.")
  const listed = new Set([
    ...Object.keys(manifest.items).map((f) => `r/${f}`),
    ...Object.keys(manifest.source).map((f) => `src/${f}`),
  ])
  const sent = Object.keys(files)
  if (sent.length !== listed.size || !sent.every((f) => listed.has(f))) return fail(400, "The files don't match the release.")
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== "string") return fail(400, `${path} must be text.`)
    const expectedHash = path.startsWith("r/") ? manifest.items[path.slice(2)] : manifest.source[path.slice(4)]
    if ((await sha256Hex(content)) !== expectedHash) return fail(400, `${path} doesn't match its hash in the release.`)
  }

  const allow = body.allow ?? []
  if (!Array.isArray(allow) || allow.length > 40 || !allow.every((p) => typeof p === "string" && packagePattern.test(p)))
    return fail(400, "allow must be a list of npm package names.")
  const check = checkBundle(files, [...state.allowlist, ...allow], id)
  if (check.problems.length) return fail(422, "The version has problems.", { problems: check.problems.slice(0, 50) })
  if (check.unknownPackages.length)
    return fail(422, "The version installs packages that aren't on the allowlist.", { unknownPackages: check.unknownPackages })
  const added = allow.filter((p) => !state.allowlist.includes(p))

  let next
  try {
    next = await writeVersion(env, {
      system: id,
      version: body.version,
      name: body.name,
      release: { payload: release.payload, signer: { kind: "admin", keyId: release.keyId, signature: releaseSignature } },
      files,
      create: existing ? undefined : { visibility: "private", org: (body.org as string).toLowerCase(), orgId: body.orgId },
      allow: added,
      log: { by: `key ${admin.keyId}`, commit: manifest.commit, summary: body.summary },
    })
  } catch (error) {
    if (error instanceof Conflict) return fail(409, error.message)
    throw error
  }
  await alert(env, `Shipped ${body.name} v${body.version}`, [
    `${body.name} (${id}) version ${body.version} is now current.`,
    `Signed by key ${admin.keyId}.`,
    ...(manifest.commit ? [`Built against catalog commit ${manifest.commit}.`] : []),
    ...(added.length ? [`Added to the npm allowlist: ${added.join(", ")}.`] : []),
    ...(body.summary ? ["", body.summary] : []),
  ])
  return json({ system: id, ...next.systems[id] }, 201)
}

async function setCurrent(env: Env, admin: Admin, id: string, raw: Uint8Array) {
  const body = parseJson<{ version?: unknown }>(raw)
  const version = body?.version
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return fail(400, "version must be a version number.")
  const { state } = await readState(env)
  const system = state.systems[id]
  if (!system) return fail(404, "No such system.")
  if (version > system.latest || !(await env.REGISTRY.head(keys.release(id, version)))) return fail(400, "No such version.")
  const previous = system.current
  const next = await updateState(env, (s) => {
    s.systems[id] = { ...s.systems[id], current: version, updatedAt: new Date().toISOString() }
    return s
  })
  await alert(env, `${system.name} now serves v${version}`, [
    `${system.name} (${id}) moved from version ${previous} to ${version}.`,
    `Signed by key ${admin.keyId}.`,
  ])
  return json({ system: id, ...next.systems[id] })
}

async function allow(env: Env, admin: Admin, raw: Uint8Array) {
  const body = parseJson<{ add?: unknown }>(raw)
  const add = body?.add
  if (!Array.isArray(add) || !add.length || add.length > 40 || !add.every((p) => typeof p === "string" && packagePattern.test(p)))
    return fail(400, "add must be a list of npm package names.")
  const names = (add as string[]).map(packageName)
  const next = await updateState(env, (s) => {
    s.allowlist = [...new Set([...s.allowlist, ...names])].sort()
    return s
  })
  await alert(env, "npm allowlist changed", [`Added: ${names.join(", ")}.`, `Signed by key ${admin.keyId}.`])
  return json({ allowlist: next.allowlist })
}

async function revokeTokens(env: Env, admin: Admin, raw: Uint8Array) {
  const body = parseJson<{ userId?: unknown; org?: unknown }>(raw)
  const userId = typeof body?.userId === "number" ? body.userId : undefined
  const org = typeof body?.org === "string" ? body.org.toLowerCase() : undefined
  if (userId === undefined && org === undefined) return fail(400, "Name a userId or an org.")
  let revoked = 0
  let cursor: string | undefined
  do {
    const page = await env.REGISTRY.list({ prefix: "tokens/", cursor, include: ["customMetadata"] })
    for (const object of page.objects) {
      const meta = object.customMetadata ?? {}
      if ((userId === undefined || meta.userId === String(userId)) && (org === undefined || meta.org === org)) {
        await env.REGISTRY.delete(object.key)
        revoked++
      }
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  await alert(env, "Registry tokens revoked", [`Revoked ${revoked} token(s).`, `Signed by key ${admin.keyId}.`])
  return json({ revoked })
}
