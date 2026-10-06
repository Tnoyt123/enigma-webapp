import { describe, expect, it } from 'vitest'
import { isSoftwareRenderer } from '../../../src/scene/quality.ts'

describe('isSoftwareRenderer', () => {
  it('recognizes software WebGL renderers', () => {
    for (const name of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)',
      'Software Rasterizer',
    ]) {
      expect(isSoftwareRenderer(name), name).toBe(true)
    }
  })

  it('leaves hardware GPUs at full quality', () => {
    for (const name of [
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Adreno (TM) 740',
      'WebKit WebGL',
    ]) {
      expect(isSoftwareRenderer(name), name).toBe(false)
    }
  })
})
