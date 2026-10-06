/**
 * Without a usable GPU, browsers draw WebGL in software (SwiftShader, llvmpipe, Microsoft Basic
 * Render Driver). That is several times slower, so the 3D view then trades a little sharpness
 * for a smooth model: no multisample antialiasing and one pixel per CSS pixel.
 */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)
}

function detectSoftwareRenderer(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return false
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext() // free the probe's context at once
    return isSoftwareRenderer(renderer)
  } catch {
    return false
  }
}

const software = typeof document === 'undefined' ? false : detectSoftwareRenderer()

/** Rendering settings for this device's GPU. */
export const QUALITY = {
  /** Device pixel ratio range: above 1.5× the extra pixels cost far more than they add. */
  dpr: software ? 1 : ([1, 1.5] as [number, number]),
  multisampling: software ? 0 : 4,
}
