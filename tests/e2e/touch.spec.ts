import { expect, test, type Page } from '@playwright/test'
import { openMachine, tapeInput } from './helpers.ts'

// Real touch gestures (start, hold, move, end) through Chrome's DevTools protocol, on a phone.
test.skip(({ isMobile }) => !isMobile, 'touch behaviour is tested on the mobile project')

type Point = { x: number; y: number }

async function centre(page: Page, selector: string): Promise<Point> {
  const el = page.locator(selector).first()
  await el.scrollIntoViewIfNeeded()
  const b = (await el.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Touches `from`, optionally rests `holdMs`, then moves in steps to `to` and lifts. */
async function touchGesture(page: Page, from: Point, to: Point, holdMs = 0) {
  const cdp = await page.context().newCDPSession(page)
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] })
  await send('touchStart', from)
  if (holdMs) await page.waitForTimeout(holdMs)
  for (let i = 1; i <= 10; i++) {
    await send('touchMove', {
      x: from.x + ((to.x - from.x) * i) / 10,
      y: from.y + ((to.y - from.y) * i) / 10,
    })
    await page.waitForTimeout(16)
  }
  await send('touchEnd')
  await cdp.detach()
}

test.beforeEach(async ({ page }) => {
  await openMachine(page, '2d')
})

test('a tap on a key types it', async ({ page }) => {
  await page.getByRole('button', { name: 'Key A' }).tap()
  await expect(tapeInput(page)).toHaveText('A')
})

test('a swipe that starts on the keyboard scrolls the page and types nothing', async ({ page }) => {
  const key = await centre(page, '[aria-label="Key G"]')
  const before = await page.evaluate(() => scrollY)
  await touchGesture(page, key, { x: key.x, y: key.y - 200 })
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
  await expect(tapeInput(page)).toHaveText(/Nothing yet/)
})

test('a swipe across the plugboard scrolls the page and plugs nothing', async ({ page }) => {
  const socketA = await centre(page, '[data-socket="A"]')
  const before = await page.evaluate(() => scrollY)
  await touchGesture(page, socketA, { x: socketA.x, y: socketA.y - 200 })
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
  await expect(page.locator('[data-socket][aria-pressed="true"]')).toHaveCount(0)
  await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('')
})

test('a long press then drag lays a cable', async ({ page }) => {
  const a = await centre(page, '[data-socket="A"]')
  const v = await centre(page, '[data-socket="V"]')
  const before = await page.evaluate(() => scrollY)
  await touchGesture(page, a, v, 500)
  await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('AV')
  expect(await page.evaluate(() => scrollY)).toBe(before) // dragging, not scrolling
})

test('a long press then drag moves a rotor from the box into a slot', async ({ page }) => {
  await page.getByRole('button', { name: 'Open the lid' }).tap()
  const iv = await centre(page, 'button[aria-label^="Rotor IV, in the box"]')
  const right = await centre(page, '[data-rotor-slot="2"]')
  await touchGesture(page, iv, right, 500)
  await expect(page.getByLabel('Right rotor', { exact: true })).toHaveValue('IV')
})

test('tapping two sockets connects them', async ({ page }) => {
  await page.locator('[data-socket="Q"]').tap()
  await page.locator('[data-socket="W"]').tap()
  await expect(page.getByLabel(/Plugboard pairs/)).toHaveValue('QW')
})
