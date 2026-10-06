import { RoundedBox } from '@react-three/drei'
import { BackSide, Plane, Vector3 } from 'three'
import { useTeaching } from '../state/teachingStore.ts'
import { CASE, WELL } from './layout3d.ts'
import { xrayProps } from './xray.ts'

const WOOD = '#6e4524'
const CRINKLE = '#1f1c19'

/**
 * Carves the rotor well out of the solid body: with clipIntersection, a fragment is dropped
 * only when it is inside all of these planes, i.e. inside the well.
 */
const WELL_CLIP = [
  new Plane(new Vector3(-1, 0, 0), -WELL.halfWidth),
  new Plane(new Vector3(1, 0, 0), -WELL.halfWidth),
  new Plane(new Vector3(0, 0, -1), WELL.back),
  new Plane(new Vector3(0, 0, 1), -WELL.front),
  new Plane(new Vector3(0, -1, 0), WELL.floor),
]

/** Wooden box with the rotor well, black crinkle-painted deck and the front plugboard panel. */
export function Case() {
  const xray = useTeaching((s) => s.xray)
  const width = CASE.right - CASE.left
  const depth = CASE.front - CASE.back
  const height = -CASE.bottom
  const cx = (CASE.left + CASE.right) / 2
  const cz = (CASE.back + CASE.front) / 2
  const wall = 0.28

  return (
    <group>
      {/* Body, just below the deck. */}
      <RoundedBox
        args={[width, height, depth]}
        radius={0.12}
        position={[cx, CASE.bottom / 2 - 0.01, cz]}
      >
        <meshStandardMaterial
          color={WOOD}
          roughness={0.6}
          clippingPlanes={WELL_CLIP}
          clipIntersection
          {...xrayProps(xray, 0.15)}
        />
      </RoundedBox>
      {/* Inside of the rotor well: only the faces seen from within are drawn. */}
      <mesh position={[0, WELL.floor / 2, (WELL.back + WELL.front) / 2]}>
        <boxGeometry args={[WELL.halfWidth * 2, -WELL.floor, WELL.front - WELL.back]} />
        <meshStandardMaterial
          color="#141210"
          roughness={0.95}
          side={BackSide}
          {...xrayProps(xray, 0.15)}
        />
      </mesh>
      {/* Deck in front of the hatch. */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, (WELL.front + CASE.front - wall) / 2]}>
        <planeGeometry args={[width - wall * 2, CASE.front - wall - WELL.front]} />
        <meshStandardMaterial color={CRINKLE} roughness={0.95} {...xrayProps(xray, 0.25)} />
      </mesh>
      {/* Lip around the deck. */}
      {[
        { size: [width, CASE.lip, wall], pos: [cx, CASE.lip / 2, CASE.back + wall / 2] },
        { size: [width, CASE.lip, wall], pos: [cx, CASE.lip / 2, CASE.front - wall / 2] },
        { size: [wall, CASE.lip, depth], pos: [CASE.left + wall / 2, CASE.lip / 2, cz] },
        { size: [wall, CASE.lip, depth], pos: [CASE.right - wall / 2, CASE.lip / 2, cz] },
      ].map(({ size, pos }, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={size as [number, number, number]} />
          <meshStandardMaterial color={WOOD} roughness={0.6} {...xrayProps(xray, 0.15)} />
        </mesh>
      ))}
      {/* Plugboard panel on the front face, from just under the lip down to y ≈ −3.42. */}
      <mesh position={[cx, -1.935, CASE.front + 0.005]}>
        <boxGeometry args={[width - 0.7, 2.97, 0.02]} />
        <meshStandardMaterial color={CRINKLE} roughness={0.9} {...xrayProps(xray, 0.3)} />
      </mesh>
    </group>
  )
}
