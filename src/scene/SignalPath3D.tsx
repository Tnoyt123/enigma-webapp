import { Line } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Color } from 'three'
import { ROTORS, toIndex, type MachineConfig, type Trace } from '../engine/index.ts'
import { useMachine } from '../state/machineStore.ts'
import { useTeaching } from '../state/teachingStore.ts'
import { reveal } from '../teaching/explain.ts'
import { contactPoint, keyAt, lampAt, rotorStack, socketAt } from './layout3d.ts'
import { pathInfo } from './xray.ts'

type Point = [number, number, number]

// Brighter than white so the bloom pass makes the path glow.
const FORWARD = new Color(2.4, 1.6, 0.25)
const BACKWARD = new Color(0.35, 1.5, 2.6)
const UNDER_DECK = -0.7

interface Segment {
  readonly stage: number | 'lamp'
  readonly back: boolean
  readonly points: Point[]
}

/** The current's route through the model, in machine-frame contacts, one segment per stage. */
function buildPath(trace: Trace, config: MachineConfig): Segment[] {
  const stack = rotorStack(config.rotors.map((id) => ROTORS[id].thin))
  const front = (letter: string): Point => {
    const [x, y, z] = socketAt(letter)
    return [x, y, z + 0.06]
  }
  const segments: Segment[] = []
  const [kx, , kz] = keyAt(trace.input)
  let at: Point = [kx, 0.62, kz]
  const add = (stage: number | 'lamp', back: boolean, ...points: Point[]) => {
    segments.push({ stage, back, points: [at, ...points] })
    at = points.at(-1)!
  }

  trace.stages.forEach((stage, i) => {
    const m = (letter: string) => toIndex(letter)
    switch (stage.component) {
      case 'plugboard':
        if (stage.direction === 'forward') {
          // Down from the key, under the deck, out to the plugboard socket (and across a cable).
          add(i, false, [kx, UNDER_DECK, kz], front(stage.input), front(stage.output))
        } else {
          add(i, true, front(stage.input), front(stage.output))
        }
        break
      case 'entry': {
        const { left, right } = stack.entry
        const back = stage.direction === 'backward'
        const [from, to] = back ? [left, right] : [right, left]
        add(i, back, contactPoint(from, m(stage.input)), contactPoint(to, m(stage.output)))
        break
      }
      case 'rotor': {
        const { left, right } = stack.slots[stage.slot]
        const back = stage.direction === 'backward'
        const [from, to] = back ? [left, right] : [right, left]
        add(i, back, contactPoint(from, m(stage.input)), contactPoint(to, m(stage.output)))
        break
      }
      case 'reflector': {
        const { right, inner } = stack.reflector
        add(
          i,
          false,
          contactPoint(right, m(stage.input)),
          contactPoint(inner, m(stage.input)),
          contactPoint(inner, m(stage.output)),
          contactPoint(right, m(stage.output)),
        )
        break
      }
    }
  })
  const [lx, , lz] = lampAt(trace.output)
  add('lamp', true, [lx, UNDER_DECK, lz], [lx, 0.03, lz])
  return segments
}

/** The glowing path of the last key press, revealed stage by stage in step mode. */
export function SignalPath3D() {
  const trace = useMachine((s) => s.lastTrace)
  const config = useMachine((s) => s.config)
  const xray = useTeaching((s) => s.xray)
  const stepMode = useTeaching((s) => s.stepMode)
  const cursor = useTeaching((s) => s.cursor)

  const segments = useMemo(() => (trace ? buildPath(trace, config) : []), [trace, config])
  const shown = trace
    ? reveal(stepMode ? cursor : Number.MAX_SAFE_INTEGER, trace.stages.length)
    : null
  const visible =
    xray && shown
      ? segments.filter((s) => (s.stage === 'lamp' ? shown.lamp : s.stage < shown.stages))
      : []
  const focus = stepMode ? shown?.focus : null
  const head = stepMode ? visible.at(-1)?.points.at(-1) : undefined

  useEffect(() => {
    pathInfo.segments = visible.length
    pathInfo.focus = focus === null || focus === undefined ? null : String(focus)
  }, [visible.length, focus])

  return (
    <group renderOrder={10}>
      {visible.map((s, i) => (
        <Line
          key={i}
          points={s.points}
          color={s.back ? BACKWARD : FORWARD}
          lineWidth={stepMode && s.stage === focus ? 5 : 3}
          depthTest={false}
          transparent
          toneMapped={false}
        />
      ))}
      {head && <Spark position={head} />}
    </group>
  )
}

/** Bright dot at the head of the path in step mode (static: a pulse would force constant redraws). */
function Spark({ position }: { position: Point }) {
  return (
    <mesh position={position} renderOrder={11}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshBasicMaterial color={[4, 4, 4]} depthTest={false} toneMapped={false} />
    </mesh>
  )
}
