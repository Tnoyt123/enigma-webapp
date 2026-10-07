import { expect, type Page } from '@playwright/test'
import type { View } from '../../src/app/view.ts'
// Brings in the window.__enigma3d test-hook type.
import type {} from '../../src/scene/E2EHooks.tsx'

export const VIEWS: readonly View[] = ['2d', '3d']

/**
 * Waits for the 3D scene to come to rest (camera, hatch, rotors) as seen on screen: until the
 * named parts stop moving. The camera's easing has a long, invisible tail, so waiting for the
 * canvas to stop drawing altogether would be needlessly slow, and fixed waits are too short on a
 * slow (software) GPU, where animations take longer than their nominal duration.
 */
export async function settled(page: Page, parts: readonly string[] = ['key-A', 'hatch-lid']) {
  const frames = () => page.evaluate(() => window.__enigma3d?.frames() ?? -1)
  const start = await frames()
  // First the motion must start: on a busy machine the first frame can take a while.
  await expect.poll(frames, { timeout: 5000 }).toBeGreaterThan(start)
  const where = () =>
    page.evaluate((names) => names.map((n) => window.__enigma3d?.screenPoint(n) ?? null), parts)
  const deadline = Date.now() + 25_000
  let frame = await frames()
  let last = await where()
  let still = 0
  while (Date.now() < deadline) {
    // Compare positions only across frames actually drawn: on a slow machine a frame can take
    // longer than any fixed polling interval.
    const quietUntil = Date.now() + 750
    let next = frame
    while (next === frame && Date.now() < quietUntil) {
      await page.waitForTimeout(50)
      next = await frames()
    }
    if (next === frame) return // nothing drawn for a while: the canvas is idle
    frame = next
    const now = await where()
    const moved = now.some(
      (p, i) => !p || !last[i] || Math.hypot(p.x - last[i]!.x, p.y - last[i]!.y) > 0.3,
    )
    still = moved ? 0 : still + 1
    if (still === 3) return
    last = now
  }
  throw new Error('the 3D scene never stopped moving')
}

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

/** Page coordinates of a named part of the 3D model (e.g. "key-A", "socket-V", "thumbwheel-grip-2"). */
export async function point3d(page: Page, name: string) {
  // The canvas renders on demand: let it draw the latest change first, because pointer hit
  // tests use where objects were last drawn (a part that just appeared isn't hittable until then).
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  )
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

/** Clicks a plugboard socket with the pointer (in 3D, from the plugboard camera view). */
export async function clickSocket(page: Page, view: View, letter: string) {
  if (view === '2d') {
    await page.getByRole('button', { name: new RegExp(`^Socket ${letter},`) }).click()
  } else {
    const plugboardView = page.getByRole('button', { name: 'Plugboard', exact: true })
    if ((await plugboardView.getAttribute('aria-pressed')) !== 'true') {
      await plugboardView.click()
      await settled(page) // the camera moves round to the front
    }
    const { x, y } = await point3d(page, `socket-${letter}`)
    await page.mouse.click(x, y)
  }
}

/** Number of signal-path segments the view is currently drawing. */
export async function pathSegments(page: Page, view: View): Promise<number> {
  return view === '2d'
    ? page.locator('[data-path-segment]').count()
    : page.evaluate(() => window.__enigma3d?.signalPath().segments ?? -1)
}

/** Mean brightness (0–255) of the screen in a small square around a named 3D part. */
export async function brightnessAround(page: Page, name: string, size = 24): Promise<number> {
  const { x, y } = await point3d(page, name)
  const png = await page.screenshot({
    clip: { x: x - size / 2, y: y - size / 2, width: size, height: size },
  })
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${base64}`)).blob(),
    )
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    let sum = 0
    for (let i = 0; i < data.length; i += 4)
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    return sum / (data.length / 4)
  }, png.toString('base64'))
}

/** Page point of a part, in either view: a CSS selector in 2D, a named 3D part in 3D. */
export async function pointOf(page: Page, view: View, part: { css: string; name3d: string }) {
  if (view === '3d') return point3d(page, part.name3d)
  await page.locator(part.css).first().scrollIntoViewIfNeeded()
  const box = await page.locator(part.css).first().boundingBox()
  if (!box) throw new Error(`${part.css} not visible`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Press at `from`, move in small steps to `to`, release: a real pointer drag. */
export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)
  }
  await page.mouse.up()
}

export const rotorSlot = (slot: number) => ({
  css: `[data-rotor-slot="${slot}"]`,
  name3d: `rotor-slot-${slot}`,
})
export const boxRotor = (rotor: string) => ({
  css: `button[aria-label^="Rotor ${rotor}, in the box"]`,
  name3d: `box-rotor-${rotor}`,
})
export const socket = (letter: string) => ({
  css: `[data-socket="${letter}"]`,
  name3d: `socket-${letter}`,
})
export const thumbwheel = (slot: number, slotName: string) => ({
  css: `[role="spinbutton"][aria-label^="${slotName} rotor"]`,
  // The top of the wheel: the rest is under the closed hatch, which blocks the pointer.
  name3d: `thumbwheel-grip-${slot}`,
})

/** Opens the lid and waits for the camera (3D) to settle on the rotors. */
export async function openLid(page: Page, view: View) {
  await page.getByRole('button', { name: 'Open the lid' }).click()
  if (view === '3d') await settled(page)
}

/** The rotor (I…VIII, Beta, Gamma) the key sheet shows in a slot. */
export const keySheetRotor = (page: Page, slotName: string) =>
  page.getByLabel(`${slotName} rotor`, { exact: true })
