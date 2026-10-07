import { useCursor } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { BufferGeometry, Float32BufferAttribute, type Group } from 'three'
import { mod26, ROTORS, toIndex, type RotorId } from '../engine/index.ts'
import { boxRotors, machineStore, useMachine } from '../state/machineStore.ts'
import { useTeaching } from '../state/teachingStore.ts'
import { reveal } from '../teaching/explain.ts'
import { announce } from '../ui2d/announce.ts'
import { trackPointer } from '../ui2d/dragging.ts'
import { carryStore, hoverTarget, useCarry, type DropTarget } from './carry.ts'
import { gesture, rotorDropped, setOrbitEnabled } from './controls.ts'
import {
  angleFor,
  boxRotorX,
  LIFT,
  ROTOR,
  ROTOR_BOX,
  ringPoint,
  rotorStack,
  CONTACT_RADIUS,
} from './layout3d.ts'
import { settle, shortestAngle, useSettlingFrame } from './motion.ts'
import { alphabetRingTexture, knurlTexture, labelTexture } from './textures.ts'
import { xrayProps } from './xray.ts'

const STEP = (Math.PI * 2) / 26
const METAL = { color: '#9a958e', metalness: 0.85, roughness: 0.35 } as const
const say = (text: string | null) => text && announce(text)
const store = () => machineStore.getState()

