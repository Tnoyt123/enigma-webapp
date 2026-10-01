import { useRef } from 'react'
import { Color, type MeshStandardMaterial } from 'three'
import { useMachine } from '../state/machineStore.ts'
import { KEY_ROWS } from '../ui2d/layout.ts'
import { lampAt } from './layout3d.ts'
import { settle, useSettlingFrame } from './motion.ts'
import { letterTexture } from './textures.ts'

const LETTERS = KEY_ROWS.join('')
const GLOW = new Color('#ffb340')

export function Lamps3D() {
  return (
    <group>
      {[...LETTERS].map((letter) => (
        <Lamp key={letter} letter={letter} />
      ))}
    </group>
  )
}

/** A frosted window with a stencilled letter; the bulb beneath makes it glow while lit. */
function Lamp({ letter }: { letter: string }) {
  const lit = useMachine((s) => s.litLamp === letter)
  const material = useRef<MeshStandardMaterial>(null)

  useSettlingFrame(
    (dt) => {
      if (!material.current) return false
      const { value, moving } = settle(
        material.current.emissiveIntensity,
        lit ? 5 : 0,
        30,
        dt,
        0.01,
      )
      material.current.emissiveIntensity = value
      return moving
    },
    [lit],
  )

  return (
    <group position={lampAt(letter)}>
      <mesh name={`lamp-${letter}`} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.36, 40]} />
        <meshStandardMaterial
          ref={material}
          map={letterTexture(letter, '#a39d92', '#2a2622')}
          emissiveMap={letterTexture(letter, '#ffffff', '#4a4642')}
          emissive={GLOW}
          emissiveIntensity={0}
          roughness={0.6}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
        <ringGeometry args={[0.36, 0.43, 40]} />
        <meshStandardMaterial color="#3d3a36" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}
