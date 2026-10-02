import type { CameraControls } from '@react-three/drei'
import { machineStore } from '../state/machineStore.ts'
import { DRAG_THRESHOLD } from '../ui2d/dragging.ts'
import { CAMERA_PRESETS, type CameraPreset } from './layout3d.ts'

/** The scene's camera controls, shared so machine parts can pause orbiting while being pressed. */
let controls: CameraControls | null = null

export function registerControls(instance: CameraControls | null): void {
  controls = instance
  // Start at the operator's seat.
  if (instance) moveCamera('operator', false)
}

export function setOrbitEnabled(enabled: boolean): void {
  if (controls) controls.enabled = enabled
}

/** Presets are framed for a landscape canvas about this shape; narrower ones pull the camera back. */
const FRAMED_ASPECT = 1.15

export function moveCamera(preset: CameraPreset, animate = true): void {
  const { position, target } = CAMERA_PRESETS[preset]
  moveCameraTo(position, target, animate)
}

/** Points the camera from `position` at `target`, pulling back on narrow canvases. */
export function moveCameraTo(
  position: readonly [number, number, number],
  target: readonly [number, number, number],
  animate = true,
): void {
  if (!controls) return
  const aspect = 'aspect' in controls.camera ? controls.camera.aspect : FRAMED_ASPECT
  const k = Math.max(1, FRAMED_ASPECT / aspect)
  const [x, y, z] = position.map((p, i) => target[i] + (p - target[i]) * k)
  void controls.setLookAt(x, y, z, target[0], target[1], target[2], animate)
}

/** A rotor pressed on the model: where the press started, so a release can tell click from drag. */
export const gesture = { rotorDrag: false, x: 0, y: 0, overThumbwheel: false }

/** While over a thumbwheel the scroll wheel turns it, so the page mustn't scroll as well. */
export function blockPageScrollOverThumbwheels(element: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    if (gesture.overThumbwheel) e.preventDefault()
  }
  element.addEventListener('wheel', onWheel, { passive: false })
  return () => element.removeEventListener('wheel', onWheel)
}

/** True if the pointer has moved far enough from the rotor press to count as a drag-and-drop. */
export function rotorDropped(e: { clientX: number; clientY: number }): boolean {
  return (
    gesture.rotorDrag && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > DRAG_THRESHOLD
  )
}

/** Releases a key pressed on the model, wherever the pointer is let go, and resumes orbiting. */
export function releasePointerKey(): void {
  setOrbitEnabled(true)
  gesture.rotorDrag = false
  if (machineStore.getState().heldKey) machineStore.getState().keyUp()
}
