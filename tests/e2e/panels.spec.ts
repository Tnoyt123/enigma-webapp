import { expect, test } from '@playwright/test'
import { openMachine } from './helpers.ts'

// The panels beside (or below) the machine: folding, the folded summaries, and the layout.
// Panels are the same in both views, so these run in the lighter 2D view.

test('a folded key sheet shows the setup on one line, and stays folded after a reload', async ({
  page,
}) => {
  await openMachine(page, '2d')
  await page.getByLabel(/Plugboard pairs/).fill('AV BS')
  await page.keyboard.press('Tab')
  const fold = page.getByRole('button', { name: 'Key sheet' })
  await expect(fold).toHaveAttribute('aria-expanded', 'true')

  await fold.click()
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Left rotor', { exact: true })).toBeHidden()
  await expect(page.getByTestId('keysheet-summary')).toHaveText(
    'Enigma I · UKW-B · I II III · rings 01 01 01 · plugs AV BS',
  )

  await page.reload()
  await expect(page.getByRole('button', { name: 'Key sheet' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await page.getByRole('button', { name: 'Key sheet' }).click()
  await expect(page.getByLabel('Left rotor', { exact: true })).toBeVisible()
  await expect(page.getByTestId('keysheet-summary')).toHaveCount(0)
})

test('every panel folds, and a half-filled form survives folding', async ({ page }) => {
  await openMachine(page, '2d')
  const radio = page.getByRole('region', { name: 'Radio message' })
  // By role: a textarea inside its label would count its own text as part of the label.
  const message = radio.getByRole('textbox', { name: 'Message', exact: true })
  await message.fill('ANGRIFF')
  for (const name of ['How it works', 'Message tape', 'Radio message']) {
    const fold = page.getByRole('button', { name, exact: true })
    await fold.click()
    await expect(fold).toHaveAttribute('aria-expanded', 'false')
  }
  await expect(page.getByRole('switch', { name: /X-ray/ })).toBeHidden()
  await expect(page.getByText('Nothing typed yet.')).toBeVisible() // the folded tape's summary

  await page.getByRole('button', { name: 'Radio message', exact: true }).click()
  await expect(message).toHaveValue('ANGRIFF')
})

test('the list of steps folds separately, and is remembered', async ({ page }) => {
  await openMachine(page, '2d')
  await page.keyboard.press('a')
  const steps = page.getByRole('list', { name: 'Path of the current' })
  await expect(steps).toBeHidden()
  await page.getByRole('button', { name: 'All 13 steps' }).click()
  await expect(steps).toBeVisible()
  await openMachine(page, '2d') // a fresh visit on this device
  await page.keyboard.press('a')
  await expect(steps).toBeVisible()
})

test('the tape sits right under the machine', async ({ page }) => {
  await openMachine(page, '2d')
  const machine = await page.getByRole('region', { name: /machine$/ }).boundingBox()
  const tape = await page.getByRole('region', { name: 'Message tape' }).boundingBox()
  expect(tape!.y).toBeGreaterThan(machine!.y + machine!.height)
  expect(tape!.y).toBeLessThan(machine!.y + machine!.height + 40)
})

test('on a wide screen the panels scroll by themselves and the machine stays in view', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'the panels follow the machine on phones')
  await openMachine(page, '2d')
  const howItWorks = page.getByRole('region', { name: 'How it works' })
  await howItWorks.hover()
  await page.mouse.wheel(0, 400)
  // The panels scrolled, not the page.
  await expect(howItWorks).not.toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  // Scrolling on past their end (a second gesture: one gesture stays with the panels) moves the
  // page just enough to show the last panel's foot, and the machine is still in view.
  await page.mouse.wheel(0, 3000)
  await page.waitForTimeout(300)
  await page.mouse.wheel(0, 400)
  await expect(page.getByRole('button', { name: 'Prepare message' })).toBeInViewport()
  await expect(page.getByRole('region', { name: /machine$/ })).toBeInViewport({ ratio: 0.5 })
})
