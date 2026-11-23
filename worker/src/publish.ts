// Writing a version: the one path both Ship (admin) and Stock (GitHub OIDC)
// go through. Order matters:
//
//   1. claim the version by creating its release.json (create-only), so two
//      writers can never both own version n;
//   2. write every file create-only under that version;
//   3. add the log line;
//   4. move the pointer last, with compare-and-swap, so a ship is all or nothing.
//
// A writer that dies halfway leaves a claimed version nothing points at;
// nextVersion() skips it.
import type { Release } from "./shared/protocol.ts"
import type { Env } from "./env.ts"
import { createOnly, keys, updateState, type RegistryState, type SystemState, type Visibility } from "./store.ts"

export type VersionWrite = {
  system: string
  version: number
  name: string
  release: Release
  /** `r/<item>.json` and `src/<path>`, already validated and matched to the release. */
  files: Record<string, string>
  /** Set on a system's first version. */
  create?: { visibility: Visibility; org?: string }
  /** Packages added to the allowlist with this version. */
  allow?: string[]
  log: { by: string; commit?: string; summary?: string }
}

export class Conflict extends Error {}

export async function writeVersion(env: Env, write: VersionWrite): Promise<RegistryState> {
  const { system, version } = write
  if (!(await createOnly(env, keys.release(system, version), JSON.stringify(write.release, null, 2))))
    throw new Conflict(`Version ${version} of ${system} already exists.`)

  for (const [path, content] of Object.entries(write.files)) {
    const key = path.startsWith("r/")
      ? keys.item(system, version, path.slice(2, -".json".length))
      : keys.source(system, version, path.slice(4))
    if (!(await createOnly(env, key, content))) throw new Conflict(`${key} already exists.`)
  }

  const at = new Date().toISOString()
  await createOnly(
    env,
    keys.log(system, version),
    JSON.stringify({ version, at, by: write.log.by, commit: write.log.commit, summary: write.log.summary, allowed: write.allow ?? [] })
  )

  return updateState(env, (state) => {
    const before = state.systems[system]
    const next: SystemState = before
      ? { ...before, name: write.name, current: version, latest: Math.max(before.latest, version), updatedAt: at }
      : {
          name: write.name,
          visibility: write.create?.visibility ?? "private",
          ...(write.create?.org ? { org: write.create.org } : {}),
          current: version,
          latest: version,
          updatedAt: at,
        }
    state.systems[system] = next
    if (write.allow?.length) state.allowlist = [...new Set([...state.allowlist, ...write.allow])].sort()
    return state
  })
}
