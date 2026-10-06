import { CameraControls } from '@react-three/drei'
import { Bloom, EffectComposer, Outline, Selection } from '@react-three/postprocessing'
import { useStore } from 'zustand'
import { fitsSlot, machineStore } from '../state/machineStore.ts'
import { carryStore } from './carry.ts'
import { Case } from './Case.tsx'
import { registerControls } from './controls.ts'
import { E2EHooks } from './E2EHooks.tsx'
import { Hatch3D } from './Hatch3D.tsx'
import { Keys3D } from './Keys3D.tsx'
import { useFrameClock } from './motion.ts'
import { Lamps3D } from './Lamps3D.tsx'
import { Plugboard3D } from './Plugboard3D.tsx'
import { QUALITY } from './quality.ts'
import { Rotors3D } from './Rotors3D.tsx'
import { SignalPath3D } from './SignalPath3D.tsx'
import { StudioLighting } from './StudioLighting.tsx'
import { XrayRefresh } from './XrayRefresh.tsx'

export function Scene() {
  useFrameClock()
  return (
    // Selection collects the objects wrapped in <Select enabled> for the Outline effect.
    <Selection>
      <color attach="background" args={['#0c0a09']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 12, 8]} intensity={1.6} />
      <directionalLight position={[-6, 4, 10]} intensity={0.5} />
      <StudioLighting />

      <Case />
      <Rotors3D />
      <Hatch3D />
      <Lamps3D />
      <Keys3D />
      <Plugboard3D />
      <SignalPath3D />
      <XrayRefresh />

      <CameraControls
        ref={registerControls}
        makeDefault
        minDistance={4}
        maxDistance={30}
        maxPolarAngle={Math.PI * 0.62}
      />
      {/* autoClear off: required by Outline. */}
      <EffectComposer multisampling={QUALITY.multisampling} autoClear={false}>
        <Bloom luminanceThreshold={1} intensity={1.1} mipmapBlur />
        <DropOutline />
      </EffectComposer>
      <E2EHooks />
    </Selection>
  )
}

const FITS = '#facc15'
const REFUSED = '#ef4444'

/** Silhouette outline of the selected drop-target phantom: yellow if the rotor fits, red if not. */
function DropOutline() {
  const target = useStore(carryStore, (s) => s.target)
  const hand = useStore(machineStore, (s) => s.hand)
  const config = useStore(machineStore, (s) => s.config)
  const fits = !hand || target === null || target === 'box' || fitsSlot(config, hand.rotor, target)
  const color = fits ? FITS : REFUSED
  return (
    <Outline
      visibleEdgeColor={color}
      hiddenEdgeColor={color}
      // Outline the whole silhouette, even where the machine hides part of it.
      xRay
      edgeStrength={6}
      blur
    />
  )
}
