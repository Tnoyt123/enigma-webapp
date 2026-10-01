import { beforeEach, describe, expect, it } from 'vitest'
import { machineStore } from '../../../src/state/machineStore.ts'
import { createTeachingStore } from '../../../src/state/teachingStore.ts'

const press = (letter: string) => {
  machineStore.getState().keyDown(letter)
  machineStore.getState().keyUp()
}

describe('teaching store', () => {
  let store: ReturnType<typeof createTeachingStore>
  const s = () => store.getState()

  beforeEach(() => {
    machineStore.getState().clearTape()
    store = createTeachingStore()
  })

  it('outside step mode, every key press is shown whole', () => {
    press('A')
    expect(s().cursor).toBeGreaterThanOrEqual(12)
  })

  it('in step mode, each key press starts at the beginning and steps within bounds', () => {
    s().setStepMode(true)
    press('A')
    expect(s().cursor).toBe(0)
    s().previous()
    expect(s().cursor).toBe(0)
    for (let i = 0; i < 20; i++) s().next()
    expect(s().cursor).toBe(12) // 11 stages + key press + lamp, zero-based
    s().previous()
    expect(s().cursor).toBe(11)
    s().restart()
    expect(s().cursor).toBe(0)
    press('B')
    expect(s().cursor).toBe(0)
  })

  it('play at the end starts over; leaving step mode stops playing', () => {
    s().setStepMode(true)
    press('A')
    for (let i = 0; i < 20; i++) s().next()
    s().setPlaying(true)
    expect(s()).toMatchObject({ playing: true, cursor: 0 })
    s().setStepMode(false)
    expect(s().playing).toBe(false)
  })

  it('changing the machine clears the last key press', () => {
    press('A')
    expect(machineStore.getState().lastTrace).not.toBeNull()
    machineStore.getState().setRing(0, 3)
    expect(machineStore.getState().lastTrace).toBeNull()
    machineStore.getState().setRing(0, 0)
  })
})
