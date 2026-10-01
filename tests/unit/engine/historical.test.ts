import { describe, expect, it } from 'vitest'
import { EnigmaMachine, fromKeySheet } from '../../../src/engine/index.ts'
import { HISTORICAL_MESSAGES } from './fixtures/historical.ts'

const letters = (s: string) => s.replace(/[^A-Z]/g, '')

describe.each(HISTORICAL_MESSAGES)('$name', (msg) => {
  const config = fromKeySheet(msg.key)

  it('decrypts to the historical plaintext', () => {
    expect(new EnigmaMachine(config, msg.start).encipher(msg.ciphertext)).toBe(msg.plaintext)
  })

  it('re-encrypts to the historical ciphertext', () => {
    expect(new EnigmaMachine(config, msg.start).encipher(msg.plaintext)).toBe(
      letters(msg.ciphertext),
    )
  })

  if (msg.indicator) {
    const { grundstellung, encrypted } = msg.indicator
    it(`decrypts indicator ${encrypted} at ${grundstellung} to the message key`, () => {
      expect(new EnigmaMachine(config, grundstellung).encipher(encrypted)).toBe(msg.start)
    })
  }
})