export function Rotors3D() {
  const rotors = useMachine((s) => s.config.rotors)
  const rings = useMachine((s) => s.config.rings)
  const positions = useMachine((s) => s.positions)
  const trace = useMachine((s) => s.lastTrace)
  const lidOpen = useMachine((s) => s.lidOpen)
  const hand = useMachine((s) => s.hand)
  const ringSlot = useMachine((s) => s.ringSlot)
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
    <>
      <group position={[0, ROTOR.y, ROTOR.z]}>
        {rotors.map((id, slot) => (
          <SlotRotor
            key={`${slot}:${id}`}
            slot={slot}
            rotor={id}
            ring={rings[slot]}
            x={stack.slots[slot].x}
            ringWidth={stack.slots[slot].ringWidth}
            position={positions[slot]}
            xray={xray}
            glow={glow(slot)}
            lidOpen={lidOpen}
            lifted={hand?.from === slot || ringSlot === slot}
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
          <cylinderGeometry
            args={[ROTOR.radius * 0.9, ROTOR.radius * 0.9, stack.entry.width, 40]}
          />
          <meshStandardMaterial {...METAL} {...xrayProps(xray, 0.25)} />
        </mesh>
        {/* Axle. */}
        <mesh rotation-z={-Math.PI / 2}>
          <cylinderGeometry args={[0.08, 0.08, stack.entry.x - stack.reflector.x + 0.6, 12]} />
          <meshStandardMaterial {...METAL} {...xrayProps(xray, 0.4)} />
        </mesh>
      </group>
      {lidOpen && <RotorBox3D />}
      <CarriedRotor />
      {lidOpen && <DropPhantom />}
    </>
  )
}

/**
 * Rises smoothly while `lifted` (out of its slot, or held up for the ring close-up). With
 * `dropIn`, it starts at lift height and settles: a rotor that has just been put down.
 */
function Lift({
  lifted,
  dropIn = false,
  children,
}: {
  lifted: boolean
  dropIn?: boolean
  children: ReactNode
}) {
  const [startY] = useState(dropIn ? LIFT : 0)
  const group = useRef<Group>(null)
  useSettlingFrame(
    (dt) => {
      if (!group.current) return false
      const { value, moving } = settle(group.current.position.y, lifted ? LIFT : 0, 10, dt)
      group.current.position.y = value
      return moving
    },
    [lifted],
  )
  return (
    <group ref={group} position-y={startY}>
      {children}
    </group>
  )
}

function SlotRotor({
  slot,
  rotor,
  ring,
  x,
  ringWidth,
  position,
  xray,
  glow,
  lidOpen,
  lifted,
}: {
  slot: number
  rotor: RotorId
  ring: number
  x: number
  ringWidth: number
  position: number
  xray: boolean
  glow: 'step' | 'double' | null
  lidOpen: boolean
  lifted: boolean
}) {
  const carry = useCarry()
  // While it's being carried, the rotor follows the pointer instead of hovering over its slot.
  const carried = useStore(
    carryStore,
    (s) => s.carried !== null && lifted && s.carried.rotor === rotor,
  )
  // A rotor that arrives while the lid is open (put down, or swapped in) settles into place.
  const [dropIn] = useState(lidOpen)
  const spin = useRef<Group>(null)
  const angle = useRef(angleFor(position))
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useSettlingFrame(
    (dt) => {
      const target = angle.current + shortestAngle(angleFor(position) - angle.current)
      const { value, moving } = settle(angle.current, target, 18, dt, 1e-4)
      angle.current = value
      if (spin.current) spin.current.rotation.x = value
      return moving
    },
    [position],
  )

  const turn = (delta: number) => store().setPosition(slot, mod26(store().positions[slot] + delta))

  /** Thumbwheel: click to turn forward (Shift: back), drag up or down to turn several letters. */
  const onWheelPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || lidOpen) return
    e.stopPropagation()
    setOrbitEnabled(false)
    const start = store().positions[slot]
    const shift = e.nativeEvent.shiftKey
    trackPointer(e.nativeEvent, {
      onMove: (ev, dragged) => {
        if (dragged)
          store().setPosition(
            slot,
            mod26(start + Math.trunc((e.nativeEvent.clientY - ev.clientY) / 14)),
          )
      },
      onUp: (_, dragged) => {
        if (!dragged) turn(shift ? -1 : 1)
      },
    })
  }

  const hover = (on: boolean) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(on)
    gesture.overThumbwheel = on && !lidOpen
    // Over a thumbwheel, the scroll wheel turns it instead of zooming the camera.
    if (!gesture.rotorDrag) setOrbitEnabled(!on)
  }

  return (
    <group position={[x, 0, 0]}>
      <Lift lifted={lifted} dropIn={dropIn}>
        <group ref={spin} visible={!carried}>
          <RotorBody
            rotor={rotor}
            ring={ring}
            ringWidth={ringWidth}
            xray={xray}
            name={`ring-${slot}`}
          />
          <mesh
            name={`thumbwheel-${slot}`}
            position={[-(ringWidth + ROTOR.wheelWidth) / 2, 0, 0]}
            rotation-z={-Math.PI / 2}
            onPointerDown={onWheelPointerDown}
            onWheel={(e) => {
              if (lidOpen) return
              e.stopPropagation()
              turn(e.deltaY < 0 ? 1 : -1)
            }}
            onContextMenu={(e) => {
              e.stopPropagation()
              e.nativeEvent.preventDefault()
              if (!lidOpen) turn(-1)
            }}
            onPointerOver={hover(true)}
            onPointerOut={hover(false)}
          >
            <cylinderGeometry args={[ROTOR.wheelRadius, ROTOR.wheelRadius, ROTOR.wheelWidth, 64]} />
            <meshStandardMaterial
              attach="material-0"
              map={knurlTexture()}
              roughness={0.7}
              {...xrayProps(xray, 0.3)}
            />
            <meshStandardMaterial attach="material-1" color="#24211e" {...xrayProps(xray, 0.2)} />
            <meshStandardMaterial attach="material-2" color="#24211e" {...xrayProps(xray, 0.2)} />
          </mesh>
        </group>
        {lidOpen && !carried && <Label text={rotor} y={ROTOR.wheelRadius + 0.45} />}
        {/* Marks the top of the thumbwheel, the part standing through the closed hatch, for
            browser tests to aim at. Drawn and hit-tested by nothing. */}
        <mesh
          name={`thumbwheel-grip-${slot}`}
          visible={false}
          position={[-(ringWidth + ROTOR.wheelWidth) / 2, ROTOR.wheelRadius - 0.05, 0]}
        >
          <boxGeometry args={[0.01, 0.01, 0.01]} />
        </mesh>
      </Lift>
      {!lifted && <WindowFrame width={ringWidth} glow={glow} />}
      {lidOpen && (
        // With the lid open, the whole slot is a pick-up / drop target.
        <mesh
          name={`rotor-slot-${slot}`}
          visible={false} // a hit target only: hit-tested but not drawn
          position={[-ROTOR.wheelWidth / 2, lifted ? LIFT / 2 : 0, 0]}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            if (store().hand) {
              e.stopPropagation()
              return say(store().placeRotor(slot))
            }
            say(store().liftRotor(slot))
            carry(e, rotor, ring)
          }}
          onPointerUp={(e) => {
            const { hand } = store()
            if (!rotorDropped(e.nativeEvent) || !hand || hand.from === slot) return
            e.stopPropagation()
            say(store().placeRotor(slot))
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            // With a rotor in hand, this slot becomes the drop target (outlined).
            if (store().hand) hoverTarget(slot, true)
          }}
          onPointerOut={() => {
            setHovered(false)
            hoverTarget(slot, false)
          }}
        >
          <boxGeometry
            args={[ringWidth + ROTOR.wheelWidth + 0.1, 2.4 + (lifted ? LIFT : 0), 2.4]}
          />
        </mesh>
      )}
    </group>
  )
}

