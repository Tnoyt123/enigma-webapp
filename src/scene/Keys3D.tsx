import { useCursor } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Group } from 'three'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { KEY_ROWS } from '../ui2d/layout.ts'
import { announcePress } from '../ui2d/usePhysicalKeyboard.ts'
import { releasePointerKey, setOrbitEnabled } from './controls.ts'
import { keyAt } from './layout3d.ts'
import { damp } from './motion.ts'
import { letterTexture } from './textures.ts'

const LETTERS = KEY_ROWS.join('')

export function Keys3D() {
  return (
    <group>
      {[...LETTERS].map((letter) => (
        <Key key={letter} letter={letter} />
      ))}
    </group>
  )
}

function Key({ letter }: { letter: string }) {
  const held = useMachine((s) => s.heldKey === letter)
  const travel = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useFrame((_, dt) => {
    if (travel.current)
      travel.current.position.y = damp(travel.current.position.y, held ? -0.2 : 0, 40, dt)
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setOrbitEnabled(false)
    const trace = machineStore.getState().keyDown(letter)
    if (trace) announcePress(trace)
  }

  return (
    <group position={keyAt(letter)}>
      <group ref={travel}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.6, 12]} />
          <meshStandardMaterial color="#8a8580" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh
          name={`key-${letter}`}
          position={[0, 0.62, 0]}
          rotation-y={Math.PI / 2}
          onPointerDown={onPointerDown}
          onPointerUp={(e) => {
            e.stopPropagation()
            releasePointerKey()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
        >
          <cylinderGeometry args={[0.37, 0.37, 0.12, 40]} />
          <meshStandardMaterial attach="material-0" color="#111" roughness={0.4} />
          <meshStandardMaterial
            attach="material-1"
            map={letterTexture(letter, '#f5f5f4', '#141210')}
            roughness={0.35}
          />
          <meshStandardMaterial attach="material-2" color="#111" />
        </mesh>
        <mesh position={[0, 0.68, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.37, 0.035, 10, 40]} />
          <meshStandardMaterial color="#d6d3d1" metalness={1} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
}
