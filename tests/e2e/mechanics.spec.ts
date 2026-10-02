import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  boxRotor,
  drag,
  keySheetRotor,
  openLid,
  openMachine,
  point3d,
  pointOf,
  rotor,
  rotorSlot,
  socket,
  tapeInput,
  thumbwheel,
  VIEWS,
} from './helpers.ts'

// Phase 5 hands-on mechanics, in both views.
for (const view of VIEWS) {
  test.describe(`${view.toUpperCase()} view`, () => {
    test.beforeEach(async ({ page }) => {
      await openMachine(page, view)
    })

    test('drag a rotor from the box into a slot', async ({ page }) => {
      await openLid(page, view)
      await drag(
        page,
        await pointOf(page, view, boxRotor('IV')),
        await pointOf(page, view, rotorSlot(2)),
      )
      await expect(keySheetRotor(page, 'Right')).toHaveValue('IV')
      await expect(page.getByTestId('rotor-message')).toHaveText(
        'Rotor IV is in the right slot; rotor III went back to the box.',
      )
    })

    test('a dragged rotor follows the pointer until it is dropped', async ({ page }) => {
      await openLid(page, view)
      const from = await pointOf(page, view, boxRotor('IV'))
      const to = await pointOf(page, view, rotorSlot(2))
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(
          from.x + ((mid.x - from.x) * i) / 6,
          from.y + ((mid.y - from.y) * i) / 6,
        )
      }
      // Something is under the pointer while dragging, close to where the pointer is.
      const carried =
        view === '2d'
          ? await page
              .getByTestId('rotor-ghost')
              .boundingBox()
              .then((b) => b && { x: b.x + b.width / 2, y: b.y + b.height / 2 })
          : await point3d(page, 'carried-rotor')
      expect(carried).not.toBeNull()
      expect(Math.hypot(carried!.x - mid.x, carried!.y - mid.y)).toBeLessThan(
        view === '2d' ? 4 : 60,
      )

      await page.mouse.move(to.x, to.y)
      await page.mouse.up()
      await expect(keySheetRotor(page, 'Right')).toHaveValue('IV')
      if (view === '2d') await expect(page.getByTestId('rotor-ghost')).toHaveCount(0)
      else
        expect(
          await page.evaluate(() => window.__enigma3d?.screenPoint('carried-rotor')),
        ).toBeNull()
    })

    test('while dragging, the drop target is outlined: yellow if it fits, red if not', async ({
      page,
    }) => {
      await page.getByLabel(/Enigma M4/).check()
      await openLid(page, view)
      const target = () =>
        view === '2d'
          ? page.evaluate(() => {
              const el = document.querySelector('[data-drop-target]') as HTMLElement | null
              return (
                el && {
                  target: Number(el.dataset.rotorSlot),
                  fits: el.dataset.dropTarget === 'fits',
                }
              )
            })
          : page.evaluate(() => {
              const t = window.__enigma3d!.dropTarget()
              return t.target === null ? null : t
            })
      const hold = async (rotor: string, slot: number) => {
        const from = await pointOf(page, view, boxRotor(rotor))
        const to = await pointOf(page, view, rotorSlot(slot))
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        for (let i = 1; i <= 8; i++) {
          await page.mouse.move(
            from.x + ((to.x - from.x) * i) / 8,
            from.y + ((to.y - from.y) * i) / 8,
          )
        }
      }

      await hold('Gamma', 3)
      await expect.poll(target).toEqual({ target: 3, fits: false })
      await page.mouse.up() // refused: still holding Gamma
      await page.getByRole('button', { name: 'Put rotor Gamma back' }).click()

      await hold('VI', 3)
      await expect.poll(target).toEqual({ target: 3, fits: true })
      if (view === '3d') await point3d(page, 'drop-phantom')
      await page.mouse.up()
      await expect(keySheetRotor(page, 'Right')).toHaveValue('VI')
      await expect.poll(target).toBeNull()
    })

    test('click a rotor, then another slot, to swap them', async ({ page }) => {
      await openLid(page, view)
      const left = await pointOf(page, view, rotorSlot(0))
      await page.mouse.click(left.x, left.y)
      await expect(page.getByTestId('rotor-message')).toContainText('Lifted rotor I')
      if (view === '3d') await page.waitForTimeout(800) // the rotor rises
      const right = await pointOf(page, view, rotorSlot(2))
      await page.mouse.click(right.x, right.y)
      await expect(keySheetRotor(page, 'Left')).toHaveValue('III')
      await expect(keySheetRotor(page, 'Right')).toHaveValue('I')
    })

    test('keyboard: Enter picks a rotor up, Enter on a slot puts it down, Escape puts it back', async ({
      page,
    }) => {
      await openLid(page, view)
      const fromBox = page.getByRole('button', { name: /^Rotor V, in the box/ })
      await fromBox.focus()
      await page.keyboard.press('Enter')
      await expect(fromBox).toHaveAttribute('aria-pressed', 'true')
      await page.keyboard.press('Escape')
      await expect(fromBox).toHaveAttribute('aria-pressed', 'false')

      await page.keyboard.press('Enter')
      await page.getByRole('button', { name: /^Middle slot: rotor II/ }).focus()
      await page.keyboard.press('Enter')
      await expect(keySheetRotor(page, 'Middle')).toHaveValue('V')
    })

    test('a ring setting travels with its rotor, and the key sheet follows', async ({ page }) => {
      await openLid(page, view)
      await page.getByRole('button', { name: 'Set ring for the left rotor (I)' }).click()
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp') // ring F
      await page.getByRole('button', { name: 'Done' }).click()
      if (view === '3d') await page.waitForTimeout(1200) // camera back over the rotors

      await drag(
        page,
        await pointOf(page, view, rotorSlot(0)),
        await pointOf(page, view, rotorSlot(2)),
      )
      await expect(keySheetRotor(page, 'Right')).toHaveValue('I')
      await expect(page.getByLabel('Right ring setting')).toHaveValue('5') // F went with rotor I
      await expect(page.getByLabel('Left ring setting')).toHaveValue('0') // III kept its A

      // Into the box and back out again: rotor I still has ring F.
      await drag(
        page,
        await pointOf(page, view, boxRotor('IV')),
        await pointOf(page, view, rotorSlot(2)),
      )
      await expect(page.getByRole('button', { name: /^Rotor I, in the box, ring F/ })).toHaveCount(
        1,
      )
      await drag(
        page,
        await pointOf(page, view, boxRotor('I')),
        await pointOf(page, view, rotorSlot(1)),
      )
      await expect(keySheetRotor(page, 'Middle')).toHaveValue('I')
      await expect(page.getByLabel('Middle ring setting')).toHaveValue('5')
    })

    test('the keys do nothing while a rotor is out of the machine', async ({ page }) => {
      await openLid(page, view)
      await page.getByRole('button', { name: /^Left slot: rotor I/ }).focus()
      await page.keyboard.press('Enter')
      await page.locator('header').click()
      await page.keyboard.press('a')
      await expect(tapeInput(page)).toHaveText(/Nothing yet/)
      await expect(page.getByTestId('rotor-message')).toContainText(
        'Put rotor I down before typing',
      )
      await page.getByRole('button', { name: 'Put rotor I back' }).click()
      await page.keyboard.press('a')
      await expect(tapeInput(page)).toHaveText('A')
    })

    test('the model rules still apply: a thin rotor only fits the thin slot', async ({ page }) => {
      await page.getByLabel(/Enigma M4/).check()
      await openLid(page, view)
      await drag(
        page,
        await pointOf(page, view, boxRotor('Gamma')),
        await pointOf(page, view, rotorSlot(3)),
      )
      await expect(page.getByTestId('rotor-message')).toContainText(`Rotor "Gamma" can't be used`)
      await expect(keySheetRotor(page, 'Right')).toHaveValue('III')
    })

    test('set a ring in the close-up', async ({ page }) => {
      await openLid(page, view)
      await page.getByRole('button', { name: 'Set ring for the right rotor (III)' }).click()
      const ring = page.getByRole('spinbutton', { name: 'Ring setting, right rotor (III)' })
      await expect(ring).toBeFocused()
      await page.keyboard.press('ArrowUp')
      await page.keyboard.press('ArrowUp')
      await expect(ring).toHaveAttribute('aria-valuetext', 'C, 03')
      await expect(page.getByLabel('Right ring setting')).toHaveValue('2')
      await page.getByRole('button', { name: 'Forward ▶' }).click()
      await expect(ring).toHaveAttribute('aria-valuetext', 'D, 04')
      await page.getByRole('button', { name: 'Done' }).click()
      await expect(ring).toHaveCount(0)
    })

    test('drag a thumbwheel to turn a rotor several letters', async ({ page }) => {
      const wheel = await pointOf(page, view, thumbwheel(2, 'Right'))
      await drag(page, wheel, { x: wheel.x, y: wheel.y - 50 })
      await expect(rotor(page, 'Right')).toHaveAttribute('aria-valuetext', 'D')
      await drag(page, wheel, { x: wheel.x, y: wheel.y + 20 })
      await expect(rotor(page, 'Right')).toHaveAttribute('aria-valuetext', 'C')
    })

    test('drag a cable between sockets, then pull its plug out and move it', async ({ page }) => {
      if (view === '3d') {
        await page.getByRole('button', { name: 'Plugboard', exact: true }).click()
        await page.waitForTimeout(1500)
      }
      await drag(
        page,
        await pointOf(page, view, socket('A')),
        await pointOf(page, view, socket('V')),
      )
      await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('AV')
      await drag(
        page,
        await pointOf(page, view, socket('A')),
        await pointOf(page, view, socket('B')),
      )
      await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('VB')
      // Dropped nowhere near a socket: the loose cable is put away.
      await drag(page, await pointOf(page, view, socket('Q')), {
        x: (await pointOf(page, view, socket('Q'))).x,
        y: (await pointOf(page, view, socket('Q'))).y - 140,
      })
      await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('VB')
      await expect(page.getByRole('button', { name: 'Socket Q, empty' })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })

    test('no accessibility violations with the lid open and the ring close-up showing', async ({
      page,
    }) => {
      await openLid(page, view)
      await page.getByRole('button', { name: /^Rotor IV, in the box/ }).focus()
      await page.keyboard.press('Enter')
      let results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(results.violations).toEqual([])
      await page.keyboard.press('Escape')
      // Still a keyboard user: move to the ring button and press Enter.
      await page.getByRole('button', { name: 'Set ring for the left rotor (I)' }).focus()
      await page.keyboard.press('Enter')
      results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(results.violations).toEqual([])
    })
  })
}

