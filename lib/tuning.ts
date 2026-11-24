"use client"

import * as React from "react"

export type TuningValue = number | string | boolean

export const EntryTuningContext = React.createContext<Record<string, Record<string, TuningValue>> | null>(null)

export function useEntryTuning<T extends Record<string, TuningValue>>(entry: string, defaults: T): T {
  const tuned = React.useContext(EntryTuningContext)?.[entry]
  return tuned ? ({ ...defaults, ...tuned } as T) : defaults
}
