import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { MODELS, ROTORS } from '../engine/index.ts'
import { RingControls } from '../panels/RingControls.tsx'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { teachingStore, useTeaching } from '../state/teachingStore.ts'
import { slotNames } from '../teaching/explain.ts'
import { announce } from '../ui2d/announce.ts'
import { Keyboard } from '../ui2d/Keyboard.tsx'
import { Lampboard } from '../ui2d/Lampboard.tsx'
import { Plugboard } from '../ui2d/Plugboard.tsx'
import { RotorBay } from '../ui2d/RotorBay.tsx'
import { RotorWindows } from '../ui2d/RotorWindows.tsx'
import {
  blockPageScrollOverThumbwheels,
  moveCamera,
  moveCameraTo,
  releasePointerKey,
} from './controls.ts'
import { CAMERA_PRESETS, LID_VIEW, ringCloseUp, rotorStack, type CameraPreset } from './layout3d.ts'
import { QUALITY } from './quality.ts'
import { Scene } from './Scene.tsx'

/**
 * The 3D machine. Pointer users work the model directly; keyboard and screen-reader users get
 * the same controls as the 2D view (same names, same store actions), revealed while focused.
 */
export default function Machine3D() {
  const model = useMachine((s) => MODELS[s.config.model].name)
  const [chosenPreset, setPreset] = useState<CameraPreset>('operator')
  const xray = useTeaching((s) => s.xray)
  const lidOpen = useMachine((s) => s.lidOpen)
  const ringSlot = useMachine((s) => s.ringSlot)
  const rotors = useMachine((s) => s.config.rotors)
  // While the lid is open the camera is on the rotors, so no preset is current.
  const preset = lidOpen || ringSlot !== null ? null : chosenPreset

  // Opening the lid looks over the rotors and the rotor box; the ring close-up zooms in on one
  // rotor; closing the lid returns to the operator's seat.
  const ringX =
    ringSlot === null ? null : rotorStack(rotors.map((id) => ROTORS[id].thin)).slots[ringSlot].x
  const wasLidOpen = useRef(lidOpen)
  useEffect(() => {
    if (ringX !== null) {
      const { position, target } = ringCloseUp(ringX)
      moveCameraTo(position, target)
    } else if (lidOpen) {
      moveCameraTo(LID_VIEW.position, LID_VIEW.target)
    } else if (wasLidOpen.current) {
      moveCamera(chosenPreset)
    }
    wasLidOpen.current = lidOpen
  }, [lidOpen, ringX, chosenPreset])

  // A key pressed on the model is released wherever the pointer is let go.
  useEffect(() => {
    window.addEventListener('pointerup', releasePointerKey)
    window.addEventListener('pointercancel', releasePointerKey)
    return () => {
      window.removeEventListener('pointerup', releasePointerKey)
      window.removeEventListener('pointercancel', releasePointerKey)
    }
  }, [])

  const canvasBox = useRef<HTMLDivElement>(null)
  useEffect(() => blockPageScrollOverThumbwheels(canvasBox.current!), [])

  const choose = (next: CameraPreset) => {
    setPreset(next)
    moveCamera(next)
  }

  return (
    <section
      aria-label={`${model} machine, 3D`}
      className="relative overflow-hidden rounded-2xl border-[6px] border-[#5c3a1e] bg-stone-950 shadow-2xl sm:border-[10px]"
    >
      <div
        ref={canvasBox}
        role="img"
        aria-label={`Interactive 3D model of the ${model}. Drag to look around; click keys, thumbwheels and plugboard sockets. Keyboard users: press Tab to reach the machine's controls.`}
        className="h-[min(72vh,44rem,115vw)] min-h-[18rem] touch-none"
      >
        <Canvas
          // Draw only when something changes: saves battery, and keeps slow (software) GPUs usable.
          frameloop="demand"
          dpr={QUALITY.dpr}
          camera={{ fov: 35, position: CAMERA_PRESETS.operator.position }}
          data-testid="machine-3d-canvas"
          // The case is carved by clipping planes to make the rotor well.
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true
          }}
        >
          <Scene />
        </Canvas>
      </div>

      <div
        role="group"
        aria-label="Camera and x-ray"
        className="absolute top-3 left-3 flex gap-1 rounded-lg bg-stone-900/85 p-1"
      >
        {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={preset === id}
            onClick={() => choose(id)}
            className="rounded px-2.5 py-1 text-sm text-stone-200 hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-amber-300 aria-pressed:bg-amber-300 aria-pressed:text-stone-900"
          >
            {CAMERA_PRESETS[id].label}
          </button>
        ))}
        <span aria-hidden="true" className="mx-1 w-px bg-stone-600" />
        <button
          type="button"
          aria-expanded={lidOpen}
          onClick={() => announce(machineStore.getState().setLidOpen(!lidOpen))}
          className="rounded px-2.5 py-1 text-sm text-stone-200 hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-amber-300 aria-expanded:bg-amber-300 aria-expanded:text-stone-900"
        >
          {lidOpen ? 'Close the lid' : 'Open the lid'}
        </button>
        <button
          type="button"
          aria-pressed={xray}
          onClick={() => teachingStore.getState().setXray(!xray)}
          className="rounded px-2.5 py-1 text-sm text-stone-200 hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-amber-300 aria-pressed:bg-sky-300 aria-pressed:text-stone-900"
        >
          X-ray
        </button>
      </div>
      {!lidOpen && (
        <p className="pointer-events-none absolute right-3 bottom-3 hidden rounded bg-stone-900/80 px-2 py-1 text-xs text-stone-300 sm:block">
          Click or drag a thumbwheel to turn it; Shift-click, right-click or scroll to turn it back.
        </p>
      )}
      {lidOpen && ringSlot === null && <LidStrip />}
      {ringSlot !== null && (
        <section
          aria-label="Ring setting"
          className="absolute right-2 bottom-2 left-2 rounded-xl bg-amber-50 p-3 shadow-xl sm:left-auto sm:w-96"
        >
          <h2 className="mb-2 font-serif text-lg font-bold text-stone-900">
            Ring setting: {slotNames(rotors.length)[ringSlot].toLowerCase()} rotor (
            {rotors[ringSlot]})
          </h2>
          <RingControls slot={ringSlot} />
        </section>
      )}

      <div className="reveal-on-focus absolute inset-2 flex flex-col gap-3 overflow-y-auto rounded-xl bg-stone-950/95 p-3 ring-1 ring-stone-700">
        <h2 className="text-center text-xs font-semibold tracking-widest text-stone-300 uppercase">
          Machine controls
        </h2>
        <RotorWindows />
        {lidOpen && <RotorBay compact />}
        <Lampboard />
        <Keyboard />
        <Plugboard />
      </div>
    </section>
  )
}

