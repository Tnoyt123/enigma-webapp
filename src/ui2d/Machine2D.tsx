import { MODELS } from '../engine/index.ts'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { useTeaching } from '../state/teachingStore.ts'
import { Keyboard } from './Keyboard.tsx'
import { Lampboard } from './Lampboard.tsx'
import { Plugboard } from './Plugboard.tsx'
import { announce } from './announce.ts'
import { RotorBay } from './RotorBay.tsx'
import { RotorWindows } from './RotorWindows.tsx'
import { XrayDiagram } from './XrayDiagram.tsx'

/** The machine seen from the operator's seat: rotor windows, lampboard, keyboard, plugboard. */
export function Machine2D() {
  const model = useMachine((s) => MODELS[s.config.model].name)
  const xray = useTeaching((s) => s.xray)
  const lidOpen = useMachine((s) => s.lidOpen)
  const panel = 'rounded-xl bg-stone-900 p-2 sm:p-5'

  return (
    <section
      aria-label={`${model} machine`}
      className="flex flex-col gap-3 rounded-2xl border-[6px] border-[#5c3a1e] bg-[#1a1714] p-2 sm:border-[10px] shadow-2xl sm:gap-4 sm:p-5"
    >
      <div className={`${panel} flex flex-col gap-3`}>
        <RotorWindows />
        <button
          type="button"
          aria-expanded={lidOpen}
          aria-controls="rotor-bay-2d"
          onClick={() => announce(machineStore.getState().setLidOpen(!lidOpen))}
          className="self-center rounded border border-stone-500 px-3 py-1 text-sm text-stone-100 hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          {lidOpen ? 'Close the lid' : 'Open the lid'}
        </button>
        {lidOpen && (
          <div id="rotor-bay-2d">
            <h2 className="sr-only">Rotors and rotor box</h2>
            <RotorBay />
          </div>
        )}
      </div>
      {xray && (
        <div className={panel}>
          <h2 className="mb-2 text-center text-xs font-semibold tracking-widest text-stone-300 uppercase">
            X-ray · Inside the machine
          </h2>
          <XrayDiagram />
        </div>
      )}
      <div className={panel}>
        <h2 className="sr-only">Lampboard</h2>
        <Lampboard />
      </div>
      {/* Narrower side padding on phones leaves more room for the keys. */}
      <div className={`${panel} px-0.5 sm:px-5`}>
        <h2 className="sr-only">Keyboard</h2>
        <Keyboard />
      </div>
      <div className={`${panel} bg-stone-950`}>
        <h2 className="mb-2 text-center text-xs font-semibold tracking-widest text-stone-300 uppercase">
          Steckerbrett · Plugboard
        </h2>
        <Plugboard />
      </div>
    </section>
  )
}
