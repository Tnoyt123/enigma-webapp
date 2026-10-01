import { useView } from '../state/viewStore.ts'
import type { View } from './view.ts'

const OPTIONS: { view: View; label: string }[] = [
  { view: '2d', label: '2D' },
  { view: '3d', label: '3D' },
]

/** Segmented 2D | 3D control. Native radios, so arrow keys switch views. */
export function ViewSwitch() {
  const view = useView((s) => s.view)
  const webgl = useView((s) => s.webgl)
  const setView = useView((s) => s.setView)

  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">View</legend>
      <span aria-hidden="true" className="text-sm text-stone-300">
        View
      </span>
      <div className="flex rounded-lg border border-stone-600 bg-stone-900 p-0.5">
        {OPTIONS.map((option) => {
          const disabled = option.view === '3d' && !webgl
          return (
            <label
              key={option.view}
              title={disabled ? 'WebGL is unavailable in this browser' : undefined}
              className="cursor-pointer rounded-md px-3 py-1 text-sm font-semibold text-stone-200 has-checked:bg-amber-300 has-checked:text-stone-900 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:outline-amber-300"
            >
              <input
                type="radio"
                name="view"
                value={option.view}
                className="sr-only"
                checked={view === option.view}
                disabled={disabled}
                onChange={() => setView(option.view)}
              />
              {option.label}
              {disabled && <span className="sr-only"> (unavailable: no WebGL)</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