/** Alphabet ring, core and (in x-ray) the 26 wires, in the rotor's own spinning frame. */
function RotorBody({
  rotor,
  ring,
  ringWidth,
  xray,
  name,
}: {
  rotor: RotorId
  ring: number
  ringWidth: number
  xray: boolean
  name?: string
}) {
  const left = -ringWidth / 2 - ROTOR.wheelWidth
  const coreFace = (ringWidth + 0.02) / 2

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

  return (
    <>
      <mesh name={name} rotation-z={-Math.PI / 2}>
        <cylinderGeometry args={[ROTOR.radius, ROTOR.radius, ringWidth, 52, 1, true]} />
        <meshStandardMaterial
          map={alphabetRingTexture()}
          roughness={0.5}
          {...xrayProps(xray, 0.45)}
        />
      </mesh>
      <mesh rotation-z={-Math.PI / 2}>
        <cylinderGeometry args={[ROTOR.radius * 0.96, ROTOR.radius * 0.96, ringWidth + 0.02, 40]} />
        <meshStandardMaterial color="#2b2825" roughness={0.6} {...xrayProps(xray, 0.12)} />
      </mesh>
      {/* Red dot on the core's face marking wiring contact A: it sits under the ring-setting letter. */}
      <mesh position={ringPoint(coreFace + 0.006, ring)} rotation-y={Math.PI / 2}>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color="#dc2626" />
      </mesh>
      {xray && (
        <lineSegments geometry={wiring}>
          <lineBasicMaterial color="#a8a29e" transparent opacity={0.35} />
        </lineSegments>
      )}
      {/* Contact ring on the core face. */}
      <mesh position={[coreFace + 0.004, 0, 0]} rotation-y={Math.PI / 2}>
        <ringGeometry args={[CONTACT_RADIUS - 0.04, CONTACT_RADIUS + 0.04, 40]} />
        <meshStandardMaterial
          color="#8a8580"
          metalness={0.8}
          roughness={0.4}
          {...xrayProps(xray, 0.3)}
        />
      </mesh>
    </>
  )
}

/** Small label plate facing the camera from above, e.g. a rotor's numeral. */
function Label({ text, y }: { text: string; y: number }) {
  return (
    <mesh position={[0, y, 0]} rotation-x={-Math.PI / 5}>
      <planeGeometry args={[0.75, 0.28]} />
      <meshBasicMaterial map={labelTexture(text)} />
    </mesh>
  )
}

