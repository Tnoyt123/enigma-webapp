import { useCursor } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExtrudeGeometry, Path, Shape, type Group } from 'three'
import { ROTORS } from '../engine/index.ts'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { useTeaching } from '../state/teachingStore.ts'
import { announce } from '../ui2d/announce.ts'
import { CASE, HATCH, ROTOR, rotorStack } from './layout3d.ts'
import { settle, useSettlingFrame } from './motion.ts'
import { xrayProps } from './xray.ts'

const CRINKLE = '#1f1c19'
const STEP = (Math.PI * 2) / 26
const METAL = { color: '#9a958e', metalness: 0.85, roughness: 0.35 } as const

/** Depth of the hatch, from the hinge to its front edge. */
const LENGTH = HATCH.frontZ - HATCH.hingeZ
/** Distance forward from the hinge of a world z. */
const fromHinge = (z: number) => z - HATCH.hingeZ

/**
 * The hatch over the rotors: the back of the top deck, flush with the rest when closed.
 * Opening the lid swings it up on its back edge to uncover the rotor well; closed, it shows
 * each rotor's letter through a window and lets its thumbwheel stand through a slot.
 */
export function Hatch3D() {
  const lidOpen = useMachine((s) => s.lidOpen)
  const thin = useMachine((s) => s.config.rotors.map((id) => ROTORS[id].thin).join())
  const xray = useTeaching((s) => s.xray)
  const top = useMemo(() => topPlate(thin.split(',').map((t) => t === 'true')), [thin])
  useEffect(() => () => top.dispose(), [top])

  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const [startAngle] = useState(lidOpen ? HATCH.openAngle : 0)
  const hinge = useRef<Group>(null)
  useSettlingFrame(
    (dt) => {
      if (!hinge.current) return false
      const target = lidOpen ? HATCH.openAngle : 0
      const { value, moving } = settle(hinge.current.rotation.x, target, 3.5, dt)
      hinge.current.rotation.x = value
      return moving
    },
    [lidOpen],
  )

  return (
    <group name="hatch">
      {/* Piano hinge along the back of the deck. */}
      <mesh position={[0, 0, HATCH.hingeZ]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.035, 0.035, HATCH.halfWidth * 2 - 0.6, 12]} />
        <meshStandardMaterial {...METAL} {...xrayProps(xray, 0.3)} />
      </mesh>
      {/* Steel trim along the deck where the hatch closes, marking its front edge. */}
      <mesh position={[0, 0.004, HATCH.frontZ + 0.03]}>
        <boxGeometry args={[CASE.right - CASE.left - 0.56, 0.008, 0.06]} />
        <meshStandardMaterial {...METAL} {...xrayProps(xray, 0.3)} />
      </mesh>
      <group ref={hinge} name="hatch-lid" position={[0, 0, HATCH.hingeZ]} rotation-x={startAngle}>
        {/* The plate, extruded downward from the deck surface. */}
        <mesh geometry={top} rotation-x={Math.PI / 2}>
          <meshStandardMaterial color={CRINKLE} roughness={0.95} {...xrayProps(xray, 0.25)} />
        </mesh>
        {/* Finger pull: a metal tongue overhanging the front edge, so it shows from the
            operator's side whether the hatch is closed or standing open. Clicking it opens or
            closes the hatch. */}
        <mesh position={[0, 0.018, LENGTH + 0.01]}>
          <boxGeometry args={[0.9, 0.02, 0.26]} />
          <meshStandardMaterial
            {...METAL}
            emissive="#ffd166"
            emissiveIntensity={hovered ? 0.25 : 0}
            {...xrayProps(xray, 0.3)}
          />
        </mesh>
        <mesh
          name="hatch-pull"
          visible={false} // a hit target only, roomier than the pull itself
          position={[0, 0.05, LENGTH]}
          onClick={(e) => {
            e.stopPropagation()
            announce(machineStore.getState().setLidOpen(!machineStore.getState().lidOpen))
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[1.3, 0.3, 0.55]} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * The hatch plate, in the hinge's frame: x across, y forward from the hinge. Over each rotor it
 * has one opening: a slot for the thumbwheel joined to the letter window beside it.
 */
function topPlate(thin: readonly boolean[]) {
  const outline = new Shape()
    .moveTo(-HATCH.halfWidth, 0)
    .lineTo(HATCH.halfWidth, 0)
    .lineTo(HATCH.halfWidth, LENGTH)
    .lineTo(-HATCH.halfWidth, LENGTH)
    .closePath()

  // Where the plate's underside cuts the thumbwheel: the slot must clear it.
  const rise = -HATCH.thickness - ROTOR.y
  const halfChord = Math.sqrt(ROTOR.wheelRadius ** 2 - rise ** 2) + 0.06
  const wheelFrom = fromHinge(ROTOR.z - halfChord)
  const wheelTo = fromHinge(ROTOR.z + halfChord)
  // The window: where the line of sight to the reading letter (along the reading direction, as
  // the operator looks) passes through the plate, just big enough for that one letter and the
  // brass frame round it, so the letters either side stay hidden.
  const up = Math.sin(ROTOR.readingAngle)
  const toward = Math.cos(ROTOR.readingAngle)
  const letterY = ROTOR.y + ROTOR.radius * up
  const letterZ = ROTOR.z + ROTOR.radius * toward
  const windowZ = letterZ + ((-HATCH.thickness / 2 - letterY) / up) * toward
  const frameHalf = (STEP * ROTOR.radius * 1.15 + 0.035) / 2
  const windowHalf = frameHalf / up
  const windowFrom = fromHinge(windowZ - windowHalf)
  const windowTo = fromHinge(windowZ + windowHalf)

  for (const { x, ringWidth } of rotorStack(thin).slots) {
    const ringLeft = x - ringWidth / 2
    const slotLeft = ringLeft - ROTOR.wheelWidth - 0.05
    const windowLeft = ringLeft - 0.06
    const windowRight = x + ringWidth / 2 + 0.06
    outline.holes.push(
      new Path()
        .moveTo(slotLeft, wheelFrom)
        .lineTo(ringLeft, wheelFrom)
        .lineTo(ringLeft, windowFrom)
        .lineTo(windowRight, windowFrom)
        .lineTo(windowRight, windowTo)
        .lineTo(windowLeft, windowTo)
        .lineTo(windowLeft, wheelTo)
        .lineTo(slotLeft, wheelTo)
        .closePath(),
    )
  }
  return new ExtrudeGeometry(outline, { depth: HATCH.thickness, bevelEnabled: false })
}
