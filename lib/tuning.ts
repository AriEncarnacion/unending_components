"use client"

import * as React from "react"

export type TuningValue = number | string | boolean

/** Knob values per entry, for the design system being previewed. */
export const EntryTuningContext = React.createContext<Record<string, Record<string, TuningValue>> | null>(null)

/**
 * An entry's feel: durations, easings, distances and default choices.
 * Outside the Unending catalog this simply returns `defaults`. Inside it, the
 * tuner swaps in the active design system's values, and an install from a
 * design system gets them written into the component as a plain object.
 */
export function useEntryTuning<T extends Record<string, TuningValue>>(entry: string, defaults: T): T {
  const tuned = React.useContext(EntryTuningContext)?.[entry]
  return tuned ? ({ ...defaults, ...tuned } as T) : defaults
}
