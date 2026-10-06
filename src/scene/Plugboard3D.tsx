import { useCursor } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { CatmullRomCurve3, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { announce } from '../ui2d/announce.ts'
import { trackPointer } from '../ui2d/dragging.ts'
import { CABLE_COLORS, KEY_ROWS } from '../ui2d/layout.ts'
import { setOrbitEnabled } from './controls.ts'
import { Instanced } from './Instanced.tsx'
import { CASE, socketAt } from './layout3d.ts'
import { letterTexture } from './textures.ts'

const LETTERS = KEY_ROWS.join('')

/** The two holes of every socket, one above the other as on the real machines. */
const HOLES = [...LETTERS].flatMap((letter) => {
  const [x, y, z] = socketAt(letter)
  return [-0.108, 0.108].map((dy) => [x, y + dy, z + 0.01] as const)
})
const RINGS = [...LETTERS].map((letter) => {
  const [x, y, z] = socketAt(letter)
  return [x, y, z + 0.012] as const
})
const store = () => machineStore.getState()
const say = (text: string | null) => text && announce(text)
const isPlugged = (letter: string) => store().config.plugboard.some((p) => p.includes(letter))

/** Plane just in front of the plugboard, where a loose cable end follows the pointer. */
const BOARD_PLANE = new Plane(new Vector3(0, 0, 1), -(CASE.front + 0.3))

/** The socket whose centre is nearest a point on the board, if one is close enough. */
function socketNear(point: Vector3): string | null {
  let best: string | null = null
  let distance = 0.5
  for (const letter of LETTERS) {
    const [x, y] = socketAt(letter)
    const d = Math.hypot(point.x - x, point.y - y)
    if (d < distance) [best, distance] = [letter, d]
  }
  return best
}

export function Plugboard3D() {
  const pairs = useMachine((s) => s.config.plugboard)
  const selected = useMachine((s) => s.plugSelection)
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  /** Loose cable end following the pointer while a cable is being dragged. */
  const [loose, setLoose] = useState<Vector3 | null>(null)

  const colorOf = (letter: string) => {
    const i = pairs.findIndex((p) => p.includes(letter))
    return i < 0 ? null : CABLE_COLORS[i % CABLE_COLORS.length]
  }

  const pointOnBoard = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect()
    const ndc = new Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    )
    const ray = new Raycaster()
    ray.setFromCamera(ndc, camera)
    return ray.ray.intersectPlane(BOARD_PLANE, new Vector3())
  }

  /**
   * The same gesture as the 2D board: a click starts, finishes or unplugs a cable; dragging lays
   * a cable to wherever it's dropped, and dragging a plug out of a socket moves it.
   */
  const onSocketPointerDown = (e: ThreeEvent<PointerEvent>, letter: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setOrbitEnabled(false)
    const plugged = isPlugged(letter)
    const pending = store().plugSelection
    if (!plugged && pending && pending !== letter) return say(store().activateSocket(letter))
    if (!plugged && !pending) say(store().activateSocket(letter))
    let pulled = false
    trackPointer(e.nativeEvent, {
      onMove: (ev, dragged) => {
        if (!dragged) return
        if (plugged && !pulled) {
          pulled = true
          say(store().pullPlug(letter))
        }
        setLoose(pointOnBoard(ev.clientX, ev.clientY))
      },
      onUp: (ev, dragged) => {
        setLoose(null)
        if (!dragged) {
          if (plugged) say(store().activateSocket(letter)) // click on a plugged socket: unplug
          return
        }
        const point = pointOnBoard(ev.clientX, ev.clientY)
        const target = point && socketNear(point)
        const from = store().plugSelection
        if (target && from && target !== from && !isPlugged(target)) {
          say(store().activateSocket(target))
        } else if (target !== letter) {
          say(store().cancelPlug())
        }
      },
    })
  }

  return (
    <group>
      {/* Static parts shared by all sockets: one draw call each. */}
      <Instanced positions={HOLES}>
        <circleGeometry args={[0.063, 16]} />
        <meshBasicMaterial color="#050505" />
      </Instanced>
      <Instanced positions={RINGS}>
        <ringGeometry args={[0.27, 0.306, 32]} />
        <meshStandardMaterial color="#57534e" metalness={0.6} roughness={0.4} />
      </Instanced>
      {[...LETTERS].map((letter) => (
        <Socket
          key={letter}
          letter={letter}
          selected={selected === letter}
          plugColor={colorOf(letter) ?? (selected === letter ? '#fbbf24' : null)}
          onPointerDown={onSocketPointerDown}
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
      {loose && selected && <Cable from={selected} to={loose} color="#fbbf24" />}
    </group>
  )
}

function Socket({
  letter,
  selected,
  plugColor,
  onPointerDown,
}: {
  letter: string
  selected: boolean
  plugColor: string | null
  onPointerDown: (e: ThreeEvent<PointerEvent>, letter: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

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
      {selected && (
        // The selected socket's ring glows amber over the plain (instanced) one.
        <mesh position={[0, 0, 0.014]}>
          <ringGeometry args={[0.27, 0.306, 32]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={1.5}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      )}
      {plugColor && (
        <mesh position={[0, 0, 0.18]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.135, 0.153, 0.3, 20]} />
          <meshStandardMaterial color={plugColor} roughness={0.5} />
        </mesh>
      )}
      {/* Generous invisible hit target: not drawn, but still hit-tested. */}
      <mesh
        name={`socket-${letter}`}
        visible={false}
        position={[0, 0.12, 0.05]}
        onPointerDown={(e) => onPointerDown(e, letter)}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[0.8, 0.8]} />
      </mesh>
    </group>
  )
}

/** A cable from a socket to another socket, or to a loose end being dragged. */
function Cable({ from, to, color }: { from: string; to: string | Vector3; color: string }) {
  const curve = useMemo(() => {
    const a = new Vector3(...socketAt(from)).add(new Vector3(0, 0, 0.35))
    const b =
      typeof to === 'string' ? new Vector3(...socketAt(to)).add(new Vector3(0, 0, 0.35)) : to
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
