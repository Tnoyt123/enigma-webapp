import { useMachine } from '../state/machineStore.ts'
import { KEY_ROWS } from './layout.ts'

/** The 26 lamps. Hidden from assistive tech: each press is announced through the live region instead. */
export function Lampboard() {
  const lit = useMachine((s) => s.litLamp)
  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2 w-full" aria-hidden="true">
      {KEY_ROWS.map((row) => (
        <div key={row} className="flex w-full justify-center gap-[0.8%]">
          {[...row].map((letter) => (
            <span
              key={letter}
              data-lamp={letter}
              data-lit={lit === letter || undefined}
              className="flex aspect-square w-[min(10.4%,2.75rem)] items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-sm font-semibold text-stone-400 transition-colors duration-75 data-lit:border-amber-200 data-lit:bg-amber-300 data-lit:text-stone-900 data-lit:shadow-[0_0_18px_4px_rgba(252,211,77,0.6)] sm:text-base"
            >
              {letter}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
