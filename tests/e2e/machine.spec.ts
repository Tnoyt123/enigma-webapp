import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  brightnessAround,
  clickSocket,
  openMachine,
  pathSegments,
  point3d,
  pointerDownOnKey,
  rotor,
  settled,
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

    test('x-ray draws the full path of the last key press', async ({ page }) => {
      await page.getByRole('switch', { name: /X-ray/ }).check()
      await page.keyboard.press('a')
      // 11 stages from key to lamp, plus the final hop into the lamp.
      await expect.poll(() => pathSegments(page, view)).toBe(12)
      await expect(
        page.getByRole('list', { name: 'Path of the current' }).getByRole('listitem'),
      ).toHaveCount(13)
      await page.getByRole('switch', { name: /X-ray/ }).uncheck()
      await expect.poll(() => pathSegments(page, view)).toBe(0)
    })

    test('step by step walks through a key press one stage at a time', async ({ page }) => {
      await page.getByRole('switch', { name: /X-ray/ }).check()
      await page.getByRole('switch', { name: /Step by step/ }).check()
      await page.keyboard.press('a')
      const position = page.getByTestId('step-position')
      const current = page.locator('[aria-current="step"]')
      await expect(position).toHaveText('Step 1 of 13')
      await expect(current).toContainText('Key A pressed: the rotors step')
      await expect.poll(() => pathSegments(page, view)).toBe(0)

      await page.getByRole('button', { name: 'Next ▶' }).click()
      await page.getByRole('button', { name: 'Next ▶' }).click()
      await expect(position).toHaveText('Step 3 of 13')
      await expect(current).toContainText('Entry wheel (in)')
      await expect.poll(() => pathSegments(page, view)).toBe(2)

      await page.getByRole('button', { name: '◀ Previous' }).click()
      await expect(current).toContainText('Plugboard (in)')

      await page.getByLabel('Speed').selectOption({ label: 'Fast' })
      await page.getByRole('button', { name: '▶ Play' }).click()
      await expect(position).toHaveText('Step 13 of 13', { timeout: 10_000 })
      await expect(current).toContainText('Lamp B lights')
      await expect.poll(() => pathSegments(page, view)).toBe(12)

      await page.keyboard.press('a') // a new key press starts its walkthrough again
      await expect(position).toHaveText('Step 1 of 13')
    })

    test('the page never scrolls sideways, even with x-ray on', async ({ page }) => {
      await page.getByRole('switch', { name: /X-ray/ }).check()
      await page.getByRole('switch', { name: /Step by step/ }).check()
      await page.keyboard.press('a')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })

    test('a double step is explained the moment it happens', async ({ page }) => {
      for (const [slot, letter] of [
        ['Middle', 'e'],
        ['Right', 'w'],
      ]) {
        await rotor(page, slot).focus()
        await page.keyboard.press(letter)
      }
      await page.locator('header').click()
      await page.keyboard.press('a') // AEW → BFX
      await expect(page.getByTestId('double-step-note')).toContainText(
        'The middle rotor (II) was showing E, its notch letter',
      )
      await expect(rotor(page, 'Middle')).toHaveAttribute('aria-valuetext', 'F')
      if (view === '2d') {
        await expect(rotor(page, 'Middle')).toHaveAttribute('data-double-step', 'true')
      } else {
        await point3d(page, 'window-glow-double')
      }
      await page.keyboard.press('a') // an ordinary press clears it
      await expect(page.getByTestId('double-step-note')).toHaveCount(0)
    })

    test('has no automatically detectable accessibility violations', async ({ page }) => {
      await page.getByRole('switch', { name: /X-ray/ }).check()
      await page.getByRole('switch', { name: /Step by step/ }).check()
      await page.keyboard.press('a') // fill the tape, enable its buttons, start a walkthrough
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

  test('x-ray looks the same whether switched on before or after the 3D view loads', async ({
    page,
  }) => {
    // Two camera moves and a remount with every material see-through: slow on a software GPU.
    test.slow()
    const rotorsCamera = async () => {
      await page.getByRole('button', { name: 'Rotors', exact: true }).click()
      await settled(page) // let the camera settle
    }
    // Switched on while the 3D view is showing (materials must be recompiled).
    await rotorsCamera()
    await page.getByRole('button', { name: 'X-ray', exact: true }).click()
    await page.waitForTimeout(500)
    const switchedOn = await brightnessAround(page, 'ring-1')

    // The 3D view mounted with x-ray already on (materials created see-through).
    await page
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: /^2D/ }) })
      .click()
    await page
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: /^3D/ }) })
      .click()
    await page.waitForFunction(() => window.__enigma3d?.screenPoint('ring-1') != null)
    await rotorsCamera()
    const mountedOn = await brightnessAround(page, 'ring-1')

    expect(Math.abs(switchedOn - mountedOn)).toBeLessThan(20)
  })

  test('renders only while something is moving', async ({ page }) => {
    const frames = () => page.evaluate(() => window.__enigma3d?.frames() ?? -1)
    // Wait (up to 5 s) for animations to finish — a quiet half-second — then count the frames
    // drawn in the following full second. Continuous rendering never goes quiet and fails.
    const idleFrames = async () => {
      const deadline = Date.now() + 5000
      let last = await frames()
      while (Date.now() < deadline) {
        await page.waitForTimeout(500)
        const now = await frames()
        if (now === last) break
        last = now
      }
      const before = await frames()
      await page.waitForTimeout(1000)
      return (await frames()) - before
    }
    expect(await idleFrames()).toBe(0)
    await page.keyboard.press('a') // key travel, lamp and rotor animate…
    expect(await idleFrames()).toBe(0) // …then the canvas goes quiet again
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
