import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Box3, Vector3 } from 'three'
import { pathInfo } from './xray.ts'

declare global {
  interface Window {
    /** Present only with ?e2e in the URL: lets browser tests find 3D parts on screen. */
    __enigma3d?: {
      screenPoint(name: string): { x: number; y: number } | null
      /** Segments of the signal path currently drawn, and the step-mode focus. */
      signalPath(): { segments: number; focus: string | null }
      /** Frames rendered so far (the canvas renders on demand, so this stops rising when idle). */
      frames(): number
    }
  }
}

/** Test hook: maps a named mesh (e.g. "key-A", "socket-V") to its centre in page coordinates. */
export function E2EHooks() {
  const { scene, camera, gl } = useThree()

  useEffect(() => {
    if (!new URLSearchParams(location.search).has('e2e')) return
    window.__enigma3d = {
      screenPoint(name) {
        const object = scene.getObjectByName(name)
        if (!object) return null
        const centre = new Box3().setFromObject(object).getCenter(new Vector3()).project(camera)
        const rect = gl.domElement.getBoundingClientRect()
        return {
          x: rect.left + ((centre.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - centre.y) / 2) * rect.height,
        }
      },
      signalPath: () => ({ ...pathInfo }),
      frames: () => gl.info.render.frame,
    }
    return () => {
      delete window.__enigma3d
    }
  }, [scene, camera, gl])

  return null
}