test('2D: drag the ring dial round to change the ring setting', async ({ page }) => {
  await openMachine(page, '2d')
  await openLid(page, '2d')
  await page.getByRole('button', { name: 'Set ring for the left rotor (I)' }).click()
  const dial = (await page.getByTestId('ring-dial').boundingBox())!
  const cx = dial.x + dial.width / 2
  const top = { x: cx, y: dial.y + 10 }
  // Drag the top of the ring anticlockwise by about three letters: the ring advances.
  const a = (-3 * 2 * Math.PI) / 26
  const r = dial.height / 2 - 10
  const cy = dial.y + dial.height / 2
  await drag(page, top, { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r })
  await expect(page.getByRole('spinbutton', { name: /Ring setting, left rotor/ })).toHaveAttribute(
    'aria-valuetext',
    'D, 04',
  )
})

test('3D: scrolling over a thumbwheel turns it', async ({ page }) => {
  await openMachine(page, '3d')
  const wheel = await point3d(page, 'thumbwheel-1')
  await page.mouse.move(wheel.x, wheel.y)
  await page.mouse.wheel(0, -100)
  await expect(rotor(page, 'Middle')).toHaveAttribute('aria-valuetext', 'B')
  await page.mouse.wheel(0, 100)
  await page.mouse.wheel(0, 100)
  await expect(rotor(page, 'Middle')).toHaveAttribute('aria-valuetext', 'Z')
})
