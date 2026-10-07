import { useState } from 'react'

const STORAGE_KEY = 'enigma.panels.v1'

function loadFolded(): Record<string, boolean> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return saved && typeof saved === 'object' ? (saved as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

/**
 * Whether the fold `id` is open, remembered on this device. Folds start open unless
 * `openByDefault` is false.
 */
export function useFold(id: string, openByDefault = true) {
  const [open, setOpenState] = useState(() => loadFolded()[id] ?? openByDefault)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadFolded(), [id]: next }))
    } catch {
      // Storage unavailable (private mode, blocked): the fold just isn't remembered.
    }
  }
  return [open, setOpen] as const
}
