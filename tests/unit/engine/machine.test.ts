import { describe, expect, it } from 'vitest'
import {
  compile,
  ConfigError,
  EnigmaMachine,
  fromKeySheet,
  parseRings,
  validateConfig,
  type MachineConfig,
} from '../../../src/engine/index.ts'

const basic: MachineConfig = {
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: [0, 0, 0],
  plugboard: [],
}

describe('EnigmaMachine', () => {
  it('enciphers AAAAA → BDZGO with I-II-III, UKW-B, rings and positions AAA', () => {
    expect(new EnigmaMachine(basic).encipher('AAAAA')).toBe('BDZGO')
  })

  it('applies ring settings (rotor I at A with ring B maps A → K)', () => {
    const machine = new EnigmaMachine(
      { ...basic, rotors: ['II', 'III', 'I'], rings: [0, 0, 1] },
      'AAZ',
    )
    expect(machine.press('A').stages[2]).toEqual({
      component: 'rotor',
      direction: 'forward',
      slot: 2,
      rotor: 'I',
      input: 'A',
      output: 'K',
      coreInput: 'Z',
      coreOutput: 'J',
      position: 'A',
      ring: 'B',
    })
  })

  it('drops non-letters and accepts lower case', () => {
    expect(new EnigmaMachine(basic).encipher('a a-a.a\na')).toBe('BDZGO')
  })

  it('tracks and sets positions', () => {
    const machine = new EnigmaMachine(basic, 'XYZ')
    machine.press('A')
    expect(machine.positions).toBe('XYA')
    machine.setPositions('aaa')
    expect(machine.positions).toBe('AAA')
    expect(() => machine.setPositions('AA')).toThrow(ConfigError)
  })
})

describe('trace', () => {
  const machine = new EnigmaMachine(
    fromKeySheet({
      ...{ model: 'I', reflector: 'B', rotors: 'II IV V', rings: 'BUL' },
      plugboard: 'AV BS',
    }),
    'BLA',
  )
  const trace = machine.press('A')

  it('chains every stage from key to lamp', () => {
    expect(trace.stages[0].input).toBe('A')
    for (let i = 1; i < trace.stages.length; i++) {
      expect(trace.stages[i].input).toBe(trace.stages[i - 1].output)
    }
    expect(trace.stages.at(-1)!.output).toBe(trace.output)
  })

  it('visits plugboard, entry, R-M-L, reflector, L-M-R, entry, plugboard', () => {
    expect(
      trace.stages.map((s) => (s.component === 'rotor' ? `rotor${s.slot}` : s.component)),
    ).toEqual([
      'plugboard',
      'entry',
      'rotor2',
      'rotor1',
      'rotor0',
      'reflector',
      'rotor0',
      'rotor1',
      'rotor2',
      'entry',
      'plugboard',
    ])
  })

  it('records the plugboard swap and positions', () => {
    expect(trace.stages[0]).toMatchObject({ component: 'plugboard', output: 'V', swapped: true })
    expect(trace.positionsBefore).toBe('BLA')
    expect(trace.positionsAfter).toBe('BLB')
    expect(trace.stepped).toEqual([false, false, true])
    expect(trace.doubleStep).toBe(false)
  })
})

describe('validateConfig', () => {
  const problemsFor = (patch: Partial<MachineConfig>, positions?: number[]) =>
    validateConfig({ ...basic, ...patch }, positions)

  it('accepts a valid configuration', () => {
    expect(problemsFor({})).toEqual([])
  })

  it.each<[string, Partial<MachineConfig>, RegExp]>([
    ['unknown model', { model: 'X' as never }, /Unknown model/],
    ['wrong reflector', { reflector: 'B-thin' }, /takes reflector UKW-A, UKW-B or UKW-C/],
    ['naval rotor on Enigma I', { rotors: ['I', 'II', 'VI'] }, /Rotor "VI" can't be used/],
    ['too few rotors', { rotors: ['I', 'II'], rings: [0, 0] }, /needs 3 rotors/],
    ['duplicate rotor', { rotors: ['I', 'I', 'II'] }, /used twice/],
    ['bad ring count', { rings: [0, 0] }, /Expected 3 ring settings/],
    ['bad ring value', { rings: [0, 0, 26] }, /must be a letter/],
    ['self-plug', { plugboard: ['AA'] }, /connects a letter to itself/],
    ['reused socket', { plugboard: ['AB', 'BC'] }, /socket B is used by two cables/],
    ['malformed pair', { plugboard: ['A1'] }, /must be two letters/],
    ['too many cables', { plugboard: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ12'.match(/../g)! }, /At most 13/],
  ])('rejects %s', (_, patch, message) => {
    expect(problemsFor(patch).join('\n')).toMatch(message)
  })

  it('enforces the M4 thin slot and thin reflector', () => {
    const m4: MachineConfig = {
      model: 'M4',
      reflector: 'B',
      rotors: ['I', 'II', 'III', 'IV'],
      rings: [0, 0, 0, 0],
      plugboard: [],
    }
    const problems = validateConfig(m4).join('\n')
    expect(problems).toMatch(/takes reflector/)
    expect(problems).toMatch(/leftmost Enigma M4 slot takes a thin rotor/)
    expect(validateConfig({ ...m4, rotors: ['II', 'Beta', 'III', 'IV'] }).join('\n')).toMatch(
      /Rotor "Beta" can't be used in slot 2/,
    )
  })

  it('validates positions when given', () => {
    expect(problemsFor({}, [0, 0])).toEqual(['Expected 3 rotor positions, got 2.'])
  })

  it('compile() refuses invalid configurations too', () => {
    expect(() => compile({ ...basic, reflector: 'C-thin' })).toThrow(ConfigError)
  })

  it('throws ConfigError listing every problem', () => {
    expect(() => new EnigmaMachine({ ...basic, rotors: ['I', 'I', 'VI'] })).toThrow(
      expect.objectContaining({ name: 'ConfigError', problems: expect.any(Array) }),
    )
  })
})

describe('settings parsing', () => {
  it('reads ring settings as letters or 1-based numbers', () => {
    expect(parseRings('BUL')).toEqual([1, 20, 11])
    expect(parseRings(' b u l ')).toEqual([1, 20, 11])
    expect(parseRings('02 21 12')).toEqual([1, 20, 11])
  })

  it('builds a config from a key sheet', () => {
    expect(
      fromKeySheet({
        model: 'M4',
        reflector: 'C-thin',
        rotors: ' Gamma  VI VII VIII ',
        rings: '01 01 01 26',
        plugboard: 'ab, cd',
      }),
    ).toEqual({
      model: 'M4',
      reflector: 'C-thin',
      rotors: ['Gamma', 'VI', 'VII', 'VIII'],
      rings: [0, 0, 0, 25],
      plugboard: ['AB', 'CD'],
    })
  })
})
