import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { MODELS } from '../engine/index.ts'
import { useMachine } from '../state/machineStore.ts'
import { teachingStore, useTeaching } from '../state/teachingStore.ts'
import { Keyboard } from '../ui2d/Keyboard.tsx'
import { Lampboard } from '../ui2d/Lampboard.tsx'
import { Plugboard } from '../ui2d/Plugboard.tsx'
import { RotorWindows } from '../ui2d/RotorWindows.tsx'
import { moveCamera, releasePointerKey } from './controls.ts'
import { CAMERA_PRESETS, type CameraPreset } from './layout3d.ts'
import { Scene } from './Scene.tsx'

/**
 * The 3D machine. Pointer users work the model directly; keyboard and screen-reader users get
 * the same controls as the 2D view (same names, same store actions), revealed while focused.
 */
export default function Machine3D() {
  const model = useMachine((s) => MODELS[s.config.model].name)
  const [preset, setPreset] = useState<CameraPreset>('operator')
  const xray = useTeaching((s) => s.xray)

  // A key pressed on the model is released wherever the pointer is let go.
  useEffect(() => {
    window.addEventListener('pointerup', releasePointerKey)
    window.addEventListener('pointercancel', releasePointerKey)
    return () => {
      window.removeEventListener('pointerup', releasePointerKey)
      window.removeEventListener('pointercancel', releasePointerKey)
    }
  }, [])

  const choose = (next: CameraPreset) => {
    setPreset(next)
    moveCamera(next)
  }

  return (
    <section
      aria-label={`${model} machine, 3D`}
      className="relative self-start overflow-hidden rounded-2xl border-[6px] border-[#5c3a1e] bg-stone-950 shadow-2xl sm:border-[10px]"
    >
      <div
        role="img"
        aria-label={`Interactive 3D model of the ${model}. Drag to look around; click keys, thumbwheels and plugboard sockets. Keyboard users: press Tab to reach the machine's controls.`}
        className="h-[min(72vh,44rem,115vw)] min-h-[18rem] touch-none"
      >
        <Canvas
          // Draw only when something changes: saves battery, and keeps slow (software) GPUs usable.
          frameloop="demand"
          // Above 1.5× the extra pixels cost far more than they add.
          dpr={[1, 1.5]}
          camera={{ fov: 35, position: CAMERA_PRESETS.operator.position }}
          data-testid="machine-3d-canvas"
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
          aria-pressed={xray}
          onClick={() => teachingStore.getState().setXray(!xray)}
          className="rounded px-2.5 py-1 text-sm text-stone-200 hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-amber-300 aria-pressed:bg-sky-300 aria-pressed:text-stone-900"
        >
          X-ray
        </button>
      </div>
      <p className="pointer-events-none absolute right-3 bottom-3 hidden rounded bg-stone-900/80 px-2 py-1 text-xs text-stone-300 sm:block">
        Click a thumbwheel to turn it forward; Shift-click or right-click to turn it back.
      </p>

      <div className="reveal-on-focus absolute inset-2 flex flex-col gap-3 overflow-y-auto rounded-xl bg-stone-950/95 p-3 ring-1 ring-stone-700">
        <h2 className="text-center text-xs font-semibold tracking-widest text-stone-300 uppercase">
          Machine controls
        </h2>
        <RotorWindows />
        <Lampboard />
        <Keyboard />
        <Plugboard />
      </div>
    </section>
  )
}
