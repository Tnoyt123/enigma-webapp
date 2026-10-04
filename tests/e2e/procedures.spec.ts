import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openMachine, rotor, VIEWS } from './helpers.ts'

const radio = (page: Page) => page.getByRole('region', { name: 'Radio message' })
const sounds = (page: Page) =>
  page.evaluate(() => [
    ...((window as unknown as { __enigmaSounds?: string[] }).__enigmaSounds ?? []),
  ])

async function setBarbarossaKey(page: Page) {
  await page.getByLabel('Left rotor', { exact: true }).selectOption('II')
  await page.getByLabel('Middle rotor', { exact: true }).selectOption('IV')
  await page.getByLabel('Right rotor', { exact: true }).selectOption('V')
  await page.getByLabel('Left ring setting').selectOption({ label: 'B · 02' })
  await page.getByLabel('Middle ring setting').selectOption({ label: 'U · 21' })
  await page.getByLabel('Right ring setting').selectOption({ label: 'L · 12' })
  await page.getByLabel(/Plugboard pairs/).fill('AV BS CG DL FU HZ IN KM OW RX')
}

for (const view of VIEWS) {
  test.describe(`${view.toUpperCase()} view`, () => {
    test.beforeEach(async ({ page }) => {
      await openMachine(page, view)
    })

    test('receives the 1941 Barbarossa message from its header and text', async ({ page }) => {
      await setBarbarossaKey(page)
      await radio(page).getByRole('tab', { name: 'Receive' }).click()
      await radio(page).getByLabel('Header').fill('1840 – 2TLE – 1TL – 179 – WXC KCH –')
      await radio(page)
        .getByLabel('Message text')
        .fill('EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE')
      await radio(page)
        .getByLabel(/identification group/)
        .uncheck()
      await radio(page).getByRole('button', { name: 'Decipher' }).click()
      await expect(page.getByTestId('received-plaintext')).toHaveText(
        'AUFKL XABTE ILUNG XVONX KURTI NOWAX KURTI NOWAX',
      )
      // Try the indicator step on the machine itself.
      await radio(page)
        .getByRole('button', { name: /Set the rotors to WXC/ })
        .click()
      await expect(rotor(page, 'Left')).toHaveAttribute('aria-valuetext', 'W')
      for (const key of 'kch') await page.keyboard.press(key)
      await expect(page.getByTestId('tape-output')).toHaveText('BLA')
    })

    test('sends a message with a doubled indicator, and reads it back', async ({ page }) => {
      await radio(page).getByLabel('Procedure').selectOption('doubled-1938')
      await radio(page)
        .getByLabel(/Start position/)
        .fill('WZA')
      await radio(page)
        .getByLabel(/Message key/)
        .fill('SXT')
      await radio(page)
        .getByLabel(/^Message$/)
        .fill('ANGRIFF UM DREI UHR')
      await radio(page).getByRole('button', { name: 'Prepare message' }).click()
      const transmitted = (await page.getByTestId('radio-message').textContent())!
      const [header, body] = transmitted.split('\n')
      expect(header).toMatch(/^\d{4} – 22 – WZA –$/)
      await expect(radio(page).getByText(/Encipher the message key twice: SXTSXT →/)).toBeVisible()

      await radio(page).getByRole('tab', { name: 'Receive' }).click()
      await radio(page).getByLabel('Header').fill(header)
      await radio(page).getByLabel('Message text').fill(body)
      await radio(page).getByRole('button', { name: 'Decipher' }).click()
      await expect(page.getByTestId('received-plaintext')).toHaveText('ANGRI FFUMD REIUH R')
    })

    test('the M4 uses the naval procedure with four-letter groups', async ({ page }) => {
      await page.getByLabel(/Enigma M4/).check()
      await expect(radio(page).getByLabel('Procedure')).toHaveValue('naval')
      await radio(page)
        .getByLabel(/Grundstellung/)
        .fill('VJNA')
      await radio(page)
        .getByLabel(/^Message$/)
        .fill('ANGRIFF')
      await radio(page).getByRole('button', { name: 'Prepare message' }).click()
      const [, body] = (await page.getByTestId('radio-message').textContent())!.split('\n')
      expect(body.split(' ').every((group) => group.length <= 4)).toBe(true)

      await radio(page).getByRole('tab', { name: 'Receive' }).click()
      await radio(page)
        .getByLabel(/Grundstellung/)
        .fill('VJNA')
      await radio(page).getByLabel('Message text').fill(body)
      await radio(page).getByRole('button', { name: 'Decipher' }).click()
      await expect(page.getByTestId('received-plaintext')).toHaveText('ANGRI FF')
    })

    test('sounds: a key press plays the key and one ratchet per stepping rotor; mute silences', async ({
      page,
    }) => {
      // The recorded key sounds load and decode (the synthesized ones are only a fallback).
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as { __enigmaSamples: () => string[] }).__enigmaSamples().sort(),
          ),
        )
        .toEqual(['key-down', 'key-up'])
      await page.keyboard.press('a')
      await expect.poll(() => sounds(page)).toEqual(['key-down', 'ratchet', 'key-up'])

      // From AEW the next press double-steps: three rotors move, three ratchet clicks.
      for (const [slot, letter] of [
        ['Middle', 'e'],
        ['Right', 'w'],
      ]) {
        await rotor(page, slot).focus()
        await page.keyboard.press(letter)
      }
      await page.locator('header').click()
      await page.keyboard.press('a')
      await expect
        .poll(async () => (await sounds(page)).slice(3))
        .toEqual(['key-down', 'ratchet', 'ratchet', 'ratchet', 'key-up'])

      const toggle = page.getByRole('button', { name: 'Sound' })
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-pressed', 'false')
      await page.keyboard.press('a')
      expect(await sounds(page)).toHaveLength(8)
      await page.reload()
      await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })

    test('no accessibility violations with a prepared message showing', async ({ page }) => {
      await radio(page)
        .getByLabel(/^Message$/)
        .fill('TEST')
      await radio(page).getByRole('button', { name: 'Prepare message' }).click()
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  })
}
