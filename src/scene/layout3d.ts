import { keyPosition } from '../ui2d/layout.ts'

/**
 * Scene layout in "key pitch" units (≈ 2.4 cm on the real machine).
 * x: left → right, y: up, z: toward the operator. The top deck is at y = 0.
 */
export const CASE = { left: -5.6, right: 5.6, back: -5.4, front: 6.4, bottom: -3.67, lip: 0.2 }

const KEY_ROW_Z = [3.5, 4.4, 5.3]
const LAMP_ROW_Z = [-0.1, 0.8, 1.7]
const SOCKET_ROW_Y = [-1.1, -2.03, -2.96]

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
  plugboard: { label: 'Plugboard', position: [0, 1.1, 19.5], target: [0, -2.05, 6.4] },
}

const STEP = (Math.PI * 2) / 26
/** Radius of the ring of 26 contacts on each rotor face. */
export const CONTACT_RADIUS = 0.68

/** x extents of every part of the rotor stack, so the model and the signal path agree. */
export function rotorStack(thin: readonly boolean[]) {
  const xs = rotorSlotsX(thin.length)
  const slots = xs.map((x, slot) => {
    const ringWidth = thin[slot] ? ROTOR.ringWidth * 0.7 : ROTOR.ringWidth
    // The thumbwheel sits on the left of the ring; the current crosses both.
    return { x, ringWidth, right: x + ringWidth / 2, left: x - ringWidth / 2 - ROTOR.wheelWidth }
  })
  const reflectorX = xs[0] - 0.95
  const entryX = xs.at(-1)! + ROTOR.ringWidth / 2 + 0.45
  return {
    slots,
    reflector: { x: reflectorX, width: 0.3, right: reflectorX + 0.15, inner: reflectorX - 0.05 },
    entry: { x: entryX, width: 0.4, left: entryX - 0.2, right: entryX + 0.2 },
  }
}

/**
 * World position of machine contact `m` (0 = A) on a rotor-stack face at `x`. Contact A sits
 * under the reading window and the rest follow round the circle, matching the rotor model.
 */
export function contactPoint(x: number, m: number): [number, number, number] {
  const psi = ROTOR.readingAngle - m * STEP
  return [x, ROTOR.y + CONTACT_RADIUS * Math.sin(psi), ROTOR.z + CONTACT_RADIUS * Math.cos(psi)]
}

/**
 * Rotation about the axle that brings alphabet-ring letter `position` to the reading window.
 * The ring texture puts letter i at angle (i + ½)·STEP from +z, measured toward −y.
 */
export function angleFor(position: number): number {
  return -(position + 0.5) * STEP - ROTOR.readingAngle
}

/** Point on a rotor face in the rotor's own (spinning) frame, under alphabet-ring letter ℓ. */
export function ringPoint(x: number, letter: number): [number, number, number] {
  const psi = -(letter + 0.5) * STEP
  return [x, CONTACT_RADIUS * Math.sin(psi), CONTACT_RADIUS * Math.cos(psi)]
}
