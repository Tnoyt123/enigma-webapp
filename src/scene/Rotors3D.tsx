import { useCursor } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Group } from 'three'
import { mod26, ROTORS } from '../engine/index.ts'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { ROTOR, rotorSlotsX } from './layout3d.ts'
import { damp, shortestAngle } from './motion.ts'
import { alphabetRingTexture, knurlTexture } from './textures.ts'

const STEP = (Math.PI * 2) / 26
const METAL = { color: '#9a958e', metalness: 0.85, roughness: 0.35 } as const

/**
 * Rotation about the axle that brings letter `position` round to the reading window.
 * The ring texture puts letter i at angle (i + ½)·STEP from +z, measured toward −y.
 */
function angleFor(position: number): number {
  return -(position + 0.5) * STEP - ROTOR.readingAngle
}

export function Rotors3D() {
  const rotors = useMachine((s) => s.config.rotors)
  const positions = useMachine((s) => s.positions)
  const xs = rotorSlotsX(rotors.length)
  const half = ROTOR.ringWidth / 2

  return (
    <group position={[0, ROTOR.y, ROTOR.z]}>
      {rotors.map((id, slot) => (
        <Rotor
          key={slot}
          slot={slot}
          x={xs[slot]}
          thin={ROTORS[id].thin}
          position={positions[slot]}
        />
      ))}
      {/* Reflector (UKW) on the left and entry wheel (ETW) on the right. */}
      <mesh position={[xs[0] - 0.95, 0, 0]} rotation-z={-Math.PI / 2}>
        <cylinderGeometry args={[ROTOR.radius * 0.95, ROTOR.radius * 0.95, 0.3, 40]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[xs.at(-1)! + half + 0.45, 0, 0]} rotation-z={-Math.PI / 2}>
        <cylinderGeometry args={[ROTOR.radius * 0.9, ROTOR.radius * 0.9, 0.4, 40]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Axle. */}
      <mesh rotation-z={-Math.PI / 2}>
        <cylinderGeometry args={[0.08, 0.08, xs.at(-1)! - xs[0] + 3, 12]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  )
}

function Rotor({
  slot,
  x,
  thin,
  position,
}: {
  slot: number
  x: number
  thin: boolean
  position: number
}) {
  const spin = useRef<Group>(null)
  const angle = useRef(angleFor(position))
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const ringWidth = thin ? ROTOR.ringWidth * 0.7 : ROTOR.ringWidth
  const ring = alphabetRingTexture()
  const knurl = knurlTexture()

  useFrame((_, dt) => {
    const target = angle.current + shortestAngle(angleFor(position) - angle.current)
    angle.current = damp(angle.current, target, 18, dt)
    if (spin.current) spin.current.rotation.x = angle.current
  })

  const turn = (delta: number) =>
    machineStore
      .getState()
      .setPosition(slot, mod26(machineStore.getState().positions[slot] + delta))

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return // the pointer was dragged to orbit, not clicked
    turn(e.nativeEvent.shiftKey ? -1 : 1)
  }

  return (
    <group position={[x, 0, 0]}>
      <group ref={spin}>
        {/* Alphabet ring. */}
        <mesh rotation-z={-Math.PI / 2}>
          <cylinderGeometry args={[ROTOR.radius, ROTOR.radius, ringWidth, 52, 1, true]} />
          <meshStandardMaterial map={ring} roughness={0.5} />
        </mesh>
        {/* Core with the wiring inside. */}
        <mesh rotation-z={-Math.PI / 2}>
          <cylinderGeometry
            args={[ROTOR.radius * 0.96, ROTOR.radius * 0.96, ringWidth + 0.02, 40]}
          />
          <meshStandardMaterial color="#2b2825" roughness={0.6} />
        </mesh>
        {/* Thumbwheel, on the left of the ring. */}
        <mesh
          name={`thumbwheel-${slot}`}
          position={[-(ringWidth + ROTOR.wheelWidth) / 2, 0, 0]}
          rotation-z={-Math.PI / 2}
          onClick={onClick}
          onContextMenu={(e) => {
            e.stopPropagation()
            e.nativeEvent.preventDefault()
            turn(-1)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
        >
          <cylinderGeometry args={[ROTOR.wheelRadius, ROTOR.wheelRadius, ROTOR.wheelWidth, 64]} />
          <meshStandardMaterial attach="material-0" map={knurl} roughness={0.7} />
          <meshStandardMaterial attach="material-1" color="#24211e" roughness={0.6} />
          <meshStandardMaterial attach="material-2" color="#24211e" roughness={0.6} />
        </mesh>
      </group>
      <WindowFrame width={ringWidth} />
    </group>
  )
}

/** Brass frame marking the letter the operator reads, like the window in the lid. */
function WindowFrame({ width }: { width: number }) {
  const h = STEP * ROTOR.radius * 1.15
  const w = width + 0.08
  const t = 0.035
  const brass = { color: '#c9a24a', metalness: 0.9, roughness: 0.3 }
  return (
    <group rotation-x={Math.PI / 2 - ROTOR.readingAngle}>
      <group position={[0, ROTOR.radius + 0.03, 0]}>
        {[
          [0, 0, h / 2, w, t],
          [0, 0, -h / 2, w, t],
          [w / 2, 0, 0, t, h + t],
          [-w / 2, 0, 0, t, h + t],
        ].map(([px, py, pz, sx, sz], i) => (
          <mesh key={i} position={[px, py, pz]}>
            <boxGeometry args={[sx, t, sz]} />
            <meshStandardMaterial {...brass} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
