"use client"

import * as React from "react"

/** localStorage for remembered panel sizes, or nothing when it's blocked (private windows, previews). */
export const panelStorage = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {}
  },
}

const subscribe = () => () => {}

/**
 * False on the server and during hydration, true after. Resizable panel groups
 * restore their sizes from localStorage, which the server can't see, so they
 * render only in the browser to avoid a hydration mismatch.
 */
export function useHydrated() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
