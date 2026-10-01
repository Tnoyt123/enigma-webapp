import type { CameraControls } from '@react-three/drei'
import { machineStore } from '../state/machineStore.ts'
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
  if (!controls) return
  const { position, target } = CAMERA_PRESETS[preset]
  const aspect = 'aspect' in controls.camera ? controls.camera.aspect : FRAMED_ASPECT
  const k = Math.max(1, FRAMED_ASPECT / aspect)
  const [x, y, z] = position.map((p, i) => target[i] + (p - target[i]) * k)
  void controls.setLookAt(x, y, z, ...target, animate)
}

/** Releases a key pressed on the model, wherever the pointer is let go, and resumes orbiting. */
export function releasePointerKey(): void {
  setOrbitEnabled(true)
  if (machineStore.getState().heldKey) machineStore.getState().keyUp()
}
