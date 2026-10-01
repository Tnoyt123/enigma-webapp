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
