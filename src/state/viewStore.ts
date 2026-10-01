import { createStore, useStore } from 'zustand'
import {
  chooseView,
  supportsWebGL,
  VIEW_STORAGE_KEY,
  withViewParam,
  type View,
} from '../app/view.ts'

export interface ViewState {
  readonly view: View
  readonly webgl: boolean
  readonly notice: string | null
  setView(view: View): void
  dismissNotice(): void
}

function readStored(): string | null {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(view: View): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view)
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the URL still records the view.
  }
}

export const viewStore = createStore<ViewState>()((set, get) => {
  const webgl = supportsWebGL()
  const { view, notice } = chooseView({ search: location.search, stored: readStored(), webgl })
  return {
    view,
    webgl,
    notice,
    setView(next) {
      if (next === '3d' && !get().webgl) return
      set({ view: next, notice: null })
      remember(next)
      history.replaceState(history.state, '', withViewParam(location.search, next) + location.hash)
    },
    dismissNotice() {
      set({ notice: null })
    },
  }
})

export function useView<T>(selector: (state: ViewState) => T): T {
  return useStore(viewStore, selector)
}
