"use client"

import * as React from "react"

import { stockPalette, useDesignSystems } from "@/components/showcase/design-systems/provider"
import type { KeyColor, Scale } from "@/lib/palette"

export type PaletteState = { scales: Scale[]; keys: KeyColor[] }

export const seedState: PaletteState = stockPalette

export function usePalette() {
  const ds = useDesignSystems()
  const state: PaletteState = ds.active ? ds.active.system.palette : stockPalette
  const { update: updateSystem } = ds

  const update = React.useCallback(
    (recipe: (state: PaletteState) => PaletteState, mergeKey?: string) =>
      updateSystem((working) => {
        const palette = recipe(working.system.palette)
        return palette === working.system.palette ? working : { ...working, system: { ...working.system, palette } }
      }, mergeKey === undefined ? undefined : `palette:${mergeKey}`),
    [updateSystem]
  )

  return {
    state,
    restored: ds.restored,
    readOnly: ds.readOnly,
    update,
    undo: ds.undo,
    redo: ds.redo,
    canUndo: ds.canUndo,
    canRedo: ds.canRedo,
  }
}

export type PaletteApi = ReturnType<typeof usePalette>

export function mapScale(state: PaletteState, id: string, fn: (scale: Scale) => Scale): PaletteState {
  return { ...state, scales: state.scales.map((scale) => (scale.id === id ? fn(scale) : scale)) }
}

export function mapKey(state: PaletteState, id: string, fn: (key: KeyColor) => KeyColor): PaletteState {
  return { ...state, keys: state.keys.map((key) => (key.id === id ? fn(key) : key)) }
}

export function uniqueId(base: string, taken: string[]) {
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}
