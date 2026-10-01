import { keyPosition } from '../ui2d/layout.ts'

/**
 * Scene layout in "key pitch" units (≈ 2.4 cm on the real machine).
 * x: left → right, y: up, z: toward the operator. The top deck is at y = 0.
 */
export const CASE = { left: -5.6, right: 5.6, back: -5.4, front: 6.4, bottom: -3.4, lip: 0.2 }

const KEY_ROW_Z = [3.5, 4.4, 5.3]
const LAMP_ROW_Z = [-0.1, 0.8, 1.7]
const SOCKET_ROW_Y = [-0.95, -1.8, -2.65]

const gridX = (letter: string) => keyPosition(letter).x - 4.5
const gridRow = (letter: string) => keyPosition(letter).y - 0.5

export const keyAt = (letter: string): [number, number, number] => [
  gridX(letter),
  0,
  KEY_ROW_Z[gridRow(letter)],
]
export const lampAt = (letter: string): [number, number, number] => [
  gridX(letter),
  0.012,
  LAMP_ROW_Z[gridRow(letter)],
]
export const socketAt = (letter: string): [number, number, number] => [
  gridX(letter),
  SOCKET_ROW_Y[gridRow(letter)],
  CASE.front + 0.02,
]

export const ROTOR = {
  /** Axle height and depth; the top of each rotor rises through the deck. */
  y: -0.35,
  z: -2.7,
  radius: 1.0,
  ringWidth: 0.5,
  wheelWidth: 0.22,
  wheelRadius: 1.12,
  pitch: 1.35,
  /** Direction the operator reads the window letter from: mostly up, tilted toward them. */
  readingAngle: Math.PI * 0.32,
}

/** x of each rotor slot, left to right, centred on the deck. */
export function rotorSlotsX(slots: number): number[] {
  const first = -((slots - 1) * ROTOR.pitch) / 2 + 0.4
  return Array.from({ length: slots }, (_, i) => first + i * ROTOR.pitch)
}

export type CameraPreset = 'operator' | 'rotors' | 'plugboard'

export const CAMERA_PRESETS: Record<
  CameraPreset,
  { label: string; position: [number, number, number]; target: [number, number, number] }
> = {
  operator: { label: 'Operator', position: [0, 11.5, 18.5], target: [0, -0.9, 1.6] },
  rotors: { label: 'Rotors', position: [0, 6.5, 2.2], target: [0, -0.2, -2.6] },
  plugboard: { label: 'Plugboard', position: [0, 1.2, 19.5], target: [0, -1.9, 6.4] },
}
