import { useCursor } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { BufferGeometry, Float32BufferAttribute, type Group } from 'three'
import { mod26, ROTORS, toIndex, type RotorId } from '../engine/index.ts'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { useTeaching } from '../state/teachingStore.ts'
import { reveal } from '../teaching/explain.ts'
import { angleFor, ROTOR, ringPoint, rotorStack } from './layout3d.ts'
import { damp, shortestAngle } from './motion.ts'
import { xrayProps } from './xray.ts'
import { alphabetRingTexture, knurlTexture } from './textures.ts'

const STEP = (Math.PI * 2) / 26
const METAL = { color: '#9a958e', metalness: 0.85, roughness: 0.35 } as const

export function Rotors3D() {
  const rotors = useMachine((s) => s.config.rotors)
  const rings = useMachine((s) => s.config.rings)
  const positions = useMachine((s) => s.positions)
  const trace = useMachine((s) => s.lastTrace)
  const xray = useTeaching((s) => s.xray)
  const stepMode = useTeaching((s) => s.stepMode)
  const cursor = useTeaching((s) => s.cursor)
  const stack = rotorStack(rotors.map((id) => ROTORS[id].thin))

  // Glow the windows of rotors that just stepped while the walkthrough is on that step,
  // and the middle rotor whenever the last press was a double step.
  const middle = rotors.length - 2
  const pressFocus =
    stepMode && trace && reveal(cursor, trace.stages.length).focus === 'press'
      ? trace.stepped
      : null
  const glow = (slot: number) =>
    pressFocus?.[slot] ? 'step' : trace?.doubleStep && slot === middle ? 'double' : null

  return (
    <group position={[0, ROTOR.y, ROTOR.z]}>
      {rotors.map((id, slot) => (
        <Rotor
          key={slot}
          slot={slot}
          rotor={id}
          ring={rings[slot]}
          x={stack.slots[slot].x}
          ringWidth={stack.slots[slot].ringWidth}
          position={positions[slot]}
          xray={xray}
          glow={glow(slot)}
        />
      ))}
      {/* Reflector (UKW) on the left and entry wheel (ETW) on the right. */}
      <mesh position={[stack.reflector.x, 0, 0]} rotation-z={-Math.PI / 2}>
        <cylinderGeometry
          args={[ROTOR.radius * 0.95, ROTOR.radius * 0.95, stack.reflector.width, 40]}
        />
        <meshStandardMaterial {...METAL} {...xrayProps(xray, 0.25)} />
      </mesh>
      <mesh position={[stack.entry.x, 0, 0]} rotation-z={-Math.PI / 2}>
        <cylinderGeometry args={[ROTOR.radius * 0.9, ROTOR.radius * 0.9, stack.entry.width, 40]} />
        <meshStandardMaterial {...METAL} {...xrayProps(xray, 0.25)} />
      </mesh>
      {/* Axle. */}
      <mesh rotation-z={-Math.PI / 2}>
        <cylinderGeometry args={[0.08, 0.08, stack.entry.x - stack.reflector.x + 0.6, 12]} />
        <meshStandardMaterial {...METAL} {...xrayProps(xray, 0.4)} />
      </mesh>
    </group>
  )
}

function Rotor({
  slot,
  rotor,
  ring,
  x,
  ringWidth,
  position,
  xray,
  glow,
}: {
  slot: number
  rotor: RotorId
  ring: number
  x: number
  ringWidth: number
  position: number
  xray: boolean
  glow: 'step' | 'double' | null
}) {
  const spin = useRef<Group>(null)
  const angle = useRef(angleFor(position))
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const ringTexture = alphabetRingTexture()
  const knurl = knurlTexture()
  const left = -ringWidth / 2 - ROTOR.wheelWidth

  // The 26 wires inside the rotor: core contact c (right face) to forward[c] (left face).
  // Core contact c lines up with alphabet-ring letter c + ring.
  const wiring = useMemo(() => {
    const forward = [...ROTORS[rotor].wiring].map(toIndex)
    const points = forward.flatMap((out, c) => [
      ...ringPoint(ringWidth / 2, mod26(c + ring)),
      ...ringPoint(left, mod26(out + ring)),
    ])
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3))
  }, [rotor, ring, ringWidth, left])

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
          <meshStandardMaterial map={ringTexture} roughness={0.5} {...xrayProps(xray, 0.45)} />
        </mesh>
        {/* Core with the wiring inside. */}
        <mesh rotation-z={-Math.PI / 2}>
          <cylinderGeometry
            args={[ROTOR.radius * 0.96, ROTOR.radius * 0.96, ringWidth + 0.02, 40]}
          />
          <meshStandardMaterial color="#2b2825" roughness={0.6} {...xrayProps(xray, 0.12)} />
        </mesh>
        {xray && (
          <lineSegments geometry={wiring}>
            <lineBasicMaterial color="#a8a29e" transparent opacity={0.35} />
          </lineSegments>
        )}
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
          <meshStandardMaterial
            attach="material-0"
            map={knurl}
            roughness={0.7}
            {...xrayProps(xray, 0.3)}
          />
          <meshStandardMaterial attach="material-1" color="#24211e" {...xrayProps(xray, 0.2)} />
          <meshStandardMaterial attach="material-2" color="#24211e" {...xrayProps(xray, 0.2)} />
        </mesh>
      </group>
      <WindowFrame width={ringWidth} glow={glow} />
    </group>
  )
}

/** Brass frame marking the letter the operator reads, like the window in the lid. */
function WindowFrame({ width, glow }: { width: number; glow: 'step' | 'double' | null }) {
  const h = STEP * ROTOR.radius * 1.15
  const w = width + 0.08
  const t = 0.035
  const brass = {
    color: '#c9a24a',
    metalness: 0.9,
    roughness: 0.3,
    emissive: glow === 'double' ? '#ff7a1a' : '#ffd166',
    emissiveIntensity: glow ? 3 : 0,
    toneMapped: !glow,
  }
  return (
    <group
      rotation-x={Math.PI / 2 - ROTOR.readingAngle}
      name={glow ? `window-glow-${glow}` : undefined}
    >
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
