import { lazy, Suspense, useEffect } from 'react'
import { startMachineSounds } from './audio/sound.ts'
import { SoundControls } from './app/SoundControls.tsx'
import { ViewSwitch } from './app/ViewSwitch.tsx'
import { KeySheet } from './panels/KeySheet.tsx'
import { MessageTape } from './panels/MessageTape.tsx'
import { RadioPanel } from './panels/RadioPanel.tsx'
import { SignalPanel } from './panels/SignalPanel.tsx'
import { useView } from './state/viewStore.ts'
import { LiveAnnouncer } from './ui2d/LiveAnnouncer.tsx'
import { Machine2D } from './ui2d/Machine2D.tsx'
import { RingDialog } from './ui2d/RingDialog.tsx'
import { usePhysicalKeyboard } from './ui2d/usePhysicalKeyboard.ts'

// Loaded on demand, so the 2D view never downloads three.js.
const Machine3D = lazy(() => import('./scene/Machine3D.tsx'))

export default function App() {
  usePhysicalKeyboard()
  useEffect(startMachineSounds, [])
  const view = useView((s) => s.view)
  const notice = useView((s) => s.notice)
  const dismissNotice = useView((s) => s.dismissNotice)

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      <header className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pt-6 pb-4">
        <div>
          <h1 className="font-serif text-3xl tracking-[0.3em]">ENIGMA</h1>
          <p className="mt-1 text-sm text-stone-300">
            Type on your keyboard or press the machine's keys. Set it up with the key sheet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SoundControls />
          <ViewSwitch />
        </div>
      </header>
      {notice && (
        <div
          role="status"
          className="mx-auto mb-4 flex max-w-6xl items-start justify-between gap-4 rounded-lg bg-amber-100 px-4 py-2 text-sm text-stone-900"
        >
          <p>{notice}</p>
          <button type="button" className="font-semibold underline" onClick={dismissNotice}>
            Dismiss
          </button>
        </div>
      )}
      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* The machine, with the tape it types onto right under it. */}
        <div className="flex min-w-0 flex-col gap-6">
          {view === '3d' ? (
            // While the 3D code downloads, the 2D machine stays usable.
            <Suspense fallback={<Machine2D />}>
              <Machine3D />
            </Suspense>
          ) : (
            <Machine2D />
          )}
          <MessageTape />
        </div>
        {/* On wide screens the panels scroll on their own, so the machine stays in view. */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <SignalPanel />
          <KeySheet />
          <RadioPanel />
        </div>
      </main>
      {view === '2d' && <RingDialog />}
      <LiveAnnouncer />
    </div>
  )
}
