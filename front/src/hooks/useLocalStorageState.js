import { useCallback, useEffect, useState } from 'react'

// Custom event name used to notify other hook instances in the SAME tab.
// (The native 'storage' event only fires in OTHER tabs, never the tab that
// made the change, so we need our own event for same-tab sync.)
const LOCAL_EVENT = 'local-storage-setting-changed'

function readValue(key, getDefault) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      return typeof getDefault === 'function' ? getDefault() : getDefault
    }
    return raw === 'true'
  } catch {
    return typeof getDefault === 'function' ? getDefault() : getDefault
  }
}

/**
 * Boolean setting persisted to localStorage, kept in sync in real time
 * across every component that calls this hook with the same `key` —
 * including other browser tabs.
 *
 * @param {string} key - localStorage key
 * @param {boolean | (() => boolean)} defaultValue - used when nothing is
 *   stored yet (e.g. a media-query check for a sensible first-time default)
 * @returns {[boolean, (next: boolean | ((prev: boolean) => boolean)) => void]}
 */
export function useLocalStorageState(key, defaultValue) {
  const [value, setValue] = useState(() => readValue(key, defaultValue))

  // Keep this instance's state in sync when the value changes anywhere else:
  // another component using the same key (same tab, via our custom event)
  // or another browser tab (via the native 'storage' event).
  useEffect(() => {
    const syncFromStorage = () => setValue(readValue(key, defaultValue))

    const handleLocalEvent = (e) => {
      if (e.detail?.key === key) setValue(e.detail.value)
    }
    const handleStorageEvent = (e) => {
      if (e.key === key) syncFromStorage()
    }

    window.addEventListener(LOCAL_EVENT, handleLocalEvent)
    window.addEventListener('storage', handleStorageEvent)
    return () => {
      window.removeEventListener(LOCAL_EVENT, handleLocalEvent)
      window.removeEventListener('storage', handleStorageEvent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setSetting = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        try {
          localStorage.setItem(key, String(resolved))
        } catch {
          // Ignore storage issues in restricted environments.
        }
        // Notify every other hook instance in THIS tab immediately.
        window.dispatchEvent(
          new CustomEvent(LOCAL_EVENT, { detail: { key, value: resolved } })
        )
        return resolved
      })
    },
    [key]
  )

  return [value, setSetting]
}