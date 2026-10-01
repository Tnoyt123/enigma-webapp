import { useMemo } from 'react'
import {
  ALPHABET,
  mod26,
  REFLECTORS,
  ROTORS,
  toIndex,
  type MachineConfig,
  type Trace,
} from '../engine/index.ts'
import { useMachine } from '../state/machineStore.ts'
import { useTeaching } from '../state/teachingStore.ts'
import { reveal, slotNames } from '../teaching/explain.ts'

const ROW = 11
const TOP = 34
const HEIGHT = TOP + 26 * ROW + 8
const GAP = 12
const FORWARD = '#fbbf24'
const BACKWARD = '#38bdf8'
/** The return leg runs a little below the outward one so the two stay distinguishable. */
const RETURN_OFFSET = 2.5

type Column =
  | { kind: 'reflector'; x0: number; x1: number }
  | { kind: 'rotor'; slot: number; x0: number; x1: number }
  | { kind: 'entry'; x0: number; x1: number }
  | { kind: 'plugboard'; x0: number; x1: number }
  | { kind: 'io'; x0: number; x1: number }

const y = (letter: number, back = false) =>
  TOP + letter * ROW + ROW / 2 + (back ? RETURN_OFFSET : 0)

function layout(slots: number): { columns: Column[]; width: number } {
  const columns: Column[] = []
  let x = 6
  const add = (width: number, make: (x0: number, x1: number) => Column) => {
    columns.push(make(x, x + width))
    x += width + GAP
  }
  add(30, (x0, x1) => ({ kind: 'reflector', x0, x1 }))
  for (let slot = 0; slot < slots; slot++) add(50, (x0, x1) => ({ kind: 'rotor', slot, x0, x1 }))
  add(18, (x0, x1) => ({ kind: 'entry', x0, x1 }))
  add(40, (x0, x1) => ({ kind: 'plugboard', x0, x1 }))
  add(24, (x0, x1) => ({ kind: 'io', x0, x1 }))
  return { columns, width: x - GAP + 6 }
}

/** For each machine-frame contact on a rotor's right side, the contact it reaches on its left side. */
function rotorMap(config: MachineConfig, slot: number, position: number): number[] {
  const wiring = [...ROTORS[config.rotors[slot]].wiring].map(toIndex)
  const offset = position - config.rings[slot]
  return Array.from({ length: 26 }, (_, m) => mod26(wiring[mod26(m + offset)] - offset))
}

interface Segment {
  readonly stage: number | 'lamp'
  readonly back: boolean
  readonly d: string
  readonly end: [number, number]
}

/** The path of the current as SVG segments, one or more per trace stage, in order. */
function pathSegments(trace: Trace, columns: Column[]): Segment[] {
  const col = (kind: Column['kind'], slot?: number) =>
    columns.find(
      (c) => c.kind === kind && (slot === undefined || ('slot' in c && c.slot === slot)),
    )!
  const io = col('io')
  let at: [number, number] = [io.x0, y(toIndex(trace.input))]
  const segments: Segment[] = []
  const push = (stage: number | 'lamp', back: boolean, d: string, end: [number, number]) => {
    segments.push({ stage, back, d: `M${at[0]} ${at[1]} ${d}`, end })
    at = end
  }

  trace.stages.forEach((stage, i) => {
    const back = stage.component === 'reflector' ? false : stage.direction === 'backward'
    const yin = y(toIndex(stage.input), back)
    if (stage.component === 'reflector') {
      const c = col('reflector')
      const yout = y(toIndex(stage.output), true)
      const bend = c.x0 + 4
      push(i, false, `L${c.x1} ${yin} C${bend} ${yin} ${bend} ${yout} ${c.x1} ${yout}`, [
        c.x1,
        yout,
      ])
      return
    }
    const c = col(stage.component, stage.component === 'rotor' ? stage.slot : undefined)
    const yout = y(toIndex(stage.output), back)
    const [from, to] = back ? [c.x0, c.x1] : [c.x1, c.x0]
    push(i, back, `L${from} ${yin} L${to} ${yout}`, [to, yout])
  })
  push('lamp', true, `L${io.x0} ${y(toIndex(trace.output), true)}`, [
    io.x0 + 8,
    y(toIndex(trace.output), true),
  ])
  return segments
}

