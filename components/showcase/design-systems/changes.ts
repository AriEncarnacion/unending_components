import { serialize, type Working } from "@/lib/design-systems/schema"

export type ChangeGroup = { area: string; items: string[] }

const keysChanged = (a: Record<string, unknown> = {}, b: Record<string, unknown> = {}) => {
  const names = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...names].filter((name) => serialize(a[name]) !== serialize(b[name])).sort()
}

/** What Save would write, in words: tokens, palette and each entry, compared with the files. */
export function describeChanges(before: Working | null, after: Working): ChangeGroup[] {
  const groups: ChangeGroup[] = []
  if (!before) groups.push({ area: "New system", items: [`Creates design-systems/${after.system.id}/`] })
  if (before && before.system.name !== after.system.name)
    groups.push({ area: "Name", items: [`${before.system.name} → ${after.system.name}`] })

  const tokens: string[] = []
  for (const scheme of ["light", "dark", "theme"] as const) {
    const changed = keysChanged(before?.system.tokens[scheme], after.system.tokens[scheme])
    const label = `${scheme[0].toUpperCase()}${scheme.slice(1)}`
    if (changed.length > 8) tokens.push(`${label}: ${changed.length} tokens (${changed.slice(0, 6).join(", ")}…)`)
    else if (changed.length) tokens.push(`${label}: ${changed.join(", ")}`)
  }
  if (tokens.length) groups.push({ area: "Tokens", items: tokens })

  const palette: string[] = []
  const beforeScales = Object.fromEntries((before?.system.palette.scales ?? []).map((s) => [s.id, s]))
  const afterScales = Object.fromEntries(after.system.palette.scales.map((s) => [s.id, s]))
  if (!before) palette.push(`${after.system.palette.scales.length} scales, ${after.system.palette.keys.length} key colours`)
  else for (const id of keysChanged(beforeScales, afterScales)) {
    const label = afterScales[id]?.name ?? beforeScales[id]?.name ?? id
    palette.push(!beforeScales[id] ? `Added ${label}` : !afterScales[id] ? `Removed ${label}` : `Changed ${label}`)
  }
  const beforeKeys = Object.fromEntries((before?.system.palette.keys ?? []).map((k) => [k.id, k]))
  const afterKeys = Object.fromEntries(after.system.palette.keys.map((k) => [k.id, k]))
  const keyChanges = keysChanged(beforeKeys, afterKeys)
  if (before && keyChanges.length) palette.push(`Key colours: ${keyChanges.map((id) => afterKeys[id]?.name ?? beforeKeys[id]?.name).join(", ")}`)
  if (before && serialize(before.system.palette.scales.map((s) => s.id)) !== serialize(after.system.palette.scales.map((s) => s.id)) && !palette.length)
    palette.push("Scale order")
  if (palette.length) groups.push({ area: "Palette", items: palette })

  const entries: string[] = []
  for (const entry of keysChanged(before?.entries, after.entries)) {
    const tuning = after.entries[entry]
    if (!tuning) entries.push(`${entry}: tuning removed (back to untuned)`)
    else {
      const parts = [
        ...keysChanged(before?.entries[entry]?.tokens.light, tuning.tokens.light).map((t) => `light ${t}`),
        ...keysChanged(before?.entries[entry]?.tokens.dark, tuning.tokens.dark).map((t) => `dark ${t}`),
        ...keysChanged(before?.entries[entry]?.tokens.theme, tuning.tokens.theme),
        ...keysChanged(before?.entries[entry]?.knobs, tuning.knobs),
      ]
      entries.push(`${entry}: ${parts.join(", ")}`)
    }
  }
  if (entries.length) groups.push({ area: "Entries", items: entries })
  return groups
}
