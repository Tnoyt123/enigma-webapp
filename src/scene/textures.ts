import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { ALPHABET } from '../engine/index.ts'

const cache = new Map<string, CanvasTexture>()

function make(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  cache.set(key, texture)
  return texture
}

const FONT = 'bold {size}px "DejaVu Sans Mono", Menlo, Consolas, monospace'
const font = (size: number) => FONT.replace('{size}', String(size))

/** A single centred letter on a square, used for key caps, lamp windows and socket labels. */
export function letterTexture(letter: string, fg: string, bg: string, size = 128) {
  return make(`letter:${letter}:${fg}:${bg}:${size}`, size, size, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = fg
    ctx.font = font(size * 0.56)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(letter, size / 2, size / 2 + size * 0.04)
  })
}

/**
 * The alphabet ring wrapped round a rotor: 26 letters spaced around the circumference.
 * Each letter is turned a quarter so it reads upright when wrapped on a rotor lying along x.
 */
export function alphabetRingTexture() {
  const cell = 96
  return make('ring', cell * 26, cell, (ctx) => {
    ctx.fillStyle = '#ece6d6'
    ctx.fillRect(0, 0, cell * 26, cell)
    ctx.fillStyle = '#1c1917'
    ctx.font = font(cell * 0.62)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 26; i++) {
      ctx.save()
      ctx.translate(cell * i + cell / 2, cell / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(ALPHABET[i], 0, cell * 0.04)
      ctx.restore()
      ctx.fillRect(cell * i, 0, 2, cell)
    }
  })
}

/** Knurled thumbwheel: dark ridges around the rim. */
export function knurlTexture() {
  const texture = make('knurl', 512, 32, (ctx) => {
    for (let i = 0; i < 64; i++) {
      ctx.fillStyle = i % 2 ? '#3f3a35' : '#1a1715'
      ctx.fillRect(i * 8, 0, 8, 32)
    }
  })
  texture.wrapS = RepeatWrapping
  return texture
}

/** A short label (e.g. a rotor's Roman numeral) on a dark plate. */
export function labelTexture(text: string) {
  return make(`label:${text}`, 256, 96, (ctx) => {
    ctx.fillStyle = '#1c1917'
    ctx.fillRect(0, 0, 256, 96)
    ctx.fillStyle = '#f5f5f4'
    ctx.font = font(60)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 52)
  })
}
