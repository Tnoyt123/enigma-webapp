import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { MathUtils } from 'three'

const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Frame-rate independent easing toward a target; snaps immediately when the user prefers reduced motion. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return reducedMotion ? target : MathUtils.damp(current, target, lambda, dt)
}

/** Wraps an angle difference into (-π, π] so rotations take the short way round. */
export function shortestAngle(delta: number): number {
  return MathUtils.euclideanModulo(delta + Math.PI, Math.PI * 2) - Math.PI
}

/**
 * The time step every animation advances by this frame. The canvas renders on demand, so the
 * first frame after a pause reports the whole idle time, and a frame that compiles new shaders can
 * take hundreds of milliseconds; taken at face value, a motion would jump to its end. So a frame
 * far longer than this device's usual frame counts as only a little longer than usual. The usual
 * frame time is learned as frames go by, so a slow device (or a software GPU) still animates at
 * its own pace instead of being made to draw extra frames.
 */
let frameStep = 1 / 60
let usualFrame = 1 / 60
/** A frame longer than this many usual frames is an outlier. */
const OUTLIER = 3

/** This frame's time step, for animations driven outside useSettlingFrame (the camera). */
export const currentFrameStep = () => frameStep

/** Measures each frame's time step before anything animates. Call once, inside the canvas. */
export function useFrameClock(): void {
  useFrame((_, dt) => {
    frameStep = Math.min(dt, usualFrame * OUTLIER)
    usualFrame += (frameStep - usualFrame) * 0.2
  }, -2) // before the camera controls (-1) and every animation (0)
}

/**
 * The canvas renders on demand. This runs `step` every frame while something is moving and asks
 * for another frame until `step` reports it has settled; changing `deps` starts it moving again.
 */
export function useSettlingFrame(step: (dt: number) => boolean, deps: readonly unknown[]): void {
  const invalidate = useThree((s) => s.invalidate)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` are the animation's targets
  useEffect(() => invalidate(), deps)
  useFrame(() => {
    if (step(frameStep)) invalidate()
  })
}

/** Eases `current` toward `target`; returns the new value and whether it is still moving. */
export function settle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
  epsilon = 1e-3,
) {
  const next = damp(current, target, lambda, dt)
  return Math.abs(next - target) < epsilon
    ? { value: target, moving: false }
    : { value: next, moving: true }
}
