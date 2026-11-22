// Reads and writes design systems on disk. Server only: the catalog layout
// reads them at render, the dev-only Save route writes them.
import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  idPattern,
  isEmptyTuning,
  serialize,
  type Committed,
  type EntryTuningFile,
  type ProposalFile,
  type SystemFile,
  type Working,
} from "./schema.ts"

export const systemsDir = path.join(process.cwd(), "design-systems")

const readJson = async <T>(file: string) => JSON.parse(await readFile(file, "utf8")) as T

/** A short fingerprint of a system's files, so a draft can tell when they changed under it. */
export function hashOf(working: Working) {
  return createHash("sha1").update(serialize({ system: working.system, entries: working.entries })).digest("hex").slice(0, 12)
}

export async function readCommitted(): Promise<Committed[]> {
  let ids: string[] = []
  try {
    ids = (await readdir(systemsDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)
  } catch {
    return []
  }
  const systems: Committed[] = []
  for (const id of ids.sort()) {
    const dir = path.join(systemsDir, id)
    let system: SystemFile
    try {
      system = await readJson<SystemFile>(path.join(dir, "system.json"))
    } catch {
      continue
    }
    const entries: Record<string, EntryTuningFile> = {}
    const proposals: Record<string, ProposalFile> = {}
    const files = await readdir(path.join(dir, "entries")).catch(() => [] as string[])
    for (const file of files.sort()) {
      if (file.endsWith(".proposed.json")) {
        const proposal = await readJson<ProposalFile>(path.join(dir, "entries", file))
        proposals[proposal.entry] = proposal
      } else if (file.endsWith(".json")) {
        const tuning = await readJson<EntryTuningFile>(path.join(dir, "entries", file))
        entries[tuning.entry] = tuning
      }
    }
    const working = { system, entries }
    systems.push({ ...working, proposals, hash: hashOf(working) })
  }
  return systems
}

function dirFor(id: string) {
  if (!idPattern.test(id)) throw new Error(`Invalid system id "${id}"`)
  return path.join(systemsDir, id)
}

/** Writes a system and its entry tunings. Entry files that are gone or empty are deleted; proposals are left alone. */
export async function writeWorking(working: Working) {
  const dir = dirFor(working.system.id)
  await mkdir(path.join(dir, "entries"), { recursive: true })
  await writeFile(path.join(dir, "system.json"), serialize(working.system))
  const keep = new Set<string>()
  for (const [entry, tuning] of Object.entries(working.entries)) {
    if (!idPattern.test(entry)) throw new Error(`Invalid entry name "${entry}"`)
    if (isEmptyTuning(tuning)) continue
    keep.add(`${entry}.json`)
    await writeFile(path.join(dir, "entries", `${entry}.json`), serialize(tuning))
  }
  for (const file of await readdir(path.join(dir, "entries")))
    if (file.endsWith(".json") && !file.endsWith(".proposed.json") && !keep.has(file))
      await rm(path.join(dir, "entries", file))
}

export async function deleteSystem(id: string) {
  await rm(dirFor(id), { recursive: true, force: true })
}

export async function deleteProposal(id: string, entry: string) {
  if (!idPattern.test(entry)) throw new Error(`Invalid entry name "${entry}"`)
  await rm(path.join(dirFor(id), "entries", `${entry}.proposed.json`), { force: true })
}
