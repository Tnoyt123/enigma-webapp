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
 * The canvas renders on demand. This runs `step` every frame while something is moving and asks
 * for another frame until `step` reports it has settled; changing `deps` starts it moving again.
 */
export function useSettlingFrame(step: (dt: number) => boolean, deps: readonly unknown[]): void {
  const invalidate = useThree((s) => s.invalidate)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` are the animation's targets
  useEffect(() => invalidate(), deps)
  useFrame((_, dt) => {
    if (step(dt)) invalidate()
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