/** The inside of the machine as a wiring diagram, with the current's path drawn through it. */
export function XrayDiagram() {
  const config = useMachine((s) => s.config)
  const positions = useMachine((s) => s.positions)
  const trace = useMachine((s) => s.lastTrace)
  const stepMode = useTeaching((s) => s.stepMode)
  const cursor = useTeaching((s) => s.cursor)

  const { columns, width } = useMemo(() => layout(config.rotors.length), [config.rotors.length])
  const names = slotNames(config.rotors.length)
  // Draw the wiring as it was when the current flowed (identical unless nothing has been pressed).
  const wiringPositions = trace ? [...trace.positionsAfter].map(toIndex) : positions
  const segments = useMemo(() => (trace ? pathSegments(trace, columns) : []), [trace, columns])
  const shown = trace
    ? reveal(stepMode ? cursor : Number.MAX_SAFE_INTEGER, trace.stages.length)
    : null
  const visible = segments.filter((s) =>
    s.stage === 'lamp' ? shown?.lamp : shown && s.stage < shown.stages,
  )
  const focusStage = stepMode ? shown?.focus : null
  const head = stepMode ? visible.at(-1) : undefined

  const focusColumn = (c: Column) => {
    if (focusStage === undefined || focusStage === null || !trace) return false
    if (focusStage === 'lamp') return c.kind === 'io'
    if (focusStage === 'press') return c.kind === 'rotor' && trace.stepped[c.slot]
    const stage = trace.stages[focusStage]
    if (stage.component === 'rotor') return c.kind === 'rotor' && c.slot === stage.slot
    return c.kind === stage.component
  }

  return (
    <figure className="flex flex-col gap-2">
      {/* Scrolls sideways on narrow screens, so it must be reachable by keyboard. */}
      <div
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-amber-300"
        tabIndex={0}
        role="region"
        aria-label="X-ray wiring diagram"
      >
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="w-full min-w-[30rem]"
          aria-hidden="true"
          data-testid="xray-diagram"
          fontFamily="ui-monospace, monospace"
        >
          {columns.map((c, i) => (
            <g key={i}>
              <rect
                x={c.x0 - 3}
                y={TOP - 4}
                width={c.x1 - c.x0 + 6}
                height={26 * ROW + 8}
                rx={4}
                fill={focusColumn(c) ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.04)'}
                stroke={focusColumn(c) ? FORWARD : 'none'}
              />
              <ColumnHeader column={c} config={config} names={names} positions={wiringPositions} />
              <ColumnWiring column={c} config={config} positions={wiringPositions} />
            </g>
          ))}
          {visible.map((s, i) => (
            <path
              key={i}
              data-path-segment={s.stage}
              d={s.d}
              fill="none"
              stroke={s.back ? BACKWARD : FORWARD}
              strokeWidth={stepMode && s.stage === focusStage ? 2.6 : 1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {trace && (
            <rect
              x={columns.at(-1)!.x0 + 2}
              y={y(toIndex(trace.input)) - 4}
              width={8}
              height={8}
              fill="none"
              stroke={FORWARD}
              strokeWidth={1.2}
            />
          )}
          {trace && shown?.lamp && (
            <circle
              cx={columns.at(-1)!.x0 + 6}
              cy={y(toIndex(trace.output))}
              r={4.5}
              fill={FORWARD}
              opacity={0.9}
            />
          )}
          {head && (
            <circle cx={head.end[0]} cy={head.end[1]} r={3.2} fill="#fff">
              <animate attributeName="r" values="2.6;4;2.6" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
      </div>
      <figcaption className="text-xs text-stone-300">
        Inside the machine. Each column is a part of the circuit, and each row a contact A–Z. The
        current goes out through the rotors (amber) and back by a different path (blue). The steps
        are listed under “How it works”.
      </figcaption>
    </figure>
  )
}

function ColumnHeader({
  column,
  config,
  names,
  positions,
}: {
  column: Column
  config: MachineConfig
  names: string[]
  positions: readonly number[]
}) {
  const cx = (column.x0 + column.x1) / 2
  const [top, bottom] =
    column.kind === 'reflector'
      ? ['UKW', REFLECTORS[config.reflector].name.replace('UKW-', '')]
      : column.kind === 'rotor'
        ? [
            config.rotors[column.slot],
            `${names[column.slot]} · ${ALPHABET[positions[column.slot]]}`,
          ]
        : column.kind === 'entry'
          ? ['ETW', '']
          : column.kind === 'plugboard'
            ? ['Plugs', '']
            : ['Key', 'Lamp']
  return (
    <>
      <text x={cx} y={12} textAnchor="middle" fontSize={9} fill="#e7e5e4" fontWeight="bold">
        {top}
      </text>
      <text x={cx} y={23} textAnchor="middle" fontSize={7} fill="#a8a29e">
        {bottom}
      </text>
    </>
  )
}

function ColumnWiring({
  column,
  config,
  positions,
}: {
  column: Column
  config: MachineConfig
  positions: readonly number[]
}) {
  const faint = { stroke: '#57534e', strokeWidth: 0.6, fill: 'none' }
  switch (column.kind) {
    case 'rotor': {
      const map = rotorMap(config, column.slot, positions[column.slot])
      return (
        <g {...faint}>
          {map.map((out, m) => (
            <line key={m} x1={column.x1} y1={y(m)} x2={column.x0} y2={y(out)} />
          ))}
        </g>
      )
    }
    case 'reflector': {
      const wiring = [...REFLECTORS[config.reflector].wiring].map(toIndex)
      const bend = column.x0 + 4
      return (
        <g {...faint}>
          {wiring.map((b, a) =>
            a < b ? (
              <path
                key={a}
                d={`M${column.x1} ${y(a)} C${bend} ${y(a)} ${bend} ${y(b)} ${column.x1} ${y(b)}`}
              />
            ) : null,
          )}
        </g>
      )
    }
    case 'plugboard': {
      const partner = (m: number) => {
        const pair = config.plugboard.find((p) => p.includes(ALPHABET[m]))
        return pair ? toIndex(pair.replace(ALPHABET[m], '')) : m
      }
      return (
        <g {...faint}>
          {Array.from({ length: 26 }, (_, m) => (
            <line key={m} x1={column.x1} y1={y(m)} x2={column.x0} y2={y(partner(m))} />
          ))}
        </g>
      )
    }
    case 'entry':
      return (
        <g {...faint}>
          {Array.from({ length: 26 }, (_, m) => (
            <line key={m} x1={column.x1} y1={y(m)} x2={column.x0} y2={y(m)} />
          ))}
        </g>
      )
    case 'io':
      return (
        <g>
          {[...ALPHABET].map((letter, m) => (
            <text
              key={letter}
              x={column.x1 - 2}
              y={y(m) + 3}
              textAnchor="end"
              fontSize={8}
              fill="#d6d3d1"
            >
              {letter}
            </text>
          ))}
        </g>
      )
  }
}
