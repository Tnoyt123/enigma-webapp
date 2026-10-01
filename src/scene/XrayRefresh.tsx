import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Material, Mesh } from 'three'
import { useTeaching } from '../state/teachingStore.ts'

/**
 * Switching x-ray flips materials between opaque and transparent. three.js bakes that into each
 * material's compiled shader, so without a recompile, materials created opaque keep rendering
 * as opaque (and with depth writes off, vanish). Flag every material for an update on each switch.
 */
export function XrayRefresh() {
  const xray = useTeaching((s) => s.xray)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false // materials were created with the right settings
      return
    }
    scene.traverse((object) => {
      const material = (object as Mesh).material as Material | Material[] | undefined
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        m.needsUpdate = true
      }
    })
    invalidate()
  }, [xray, scene, invalidate])

  return null
}