/** Shown over the model while the lid is open: what to do, ring buttons, and "put it back". */
function LidStrip() {
  const rotors = useMachine((s) => s.config.rotors)
  const hand = useMachine((s) => s.hand)
  const message = useMachine((s) => s.rotorMessage)
  const names = slotNames(rotors.length)
  const store = machineStore.getState
  const button =
    'rounded border border-stone-500 px-2 py-0.5 text-sm text-stone-100 hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-amber-300'
  return (
    <div className="absolute right-2 bottom-2 left-2 flex flex-col gap-2 rounded-lg bg-stone-900/90 p-2 text-sm text-stone-200">
      <p data-testid="rotor-message">{message}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-stone-400">Set ring:</span>
        {rotors.map((rotor, slot) => (
          <button
            key={slot}
            type="button"
            className={button}
            onClick={() => store().setRingSlot(slot)}
            aria-label={`Set ring for the ${names[slot].toLowerCase()} rotor (${rotor})`}
          >
            {names[slot]} ({rotor})
          </button>
        ))}
        {hand && (
          <button
            type="button"
            className={`${button} ml-auto`}
            onClick={() => announce(store().returnRotor() ?? '')}
          >
            Put rotor {hand.rotor} back
          </button>
        )}
      </div>
    </div>
  )
}
