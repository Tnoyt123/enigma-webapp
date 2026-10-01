import { expect, type Page } from '@playwright/test'
import type { View } from '../../src/app/view.ts'
// Brings in the window.__enigma3d test-hook type.
import type {} from '../../src/scene/E2EHooks.tsx'

export const VIEWS: readonly View[] = ['2d', '3d']

export const tapeInput = (page: Page) => page.getByTestId('tape-input')
export const tapeOutput = (page: Page) => page.getByTestId('tape-output')
export const rotor = (page: Page, slot: string) =>
  page.getByRole('spinbutton', { name: new RegExp(`^${slot} rotor`) })

/** Opens the app in `view` and waits until that view's machine is ready to use. */
export async function openMachine(page: Page, view: View) {
  await page.goto(`/?view=${view}&e2e`)
  await expect(page).toHaveTitle('Enigma Machine')
  if (view === '3d') {
    await page.waitForFunction(() => window.__enigma3d?.screenPoint('key-A') != null)
  } else {
    await expect(page.getByRole('region', { name: /machine$/ })).toBeVisible()
  }
}

/** Page coordinates of a named part of the 3D model (e.g. "key-A", "socket-V", "thumbwheel-2"). */
export async function point3d(page: Page, name: string) {
  const p = await page.evaluate((n) => window.__enigma3d?.screenPoint(n) ?? null, name)
  if (!p) throw new Error(`3D part ${name} not found`)
  return p
}

/** Puts the pointer down on an on-screen key, the way a mouse or finger user would. */
export async function pointerDownOnKey(page: Page, view: View, letter: string) {
  if (view === '2d') {
    await page.getByRole('button', { name: `Key ${letter}` }).hover()
  } else {
    const { x, y } = await point3d(page, `key-${letter}`)
    await page.mouse.move(x, y)
  }
  await page.mouse.down()
}

/** Clicks a plugboard socket with the pointer. */
export async function clickSocket(page: Page, view: View, letter: string) {
  if (view === '2d') {
    await page.getByRole('button', { name: new RegExp(`^Socket ${letter},`) }).click()
  } else {
    const { x, y } = await point3d(page, `socket-${letter}`)
    await page.mouse.click(x, y)
  }
}
