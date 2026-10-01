import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  clickSocket,
  openMachine,
  point3d,
  pointerDownOnKey,
  rotor,
  tapeInput,
  tapeOutput,
  VIEWS,
} from './helpers.ts'

// Every behaviour must work the same in both views: this suite runs once per view.
for (const view of VIEWS) {
  test.describe(`${view.toUpperCase()} view`, () => {
    test.beforeEach(async ({ page }) => {
      await openMachine(page, view)
    })

    test('typing on the physical keyboard enciphers and steps the rotors', async ({ page }) => {
      for (const key of ['a', 'a', 'a', 'a', 'A']) await page.keyboard.press(key)
      await expect(tapeInput(page)).toHaveText('AAAAA')
      await expect(tapeOutput(page)).toHaveText('BDZGO')
      await expect(rotor(page, 'Right')).toHaveAttribute('aria-valuetext', 'F')
    })

    test('the lamp stays lit only while an on-screen key is held', async ({ page }) => {
      const lampB = page.locator('[data-lamp="B"]')
      await pointerDownOnKey(page, view, 'A')
      await expect(lampB).toHaveAttribute('data-lit', 'true')
      await page.mouse.up()
      await expect(lampB).not.toHaveAttribute('data-lit')
      await expect(tapeOutput(page)).toHaveText('B')
    })

    test('keyboard-only: on-screen keys move with arrows and press with Enter', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Key Q' }).focus()
      await page.keyboard.press('ArrowDown') // Q → A
      await page.keyboard.press('Enter')
      await expect(tapeInput(page)).toHaveText('A')
      const keyA = page.getByRole('button', { name: 'Key A' })
      await expect(keyA).toBeFocused()
      await expect(keyA).toBeInViewport() // focused controls are visible, in 3D too
    })

    test('rotor windows are spinbuttons: arrows and letters set the position', async ({ page }) => {
      const left = rotor(page, 'Left')
      await left.focus()
      await page.keyboard.press('ArrowUp')
      await expect(left).toHaveAttribute('aria-valuetext', 'B')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await expect(left).toHaveAttribute('aria-valuetext', 'Z')
      await page.keyboard.press('q')
      await expect(left).toHaveAttribute('aria-valuetext', 'Q')
      await expect(tapeInput(page)).toHaveText(/Nothing yet/) // letters didn't press machine keys
    })

    test('plugboard: clicking two sockets connects them, clicking again unplugs', async ({
      page,
    }) => {
      await clickSocket(page, view, 'A')
      await expect(page.getByRole('button', { name: 'Socket A, empty' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await clickSocket(page, view, 'V')
      await expect(page.getByRole('button', { name: 'Socket A, plugged to V' })).toHaveCount(1)
      await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('AV')
      await clickSocket(page, view, 'V')
      await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('')
    })

    test('plugboard text field reports invalid pairs', async ({ page }) => {
      const field = page.getByLabel(/Plugboard pairs/)
      await field.fill('AB BC')
      await field.press('Enter')
      await expect(page.getByRole('alert')).toHaveText(/socket B is used by two cables/)
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      await field.fill('AB CD')
      await field.press('Enter')
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Socket C, plugged to D' })).toHaveCount(1)
    })

    test('decrypts the 1941 Barbarossa message set up entirely through the UI', async ({
      page,
    }) => {
      await page.getByLabel('Left rotor', { exact: true }).selectOption('II')
      await page.getByLabel('Middle rotor', { exact: true }).selectOption('IV')
      await page.getByLabel('Right rotor', { exact: true }).selectOption('V')
      await page.getByLabel('Left ring setting').selectOption({ label: 'B · 02' })
      await page.getByLabel('Middle ring setting').selectOption({ label: 'U · 21' })
      await page.getByLabel('Right ring setting').selectOption({ label: 'L · 12' })
      await page.getByLabel(/Plugboard pairs/).fill('AV BS CG DL FU HZ IN KM OW RX')
      for (const [slot, letter] of [
        ['Left', 'b'],
        ['Middle', 'l'],
        ['Right', 'a'],
      ]) {
        await rotor(page, slot).focus()
        await page.keyboard.press(letter)
      }
      await page
        .getByLabel('Encipher or decipher a whole message')
        .fill('EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE')
      await page.getByRole('button', { name: 'Run through machine' }).click()
      await expect(tapeOutput(page)).toHaveText('AUFKL XABTE ILUNG XVONX KURTI NOWAX KURTI NOWAX')

      await page.getByRole('button', { name: 'Reset rotors to BLA' }).click()
      await expect(rotor(page, 'Middle')).toHaveAttribute('aria-valuetext', 'L')
      await expect(tapeOutput(page)).toHaveText(/Nothing yet/)
    })

    test('switching to the M4 adds the thin rotor', async ({ page }) => {
      await page.getByLabel(/Enigma M4/).check()
      await expect(page.getByRole('spinbutton')).toHaveCount(4)
      await expect(rotor(page, 'Thin')).toHaveAccessibleName('Thin rotor (Beta)')
      await expect(page.getByLabel(/Reflector/)).toHaveValue('B-thin')
      if (view === '3d') await point3d(page, 'thumbwheel-3') // the model has a fourth rotor too
    })

    test('has no automatically detectable accessibility violations', async ({ page }) => {
      await page.keyboard.press('a') // fill the tape and enable its buttons
      await clickSocket(page, view, 'A')
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  })
}

test.describe('3D model', () => {
  test.beforeEach(async ({ page }) => {
    await openMachine(page, '3d')
  })

  test('clicking a thumbwheel turns the rotor forward; shift-click turns it back', async ({
    page,
  }) => {
    const { x, y } = await point3d(page, 'thumbwheel-2')
    await page.mouse.click(x, y)
    await page.mouse.click(x, y)
    await expect(rotor(page, 'Right')).toHaveAttribute('aria-valuetext', 'C')
    await page.keyboard.down('Shift')
    await page.mouse.click(x, y)
    await page.keyboard.up('Shift')
    await expect(rotor(page, 'Right')).toHaveAttribute('aria-valuetext', 'B')
  })

  test('camera presets are toggle buttons', async ({ page }) => {
    const rotors = page.getByRole('button', { name: 'Rotors', exact: true })
    await rotors.click()
    await expect(rotors).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Operator', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
