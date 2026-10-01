import { CameraControls, Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Case } from './Case.tsx'
import { registerControls } from './controls.ts'
import { E2EHooks } from './E2EHooks.tsx'
import { Keys3D } from './Keys3D.tsx'
import { Lamps3D } from './Lamps3D.tsx'
import { Plugboard3D } from './Plugboard3D.tsx'
import { Rotors3D } from './Rotors3D.tsx'
import { SignalPath3D } from './SignalPath3D.tsx'
import { XrayRefresh } from './XrayRefresh.tsx'

export function Scene() {
  return (
    <>
      <color attach="background" args={['#0c0a09']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 12, 8]} intensity={1.6} />
      <directionalLight position={[-6, 4, 10]} intensity={0.5} />
      {/* Local light formers only: no HDR file to download. */}
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 6, 6]} scale={[12, 4, 1]} />
        <Lightformer
          intensity={0.8}
          position={[-8, 2, 0]}
          rotation-y={Math.PI / 2}
          scale={[10, 3, 1]}
        />
      </Environment>

      <Case />
      <Rotors3D />
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
      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={1} intensity={1.1} mipmapBlur />
      </EffectComposer>
      <E2EHooks />
    </>
  )
}
