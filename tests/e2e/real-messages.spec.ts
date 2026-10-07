import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openMachine, point3d, rotor, tapeOutput } from './helpers.ts'

const panel = (page: Page) => page.getByRole('region', { name: 'Real messages' })
const result = (page: Page) => page.getByTestId('real-message-result')

test('Barbarossa: one click sets the key, then the indicator and the message decipher', async ({
  page,
}) => {
  await openMachine(page, '2d')
  await panel(page)
    .getByRole('button', { name: /Operation Barbarossa/ })
    .click()

  // The key sheet now shows the day's key, and the rotors sit at the Grundstellung.
  await expect(page.getByLabel('Left rotor', { exact: true })).toHaveValue('II')
  await expect(page.getByLabel('Right ring setting')).toHaveValue('11') // L · 12
  await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('AV BS CG DL FU HZ IN KM OW RX')

  await panel(page).getByRole('button', { name: 'Type KCH at WXC' }).click()
  await expect(page.getByTestId('message-key-result')).toHaveText('→ BLA')

  await panel(page).getByRole('button', { name: 'Decipher the message' }).click()
  await expect(result(page)).toContainText('matches the published decryption')
  await expect(tapeOutput(page)).toHaveText(/^AUFKL XABTE ILUNG XVONX KURTI NOWAX/)
})

test('Scharnhorst deciphers on the M3 with navy rotors', async ({ page }) => {
  await openMachine(page, '2d')
  await panel(page)
    .getByRole('button', { name: /Scharnhorst/ })
    .click()
  await expect(page.getByRole('radio', { name: /Enigma M3/ })).toBeChecked()
  await expect(page.getByLabel('Middle rotor', { exact: true })).toHaveValue('VI')
  await panel(page).getByRole('button', { name: 'Decipher the message' }).click()
  await expect(result(page)).toContainText('matches the published decryption')
  await expect(result(page)).toContainText('STEUE REJTA NAFJO RD')
})

test('U-264 sets up the four-rotor M4 in 3D and deciphers', async ({ page }) => {
  await openMachine(page, '3d')
  await panel(page).getByRole('button', { name: /U-264/ }).click()
  await expect(page.getByRole('radio', { name: /Enigma M4/ })).toBeChecked()
  await point3d(page, 'thumbwheel-3') // the model now has a fourth rotor
  await panel(page).getByRole('button', { name: 'Decipher the message' }).click()
  await expect(result(page)).toContainText('matches the published decryption')
  await expect(tapeOutput(page)).toHaveText(/^VONVO NJLOO KS/)
})

test('a changed setup is caught: the result no longer matches', async ({ page }) => {
  await openMachine(page, '2d')
  await panel(page)
    .getByRole('button', { name: /Scharnhorst/ })
    .click()
  await page.getByLabel(/Plugboard pairs/).fill('AN EZ HK IJ LR MQ OT PV SW')
  await page.keyboard.press('Tab')
  await panel(page).getByRole('button', { name: 'Decipher the message' }).click()
  await expect(result(page)).toContainText("doesn't match the published decryption")
})

test('no accessibility violations with a message deciphered', async ({ page }) => {
  await openMachine(page, '2d')
  await panel(page)
    .getByRole('button', { name: /Operation Barbarossa/ })
    .click()
  await panel(page).getByRole('button', { name: 'Type KCH at WXC' }).click()
  await panel(page).getByRole('button', { name: 'Decipher the message' }).click()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test.describe('copying the ciphertext into the whole-message box', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  for (const how of ['select it with a click', 'the Copy button'] as const) {
    test(`deciphers when copied with ${how}`, async ({ page }) => {
      await openMachine(page, '2d')
      await panel(page)
        .getByRole('button', { name: /Operation Barbarossa/ })
        .click()
      if (how === 'the Copy button') {
        await panel(page).getByRole('button', { name: 'Copy ciphertext' }).click()
      } else {
        await page.getByTestId('real-ciphertext').click() // one click selects all of it
        await page.keyboard.press('ControlOrMeta+c')
      }
      expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
        /^EDPUD NRGYS .* DPBOP VHJK\s*$/,
      )

      for (const [slot, letter] of [
        ['Left', 'b'],
        ['Middle', 'l'],
        ['Right', 'a'],
      ]) {
        await rotor(page, slot).focus()
        await page.keyboard.press(letter)
      }
      await page.getByLabel('Encipher or decipher a whole message').focus()
      await page.keyboard.press('ControlOrMeta+v')
      await page.getByRole('button', { name: 'Run through machine' }).click()
      await expect(tapeOutput(page)).toHaveText(/^AUFKL XABTE ILUNG .* XINFX RGTX$/)
    })
  }
})
