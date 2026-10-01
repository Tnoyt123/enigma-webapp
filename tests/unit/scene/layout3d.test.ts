import fc from 'fast-check'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { mod26, ROTORS, toIndex, type RotorId } from '../../../src/engine/index.ts'
import { angleFor, contactPoint, ringPoint, ROTOR } from '../../../src/scene/layout3d.ts'

const ROTOR_IDS = Object.keys(ROTORS) as RotorId[]

describe('3D rotor geometry', () => {
  it('a rotor at position p carries core contact c onto machine contact c − (p − ring)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ROTOR_IDS),
        fc.integer({ min: 0, max: 25 }),
        fc.integer({ min: 0, max: 25 }),
        fc.integer({ min: 0, max: 25 }),
        (id, ring, position, core) => {
          // Where the wire end for core contact c sits once the rotor has turned to `position`.
          const [x, y, z] = ringPoint(0.3, mod26(core + ring))
          const world = new Vector3(x, y, z).applyAxisAngle(
            new Vector3(1, 0, 0),
            angleFor(position),
          )
          // The machine-frame contact the engine says that core contact meets.
          const m = mod26(core - (position - ring))
          const [cx, cy, cz] = contactPoint(0.3, m)
          const expected = new Vector3(cx, cy - ROTOR.y, cz - ROTOR.z)
          expect(world.distanceTo(expected)).toBeLessThan(1e-9)
          return ROTORS[id] !== undefined
        },
      ),
    )
  })

  it('contact A sits under the reading window', () => {
    const [, y, z] = contactPoint(0, toIndex('A'))
    expect(Math.atan2(y - ROTOR.y, z - ROTOR.z)).toBeCloseTo(ROTOR.readingAngle)
  })

  it('the letter at `position` is the one under the reading window', () => {
    for (let p = 0; p < 26; p++) {
      const [x, y, z] = ringPoint(0, p)
      const world = new Vector3(x, y, z).applyAxisAngle(new Vector3(1, 0, 0), angleFor(p))
      expect(Math.atan2(world.y, world.z)).toBeCloseTo(ROTOR.readingAngle)
    }
  })
})
