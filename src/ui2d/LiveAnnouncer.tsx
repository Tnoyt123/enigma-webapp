import { useStore } from 'zustand'
import { announcerStore } from './announce.ts'

/** Polite live region that reads out whatever was last passed to announce(). */
export function LiveAnnouncer() {
  const { message, count } = useStore(announcerStore)
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {/* Re-keying replaces the node, so repeating the same message is announced again. */}
      <span key={count}>{message}</span>
    </div>
  )
}
