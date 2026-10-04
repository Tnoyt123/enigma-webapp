import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  ALPHABET,
  BIGRAM_TABLE,
  disguiseIndicator,
  fromKeySheet,
  receiveMessage,
  revealIndicator,
  sendMessage,
  toGroups,
} from '../../../src/engine/index.ts'
import { HISTORICAL_MESSAGES } from './fixtures/historical.ts'

const barbarossa = HISTORICAL_MESSAGES[0]
const enigmaI = fromKeySheet(barbarossa.key)
const m4 = fromKeySheet({
  model: 'M4',
  reflector: 'B-thin',
  rotors: 'Beta II IV I',
  rings: 'AAAV',
  plugboard: 'AT BL DF GJ HM NW OP QY RZ VX',
})
const fixed = () => 0.42
const PLAIN = 'ANGRIFFXUMXDREIXUHR'

describe('Army and Luftwaffe, single indicator (1940–45)', () => {
  it('reads the real Barbarossa header: WXC KCH → message key BLA', () => {
    const received = receiveMessage({
      procedure: 'army-1940',
      config: enigmaI,
      header: '1840 – 2TLE – 1TL – 179 – WXC KCH –',
      body: barbarossa.ciphertext,
      kenngruppe: false, // the published text starts after the identification group
    })
    expect(received.messageKey).toBe('BLA')
    expect(received.plaintext).toBe(barbarossa.plaintext)
    expect(received.steps[0].title).toBe('Decipher the message key at WXC: KCH → BLA')
  })

  it('sends a message with the key enciphered once and an identification group', () => {
    const sent = sendMessage({
      procedure: 'army-1940',
      config: enigmaI,
      plaintext: PLAIN,
      grundstellung: 'wxc',
      messageKey: 'BLA',
      kenngruppe: 'DEF',
      time: '1840',
      random: fixed,
    })
    expect(sent.header).toBe(`1840 – ${5 + PLAIN.length} – WXC KCH –`)
    expect(sent.body.startsWith('KKDEF ')).toBe(true)
    expect(
      receiveMessage({
        procedure: 'army-1940',
        config: enigmaI,
        header: sent.header,
        body: sent.body,
      }).plaintext,
    ).toBe(PLAIN)
  })
})

describe('Army and Luftwaffe, doubled indicator (1938–40)', () => {
  it('enciphers the key twice at the start position sent in clear', () => {
    const sent = sendMessage({
      procedure: 'doubled-1938',
      config: enigmaI,
      plaintext: PLAIN,
      grundstellung: 'WZA',
      messageKey: 'SXT',
      time: '0915',
    })
    expect(sent.header).toBe(`0915 – ${6 + PLAIN.length} – WZA –`)
    const indicator = sent.body.replace(/ /g, '').slice(0, 6)
    expect(sent.steps[3].type).toEqual({ input: 'SXTSXT', output: indicator })
    const received = receiveMessage({
      procedure: 'doubled-1938',
      config: enigmaI,
      header: sent.header,
      body: sent.body,
    })
    expect(received).toMatchObject({ messageKey: 'SXT', plaintext: PLAIN })
  })

  it('rejects an indicator that does not decipher to a doubled key', () => {
    expect(() =>
      receiveMessage({
        procedure: 'doubled-1938',
        config: enigmaI,
        header: '0915 – 25 – WZA –',
        body: 'ABCDEF GHIJK',
      }),
    ).toThrow(/isn't a key typed twice/)
  })
})

describe('Kriegsmarine', () => {
  it('round-trips through the Kenngruppenbuch trigram and bigram tables on the M4', () => {
    const sent = sendMessage({
      procedure: 'naval',
      config: m4,
      plaintext: PLAIN,
      grundstellung: 'VJNA',
      messageKey: 'QWE',
      kenngruppe: 'RTZ',
      random: fixed,
    })
    const groups = sent.body.split(' ')
    expect(groups.every((g) => g.length <= 4)).toBe(true)
    expect(groups.slice(-2)).toEqual(groups.slice(0, 2)) // indicator repeated at the end
    expect(sent.messageKey).toHaveLength(3)
    const received = receiveMessage({
      procedure: 'naval',
      config: m4,
      header: sent.header,
      body: sent.body,
      grundstellung: 'VJNA',
    })
    expect(received).toMatchObject({ messageKey: sent.messageKey, plaintext: PLAIN })
    expect(received.steps[0].title).toMatch(/→ RTZ, QWE$/)
  })

  it('keeps the M4 thin rotor at its Grundstellung letter', () => {
    const sent = sendMessage({
      procedure: 'naval',
      config: m4,
      plaintext: 'A',
      grundstellung: 'VJNA',
      messageKey: 'QWE',
      random: fixed,
    })
    expect(
      sent.steps.find((s) => s.title.startsWith('Encipher the message at'))?.setPositions,
    ).toBe(`V${sent.messageKey}`)
  })

  it('needs the day’s Grundstellung to read a message', () => {
    expect(() =>
      receiveMessage({ procedure: 'naval', config: m4, header: '', body: 'ABCD EFGH' }),
    ).toThrow(/Grundstellung/)
  })
})

describe('bigram table', () => {
  it('is reciprocal, complete and never maps a pair to itself', () => {
    expect(BIGRAM_TABLE.size).toBe(676)
    for (const [a, b] of BIGRAM_TABLE) {
      expect(b).not.toBe(a)
      expect(BIGRAM_TABLE.get(b)).toBe(a)
    }
  })

  it('disguises and reveals any pair of trigrams', () => {
    const tri = fc.string({ unit: fc.constantFrom(...ALPHABET), minLength: 3, maxLength: 3 })
    fc.assert(
      fc.property(
        tri,
        tri,
        fc.string({ unit: fc.constantFrom(...ALPHABET), minLength: 2, maxLength: 2 }),
        (kg, sk, fill) => {
          const [g1, g2] = disguiseIndicator(kg, sk, fill)
          expect(revealIndicator(g1, g2)).toEqual({ kenngruppe: kg, trigram: sk })
        },
      ),
    )
  })
})

describe('validation and grouping', () => {
  it('explains what a header is missing', () => {
    expect(() =>
      receiveMessage({
        procedure: 'army-1940',
        config: enigmaI,
        header: '1840 – 179 – WXC –',
        body: 'ABCDE',
      }),
    ).toThrow(/start position and the enciphered key/)
    expect(() =>
      receiveMessage({
        procedure: 'doubled-1938',
        config: enigmaI,
        header: '0915 – 25 –',
        body: 'ABCDEF',
      }),
    ).toThrow(/start position/)
  })

  it('insists on three-letter keys', () => {
    expect(() =>
      sendMessage({
        procedure: 'army-1940',
        config: enigmaI,
        plaintext: 'A',
        grundstellung: 'WX',
        messageKey: 'BLA',
      }),
    ).toThrow(/Grundstellung must be 3 letters/)
  })

  it('groups in fours or fives', () => {
    expect(toGroups('ABCDEFGHI', 4)).toBe('ABCD EFGH I')
  })
})
