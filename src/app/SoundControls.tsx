import { soundStore, useSound } from '../audio/sound.ts'

/** Sound on/off and volume, in the header. */
export function SoundControls() {
  const enabled = useSound((s) => s.enabled)
  const volume = useSound((s) => s.volume)
  const { setEnabled, setVolume } = soundStore.getState()

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => setEnabled(!enabled)}
        className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-1 text-sm font-semibold text-stone-200 hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-amber-300 aria-pressed:text-amber-300"
      >
        <span aria-hidden="true">{enabled ? '🔊' : '🔇'} </span>
        Sound
      </button>
      <input
        type="range"
        aria-label="Volume"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        disabled={!enabled}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-20 accent-amber-400 disabled:opacity-40"
      />
    </div>
  )
}
