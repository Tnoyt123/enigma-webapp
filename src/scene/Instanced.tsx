import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Object3D, type InstancedMesh } from 'three'

const scratch = new Object3D()

/**
 * Many copies of one mesh in a single draw call: `positions` places each copy; `rotationX`
 * tilts them all alike. For static repeated parts (socket holes, rings round sockets and lamps).
 */
export function Instanced({
  positions,
  rotationX = 0,
  children,
}: {
  positions: readonly (readonly [number, number, number])[]
  rotationX?: number
  /** The geometry and material elements. */
  children: ReactNode
}) {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    positions.forEach(([x, y, z], i) => {
      scratch.position.set(x, y, z)
      scratch.rotation.set(rotationX, 0, 0)
      scratch.updateMatrix()
      m.setMatrixAt(i, scratch.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [positions, rotationX])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, positions.length]}>
      {children}
    </instancedMesh>
  )
}
