import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { createStore } from 'zustand'
import type { RotorId } from '../engine/index.ts'
import { trackPointer } from '../ui2d/dragging.ts'
import { gesture, setOrbitEnabled } from './controls.ts'
import { LIFT, ROTOR } from './layout3d.ts'

/** A rotor being dragged across the 3D model: it follows the pointer at lift height. */
export interface Carried {
  readonly rotor: RotorId
  readonly ring: number
  readonly point: [number, number, number]
}

export const carryStore = createStore<{ carried: Carried | null }>()(() => ({ carried: null }))

/** Horizontal plane at the height a lifted rotor hovers. */
const CARRY_PLANE = new Plane(new Vector3(0, 1, 0), -(ROTOR.y + LIFT))

/**
 * Returns a handler for pressing on a rotor (in a slot or the box): it marks the rotor gesture,
 * and once the pointer moves far enough, carries the rotor along under it until release.
 * Where it's dropped is decided by the slot and box drop targets.
 */
export function useCarry() {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)

  const pointUnder = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect()
    const ray = new Raycaster()
    ray.setFromCamera(
      new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1),
      camera,
    )
    return ray.ray.intersectPlane(CARRY_PLANE, new Vector3())
  }

  return (e: ThreeEvent<PointerEvent>, rotor: RotorId, ring: number) => {
    e.stopPropagation()
    setOrbitEnabled(false)
    Object.assign(gesture, { rotorDrag: true, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
    trackPointer(e.nativeEvent, {
      onMove: (ev, dragged) => {
        const p = dragged && pointUnder(ev.clientX, ev.clientY)
        if (p) carryStore.setState({ carried: { rotor, ring, point: [p.x, p.y, p.z] } })
      },
      onUp: () => carryStore.setState({ carried: null }),
    })
  }
}
