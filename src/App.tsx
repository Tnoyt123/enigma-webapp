import { KeySheet } from './panels/KeySheet.tsx'
import { MessageTape } from './panels/MessageTape.tsx'
import { LiveAnnouncer } from './ui2d/LiveAnnouncer.tsx'
import { Machine2D } from './ui2d/Machine2D.tsx'
import { usePhysicalKeyboard } from './ui2d/usePhysicalKeyboard.ts'

export default function App() {
  usePhysicalKeyboard()

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      <header className="mx-auto max-w-6xl px-4 pt-6 pb-4">
        <h1 className="font-serif text-3xl tracking-[0.3em]">ENIGMA</h1>
        <p className="mt-1 text-sm text-stone-300">
          Type on your keyboard or press the keys below. Set the machine up with the key sheet.
        </p>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Machine2D />
        <div className="flex flex-col gap-6">
          <KeySheet />
          <MessageTape />
        </div>
      </main>
      <LiveAnnouncer />
    </div>
  )
}
