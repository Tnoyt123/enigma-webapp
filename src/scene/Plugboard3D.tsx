import { useCursor } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { CatmullRomCurve3, Vector3 } from 'three'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { announce } from '../ui2d/announce.ts'
import { CABLE_COLORS, KEY_ROWS } from '../ui2d/layout.ts'
import { socketAt } from './layout3d.ts'
import { letterTexture } from './textures.ts'

const LETTERS = KEY_ROWS.join('')

export function Plugboard3D() {
  const pairs = useMachine((s) => s.config.plugboard)
  const selected = useMachine((s) => s.plugSelection)
  const colorOf = (letter: string) => {
    const i = pairs.findIndex((p) => p.includes(letter))
    return i < 0 ? null : CABLE_COLORS[i % CABLE_COLORS.length]
  }

  return (
    <group>
      {[...LETTERS].map((letter) => (
        <Socket
          key={letter}
          letter={letter}
          selected={selected === letter}
          plugColor={colorOf(letter) ?? (selected === letter ? '#fbbf24' : null)}
        />
      ))}
      {pairs.map((pair, i) => (
        <Cable
          key={pair}
          from={pair[0]}
          to={pair[1]}
          color={CABLE_COLORS[i % CABLE_COLORS.length]}
        />
      ))}
    </group>
  )
}

function Socket({
  letter,
  selected,
  plugColor,
}: {
  letter: string
  selected: boolean
  plugColor: string | null
}) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    announce(machineStore.getState().activateSocket(letter))
  }

  return (
    <group position={socketAt(letter)}>
      {/* Letter label, clear of the socket ring and plug below it. */}
      <mesh position={[0, 0.47, 0.01]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshStandardMaterial
          map={letterTexture(letter, '#e7e5e4', '#1f1c19', 64)}
          roughness={0.9}
        />
      </mesh>
      {/* The two holes of the socket, one above the other as on the real machines. */}
      {[-0.108, 0.108].map((dy) => (
        <mesh key={dy} position={[0, dy, 0.01]}>
          <circleGeometry args={[0.063, 16]} />
          <meshBasicMaterial color="#050505" />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.012]}>
        <ringGeometry args={[0.27, 0.306, 32]} />
        <meshStandardMaterial
          color={selected ? '#fbbf24' : '#57534e'}
          emissive={selected ? '#fbbf24' : '#000'}
          emissiveIntensity={selected ? 1.5 : 0}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      {plugColor && (
        <mesh position={[0, 0, 0.18]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.135, 0.153, 0.3, 20]} />
          <meshStandardMaterial color={plugColor} roughness={0.5} />
        </mesh>
      )}
      {/* Generous invisible hit target. */}
      <mesh
        name={`socket-${letter}`}
        position={[0, 0.12, 0.05]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Cable({ from, to, color }: { from: string; to: string; color: string }) {
  const curve = useMemo(() => {
    const a = new Vector3(...socketAt(from)).add(new Vector3(0, 0, 0.35))
    const b = new Vector3(...socketAt(to)).add(new Vector3(0, 0, 0.35))
    const sag = 0.5 + a.distanceTo(b) * 0.12
    const mid = new Vector3((a.x + b.x) / 2, Math.min(a.y, b.y) - sag, a.z + 0.5)
    return new CatmullRomCurve3([
      a,
      new Vector3().lerpVectors(a, mid, 0.5).setZ(a.z + 0.35),
      mid,
      new Vector3().lerpVectors(b, mid, 0.5).setZ(b.z + 0.35),
      b,
    ])
  }, [from, to])

  return (
    <mesh>
      <tubeGeometry args={[curve, 48, 0.04, 8, false]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  )
}