/** The wooden box of spare rotors beside the machine, shown while the lid is open. */
function RotorBox3D() {
  const config = useMachine((s) => s.config)
  const hand = useMachine((s) => s.hand)
  const boxRings = useMachine((s) => s.boxRings)
  const xray = useTeaching((s) => s.xray)
  const spares = boxRotors(config)
  const carry = useCarry()
  const carriedRotor = useStore(carryStore, (s) => s.carried?.rotor)
  // Rotors already in the box when the lid opens don't drop in; ones returned later do.
  const [initial] = useState(() => new Set(spares))
  const width = ROTOR_BOX.right - ROTOR_BOX.left
  const cx = (ROTOR_BOX.left + ROTOR_BOX.right) / 2

  return (
    <group position={[0, ROTOR_BOX.y, ROTOR_BOX.z]}>
      {/* The box, open at the top, and its drop target. */}
      <mesh position={[cx, -0.75, 0]}>
        <boxGeometry args={[width, 0.9, 2.6]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.7} />
      </mesh>
      <mesh
        name="rotor-box"
        visible={false}
        position={[cx, 0.4, 0]}
        onPointerOver={() => store().hand && hoverTarget('box', true)}
        onPointerOut={() => hoverTarget('box', false)}
        onPointerUp={(e) => {
          // A click on a rotor in the box keeps holding it; dropping one here puts it back.
          if (!rotorDropped(e.nativeEvent) || !store().hand) return
          e.stopPropagation()
          say(store().returnRotor())
        }}
      >
        <boxGeometry args={[width, 3, 2.8]} />
      </mesh>
      {spares.map((rotor, i) => (
        <group key={rotor} position={[boxRotorX(i), 0, 0]}>
          <Lift lifted={hand?.from === 'box' && hand.rotor === rotor} dropIn={!initial.has(rotor)}>
            <group rotation-x={angleFor(0)} visible={carriedRotor !== rotor}>
              <RotorBody
                rotor={rotor}
                ring={boxRings[rotor] ?? 0}
                ringWidth={ROTORS[rotor].thin ? ROTOR.ringWidth * 0.7 : ROTOR.ringWidth}
                xray={xray}
              />
            </group>
            {carriedRotor !== rotor && <Label text={rotor} y={ROTOR.radius + 0.45} />}
            <mesh
              name={`box-rotor-${rotor}`}
              visible={false}
              // Hit shape matches the rotor, so a neighbour's hit area never covers it.
              rotation-z={-Math.PI / 2}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                if (store().hand) store().returnRotor()
                say(store().liftRotor('box', rotor))
                carry(e, rotor, boxRings[rotor] ?? 0)
              }}
            >
              <cylinderGeometry
                args={[
                  ROTOR.radius,
                  ROTOR.radius,
                  ROTORS[rotor].thin ? ROTOR.ringWidth * 0.7 : ROTOR.ringWidth,
                  24,
                ]}
              />
            </mesh>
          </Lift>
        </group>
      ))}
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

/** The rotor being dragged, following the pointer over the rotor bay. It has no handlers, so
 * pointer hit tests pass straight through it to the slot or box beneath. */
function CarriedRotor() {
  const carried = useStore(carryStore, (s) => s.carried)
  const xray = useTeaching((s) => s.xray)
  if (!carried) return null
  const thin = ROTORS[carried.rotor].thin
  return (
    <group name="carried-rotor" position={carried.point}>
      <group rotation-x={angleFor(0)}>
        <RotorBody
          rotor={carried.rotor}
          ring={carried.ring}
          ringWidth={thin ? ROTOR.ringWidth * 0.7 : ROTOR.ringWidth}
          xray={xray}
        />
      </group>
      <Label text={carried.rotor} y={ROTOR.radius + 0.45} />
    </group>
  )
}

/**
 * An invisible copy of the held rotor exactly where it would land if put down now. Only its
 * silhouette is drawn, by the Outline effect: over a slot, at that slot's seat; over the box, back
 * where it came from (a rotor from the machine can't stay in the box, so it returns to its slot).
 */
function DropPhantom() {
  const target = useStore(carryStore, (s) => s.target)
  const hand = useMachine((s) => s.hand)
  const config = useMachine((s) => s.config)
  if (!hand || target === null) return null

  const destination: DropTarget = target === 'box' ? hand.from : target
  const thin = ROTORS[hand.rotor].thin
  const ringWidth = thin ? ROTOR.ringWidth * 0.7 : ROTOR.ringWidth
  let position: [number, number, number]
  let withWheel = true
  if (destination === 'box') {
    const index = boxRotors(config).indexOf(hand.rotor)
    position = [boxRotorX(index), ROTOR_BOX.y, ROTOR_BOX.z]
    withWheel = false // spares in the box are drawn without thumbwheels
  } else {
    const stack = rotorStack(config.rotors.map((id) => ROTORS[id].thin))
    position = [stack.slots[destination].x, ROTOR.y, ROTOR.z]
  }

  return (
    <Select enabled>
      <group position={position} name="drop-phantom">
        <mesh rotation-z={-Math.PI / 2}>
          <cylinderGeometry args={[ROTOR.radius, ROTOR.radius, ringWidth, 48]} />
          <PhantomMaterial />
        </mesh>
        {withWheel && (
          <mesh position={[-(ringWidth + ROTOR.wheelWidth) / 2, 0, 0]} rotation-z={-Math.PI / 2}>
            <cylinderGeometry args={[ROTOR.wheelRadius, ROTOR.wheelRadius, ROTOR.wheelWidth, 48]} />
            <PhantomMaterial />
          </mesh>
        )}
      </group>
    </Select>
  )
}

/** Draws nothing itself: the phantom exists only to be outlined. */
function PhantomMaterial() {
  return <meshBasicMaterial colorWrite={false} depthWrite={false} />
}
