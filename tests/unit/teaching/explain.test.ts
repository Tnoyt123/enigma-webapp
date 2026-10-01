import { describe, expect, it } from 'vitest'
import { EnigmaMachine, fromKeySheet, type MachineConfig } from '../../../src/engine/index.ts'
import { doubleStepText, lessonSteps, reveal } from '../../../src/teaching/explain.ts'

const config: MachineConfig = fromKeySheet({
  model: 'I',
  reflector: 'B',
  rotors: 'I II III',
  rings: 'AAB',
  plugboard: 'AQ',
})

describe('lessonSteps', () => {
  const trace = new EnigmaMachine(config, 'AAA').press('A')
  const steps = lessonSteps(trace, config)

  it('covers the stepping, every stage and the lamp', () => {
    expect(steps).toHaveLength(trace.stages.length + 2)
    expect(steps[0]).toMatchObject({ focus: 'press', title: 'Key A pressed: the rotors step' })
    expect(steps.at(-1)).toMatchObject({ focus: 'lamp', title: `Lamp ${trace.output} lights` })
    expect(steps.map((s) => s.title)).toEqual([
      'Key A pressed: the rotors step',
      'Plugboard (in)',
      'Entry wheel (in)',
      'Right rotor (III)',
      'Middle rotor (II)',
      'Left rotor (I)',
      'Reflector (UKW-B)',
      'Left rotor (I), returning',
      'Middle rotor (II), returning',
      'Right rotor (III), returning',
      'Entry wheel (out)',
      'Plugboard (out)',
      `Lamp ${trace.output} lights`,
    ])
  })

  it('explains the stepping, plugboard swaps and rotor offsets with real letters', () => {
    expect(steps[0].detail).toMatch(/right rotor \(III\) turns A → B/)
    expect(steps[1].detail).toMatch(/cable joins sockets A and Q/)
    // Right rotor at B with ring B: not turned at all.
    expect(steps[3].detail).toMatch(
      /window shows B and its ring is set to B, so the wiring is not turned/,
    )
    // Middle rotor at A with ring A.
    expect(steps[4].detail).toMatch(/contact [A-Z], which meets the rotor's own wiring at [A-Z]/)
    expect(steps[6].detail).toMatch(/can never encrypt to itself/)
  })

  it('describes a turned rotor and the reason a neighbour stepped', () => {
    const c = fromKeySheet({ model: 'I', reflector: 'B', rotors: 'I II III', rings: 'AAC' })
    const t = new EnigmaMachine(c, 'AAV').press('B')
    const s = lessonSteps(t, c)
    expect(s[0].detail).toMatch(
      /middle rotor \(II\) turns A → B because the right rotor was at its notch letter \(V\)/,
    )
    expect(s[3].detail).toMatch(/turned 20 steps \(position − ring\)/) // W (22) − C (2)
  })

  it('mentions the thin rotor on the M4', () => {
    const m4 = fromKeySheet({
      model: 'M4',
      reflector: 'B-thin',
      rotors: 'Beta I II III',
      rings: 'AAAA',
    })
    const t = new EnigmaMachine(m4, 'AAAA').press('A')
    expect(lessonSteps(t, m4)[0].detail).toMatch(/thin fourth rotor never steps/)
    expect(lessonSteps(t, m4).map((s) => s.title)).toContain('Thin rotor (Beta)')
  })
})

describe('doubleStepText', () => {
  it('explains the double step when it happens and only then', () => {
    const machine = new EnigmaMachine(config, 'ADV')
    expect(doubleStepText(machine.press('A'), config)).toBeNull() // ADV → AEW
    const text = doubleStepText(machine.press('A'), config) // AEW → BFX
    expect(text).toMatch(/middle rotor \(II\) was showing E, its notch letter/)
    expect(text).toMatch(/E → F/)
    expect(text).toMatch(/left rotor \(I\) with it \(A → B\)/)
    expect(text).toMatch(/16,900/)
  })

  it('appears in the stepping step of the walkthrough too', () => {
    const t = new EnigmaMachine(config, 'AEW').press('A')
    expect(lessonSteps(t, config)[0].detail).toMatch(
      /at its notch letter \(E\): this is the double step/,
    )
  })
})

describe('reveal', () => {
  it('maps the walkthrough cursor to what is drawn', () => {
    expect(reveal(0, 11)).toEqual({ stages: 0, lamp: false, focus: 'press' })
    expect(reveal(1, 11)).toEqual({ stages: 1, lamp: false, focus: 0 })
    expect(reveal(11, 11)).toEqual({ stages: 11, lamp: false, focus: 10 })
    expect(reveal(12, 11)).toEqual({ stages: 11, lamp: true, focus: 'lamp' })
    expect(reveal(999, 11)).toEqual({ stages: 11, lamp: true, focus: 'lamp' })
  })
})
