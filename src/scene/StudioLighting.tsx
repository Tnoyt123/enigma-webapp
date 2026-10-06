import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Soft studio reflections for the chrome rims, metal and brass, from three.js's procedural
 * RoomEnvironment. It's generated in a few milliseconds, with no image to download.
 */
export function StudioLighting({ intensity = 0.2 }: { intensity?: number }) {
  const get = useThree((s) => s.get)

  useEffect(() => {
    const { gl, scene, invalidate } = get()
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, 0.04).texture
    scene.environment = environment
    scene.environmentIntensity = intensity
    invalidate()
    return () => {
      scene.environment = null
      environment.dispose()
      room.dispose()
      pmrem.dispose()
    }
  }, [get, intensity])

  return null
}
