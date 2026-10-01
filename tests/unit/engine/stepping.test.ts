import { describe, expect, it } from 'vitest'
import { EnigmaMachine, fromKeySheet, type KeySheet } from '../../../src/engine/index.ts'

const enigmaI = (rotors: string): KeySheet => ({ model: 'I', reflector: 'B', rotors, rings: 'AAA' })
const m3 = (rotors: string): KeySheet => ({ model: 'M3', reflector: 'B', rotors, rings: 'AAA' })

/** Window letters after each of `presses` key presses, starting at `start`. */
function walk(sheet: KeySheet, start: string, presses: number): string[] {
  const machine = new EnigmaMachine(fromKeySheet(sheet), start)
  const seen = [machine.positions]
  for (let i = 0; i < presses; i++) seen.push(machine.press('A').positionsAfter)
  return seen
}

describe('rotor stepping', () => {
  it('steps the right rotor on every key press, before enciphering', () => {
    expect(walk(enigmaI('I II III'), 'AAA', 3)).toEqual(['AAA', 'AAB', 'AAC', 'AAD'])
  })

  it.each([
    ['I', 'Q', 'R'],
    ['II', 'E', 'F'],
    ['III', 'V', 'W'],
    ['IV', 'J', 'K'],
    ['V', 'Z', 'A'],
  ])('rotor %s turns its neighbour as it leaves %s', (rotor, notch, next) => {
    const [left, middle] = ['I', 'II', 'III', 'IV', 'V'].filter((r) => r !== rotor)
    expect(walk(enigmaI(`${left} ${middle} ${rotor}`), `AA${notch}`, 1)).toEqual([
      `AA${notch}`,
      `AB${next}`,
    ])
  })

  it('double-steps the middle rotor (ADU → ADV → AEW → BFX)', () => {
    expect(walk(enigmaI('I II III'), 'ADU', 3)).toEqual(['ADU', 'ADV', 'AEW', 'BFX'])
  })

  it('flags the double step in the trace', () => {
    const machine = new EnigmaMachine(fromKeySheet(enigmaI('I II III')), 'ADV')
    expect(machine.press('A').doubleStep).toBe(false) // ADV → AEW: normal turnover from the right rotor
    const trace = machine.press('A') // AEW → BFX: middle rotor steps again on its own notch
    expect(trace.doubleStep).toBe(true)
    expect(trace.stepped).toEqual([true, true, true])
  })

  it.each(['VI', 'VII', 'VIII'])(
    'two-notch rotor %s turns its neighbour at both Z and M',
    (rotor) => {
      expect(walk(m3(`I II ${rotor}`), 'AAZ', 1)).toEqual(['AAZ', 'ABA'])
      expect(walk(m3(`I II ${rotor}`), 'AAM', 1)).toEqual(['AAM', 'ABN'])
    },
  )

  it('has a period of 26 × 25 × 26 = 16,900 because of double stepping', () => {
    const positions = walk(enigmaI('I II III'), 'AAA', 16_900)
    expect(positions.at(-1)).toBe('AAA')
    expect(new Set(positions.slice(0, -1)).size).toBe(16_900)
  })

  it('never steps the M4 thin rotor', () => {
    const sheet: KeySheet = {
      model: 'M4',
      reflector: 'B-thin',
      rotors: 'Gamma VI VII VIII',
      rings: 'AAAA',
    }
    const positions = walk(sheet, 'QZZZ', 20_000)
    expect(positions.every((p) => p[0] === 'Q')).toBe(true)
  })

  it('ignores ring settings when deciding to step (notches are on the alphabet ring)', () => {
    const sheet: KeySheet = { model: 'I', reflector: 'B', rotors: 'I II III', rings: 'ZKM' }
    expect(walk(sheet, 'ADU', 3)).toEqual(['ADU', 'ADV', 'AEW', 'BFX'])
  })
})
