import { RoundedBox } from '@react-three/drei'
import { useTeaching } from '../state/teachingStore.ts'
import { CASE } from './layout3d.ts'
import { xrayProps } from './xray.ts'

const WOOD = '#6e4524'
const CRINKLE = '#1f1c19'

/** Wooden box, black crinkle-painted deck and the front plugboard panel. */
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
        <meshStandardMaterial color={WOOD} roughness={0.6} {...xrayProps(xray, 0.15)} />
      </RoundedBox>
      {/* Deck. */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]}>
        <planeGeometry args={[width - wall * 2, depth - wall * 2]} />
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
