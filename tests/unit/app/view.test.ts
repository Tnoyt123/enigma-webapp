import { describe, expect, it } from 'vitest'
import { chooseView, parseView, withViewParam } from '../../../src/app/view.ts'

describe('chooseView', () => {
  it('defaults to 3D', () => {
    expect(chooseView({ search: '', stored: null, webgl: true })).toEqual({
      view: '3d',
      notice: null,
    })
  })

  it('prefers the URL parameter over the remembered choice', () => {
    expect(chooseView({ search: '?view=2d', stored: '3d', webgl: true }).view).toBe('2d')
    expect(chooseView({ search: '?view=3D', stored: '2d', webgl: true }).view).toBe('3d')
  })

  it('uses the remembered choice when the URL says nothing valid', () => {
    expect(chooseView({ search: '?view=vr', stored: '2d', webgl: true }).view).toBe('2d')
    expect(chooseView({ search: '?x=1', stored: 'junk', webgl: true }).view).toBe('3d')
  })

  it('falls back to 2D with a notice when WebGL is unavailable', () => {
    const choice = chooseView({ search: '?view=3d', stored: null, webgl: false })
    expect(choice.view).toBe('2d')
    expect(choice.notice).toMatch(/WebGL/)
    expect(chooseView({ search: '?view=2d', stored: null, webgl: false }).notice).toBeNull()
  })
})

describe('view helpers', () => {
  it('parses views leniently', () => {
    expect(parseView(' 2D ')).toBe('2d')
    expect(parseView('three')).toBeNull()
    expect(parseView(null)).toBeNull()
  })

  it('sets the view parameter and keeps the others', () => {
    expect(withViewParam('', '2d')).toBe('?view=2d')
    expect(withViewParam('?a=1&view=3d', '2d')).toBe('?a=1&view=2d')
  })
})
