import { expect, test, type Page } from '@playwright/test'
import { openMachine, rotor, tapeOutput } from './helpers.ts'

const viewRadio = (page: Page, name: '2D' | '3D') =>
  page.getByRole('radio', { name: new RegExp(`^${name}`) })

/** Clicks the visible segment of the 2D | 3D control (the radio inside it is visually hidden). */
const switchTo = (page: Page, name: '2D' | '3D') =>
  page
    .locator('label')
    .filter({ has: viewRadio(page, name) })
    .click()

test('opens in 3D by default', async ({ page }) => {
  await page.goto('/')
  await expect(viewRadio(page, '3D')).toBeChecked()
  await expect(page.getByRole('region', { name: /machine, 3D$/ })).toBeVisible()
})

test('switching updates the URL and is remembered; the URL wins over the memory', async ({
  page,
}) => {
  await page.goto('/')
  await switchTo(page, '2D')
  await expect(page).toHaveURL(/\?view=2d$/)
  await expect(page.getByRole('region', { name: /machine$/ })).toBeVisible()

  await page.goto('/') // no parameter: the remembered choice applies
  await expect(viewRadio(page, '2D')).toBeChecked()

  await page.goto('/?view=3d') // an explicit link beats the memory
  await expect(viewRadio(page, '3D')).toBeChecked()
})

test('switching views keeps the machine state, including a half-plugged cable', async ({
  page,
}) => {
  await openMachine(page, '3d')
  for (const key of 'aaa') await page.keyboard.press(key)
  await page.getByRole('button', { name: 'Socket Q, empty' }).focus()
  await page.keyboard.press('Enter') // cable plugged into Q, other end loose

  await switchTo(page, '2D')
  await expect(tapeOutput(page)).toHaveText('BDZ')
  await expect(rotor(page, 'Right')).toHaveAttribute('aria-valuetext', 'D')
  await expect(page.getByRole('button', { name: 'Socket Q, empty' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Socket W, empty' }).click()

  await switchTo(page, '3D')
  await page.waitForFunction(() => window.__enigma3d?.screenPoint('key-A') != null)
  await expect(page.getByRole('button', { name: 'Socket Q, plugged to W' })).toHaveCount(1)
})

test('the 2D view never downloads the 3D code', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()))
  await openMachine(page, '2d')
  await page.keyboard.press('a')
  expect(scripts.some((url) => /Machine3D/.test(url))).toBe(false)

  await switchTo(page, '3D')
  await page.waitForFunction(() => window.__enigma3d != null)
  expect(scripts.some((url) => /Machine3D/.test(url))).toBe(true)
})

test('without WebGL the app falls back to 2D and explains why', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith('webgl')) return null
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof original
  })
  await page.goto('/?view=3d')
  await expect(page.getByRole('status')).toHaveText(/WebGL is unavailable/)
  await expect(viewRadio(page, '2D')).toBeChecked()
  await expect(viewRadio(page, '3D')).toBeDisabled()
  await expect(page.getByRole('region', { name: /machine$/ })).toBeVisible()
})

test('a rotor lifted out in one view is still in hand after switching', async ({ page }) => {
  await openMachine(page, '2d')
  await page.getByRole('button', { name: 'Open the lid' }).click()
  await page.getByRole('button', { name: /^Rotor IV, in the box/ }).focus()
  await page.keyboard.press('Enter')

  await switchTo(page, '3D')
  await page.waitForFunction(() => window.__enigma3d?.screenPoint('box-rotor-IV') != null)
  await expect(page.getByTestId('rotor-message')).toHaveText(
    'Holding rotor IV from the box. Choose a slot to put it in.',
  )
  await page.getByRole('button', { name: /^Right slot: rotor III/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Right rotor', { exact: true })).toHaveValue('IV')
})
