import { createStore } from 'zustand'

export const announcerStore = createStore<{ message: string; count: number }>()(() => ({
  message: '',
  count: 0,
}))

/** Reads `message` out to screen-reader users via the polite live region in <LiveAnnouncer>. */
export function announce(message: string): void {
  announcerStore.setState((s) => ({ message, count: s.count + 1 }))
}
