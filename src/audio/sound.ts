import { createStore, useStore } from 'zustand'
import { machineStore } from '../state/machineStore.ts'

/**
 * Machine sounds: the key going down and coming up (a recorded mechanical key, from
 * public/sounds, built by scripts/build-sounds.py), the ratchet pawls turning each rotor that
 * steps (synthesized with the Web Audio API), and the lid's hinge (recorded,
 * public/sounds/lid-hinge.wav). Until the recordings have loaded, or if they
 * can't be, synthesized key sounds stand in.
 */

const STORAGE_KEY = 'enigma.sound'

interface SoundState {
  readonly enabled: boolean
  /** 0–1. */
  readonly volume: number
  setEnabled(on: boolean): void
  setVolume(volume: number): void
}

function readSaved(): { enabled: boolean; volume: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved.enabled === 'boolean' && typeof saved.volume === 'number')
      return saved
  } catch {
    // Unreadable or unavailable storage: use the defaults.
  }
  return { enabled: true, volume: 0.5 }
}

function save(state: { enabled: boolean; volume: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Not remembered between visits, but still works now.
  }
}

export const soundStore = createStore<SoundState>()((set, get) => ({
  ...readSaved(),
  setEnabled(enabled) {
    set({ enabled })
    save({ enabled, volume: get().volume })
  },
  setVolume(volume) {
    set({ volume })
    save({ enabled: get().enabled, volume })
  },
}))

export function useSound<T>(selector: (s: SoundState) => T): T {
  return useStore(soundStore, selector)
}

/** For browser tests (?e2e): the sounds that would have played. */
const played: string[] = []
if (typeof window !== 'undefined' && new URLSearchParams(location.search).has('e2e')) {
  const w = window as unknown as { __enigmaSounds: string[]; __enigmaSamples: () => string[] }
  w.__enigmaSounds = played
  w.__enigmaSamples = () => Object.keys(samples)
}

let context: AudioContext | null = null
let noise: AudioBuffer | null = null

type Sample = 'key-down' | 'key-up' | 'lid-hinge'
const SAMPLE_URLS: Record<Sample, string> = {
  'key-down': `${import.meta.env.BASE_URL}sounds/key-down.wav`,
  'key-up': `${import.meta.env.BASE_URL}sounds/key-up.wav`,
  'lid-hinge': `${import.meta.env.BASE_URL}sounds/lid-hinge.wav`,
}
const samples: Partial<Record<Sample, AudioBuffer>> = {}
let loading: Promise<void> | null = null

/**
 * Fetches and decodes the recorded key sounds. An offline context decodes without needing a user
 * gesture, so they're ready before the first key press; the buffers then play in the live context.
 */
export function loadSamples(): Promise<void> {
  if (typeof OfflineAudioContext === 'undefined') return Promise.resolve()
  loading ??= Promise.all(
    (Object.entries(SAMPLE_URLS) as [Sample, string][]).map(async ([name, url]) => {
      try {
        const response = await fetch(url)
        if (!response.ok) return
        const data = await response.arrayBuffer()
        samples[name] = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(data)
      } catch {
        // Keep the synthesized stand-in for this sound.
      }
    }),
  ).then(() => undefined)
  return loading
}

/**
 * Plays a decoded recording at the current volume, scaled by `level`; a `rate` below 1 plays it
 * slower and lower.
 */
function sample(buffer: AudioBuffer, at: number, { rate = 1, level = 1 } = {}) {
  const ctx = context!
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate
  const gain = ctx.createGain()
  gain.gain.value = soundStore.getState().volume * level
  source.connect(gain).connect(ctx.destination)
  source.start(at)
}

/** Created on first use, which is always inside a key press, as browsers require. */
function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  context ??= new AudioContext()
  if (context.state === 'suspended') void context.resume()
  if (!noise) {
    noise = context.createBuffer(1, context.sampleRate * 0.2, context.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return context
}

/** A short burst of filtered noise: the basic mechanical click. */
function click(
  at: number,
  filter: BiquadFilterType,
  frequency: number,
  q: number,
  length: number,
  gain: number,
) {
  const ctx = context!
  const source = ctx.createBufferSource()
  source.buffer = noise
  const band = ctx.createBiquadFilter()
  band.type = filter
  band.frequency.value = frequency
  band.Q.value = q
  const env = ctx.createGain()
  env.gain.setValueAtTime(gain * soundStore.getState().volume, at)
  env.gain.exponentialRampToValueAtTime(0.0001, at + length)
  source.connect(band).connect(env).connect(ctx.destination)
  source.start(at)
  source.stop(at + length + 0.02)
}

/** A low damped thump: the key bottoming out. */
function thump(at: number, frequency: number, length: number, gain: number) {
  const ctx = context!
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(frequency, at)
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.6, at + length)
  const env = ctx.createGain()
  env.gain.setValueAtTime(gain * soundStore.getState().volume, at)
  env.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(env).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

function play(name: string, render: (now: number) => void) {
  if (!soundStore.getState().enabled) return
  played.push(name)
  const ctx = audio()
  if (ctx && soundStore.getState().volume > 0) render(ctx.currentTime)
}

/** Key pressed: the key going down, then one ratchet click per rotor that steps. */
export function playKeyDown(steppedRotors: number) {
  play('key-down', (t) => {
    if (samples['key-down']) return sample(samples['key-down'], t)
    click(t, 'lowpass', 1800, 0.7, 0.05, 0.9)
    thump(t, 110, 0.08, 0.5)
  })
  for (let i = 0; i < steppedRotors; i++) {
    play('ratchet', (t) => click(t + 0.012 + i * 0.022, 'bandpass', 3400 - i * 300, 9, 0.03, 0.7))
  }
}

/** Key released. */
export function playKeyUp() {
  play('key-up', (t) => {
    if (samples['key-up']) return sample(samples['key-up'], t)
    click(t, 'highpass', 2600, 0.7, 0.025, 0.35)
  })
}

/** The lid's hinge, opening or closing. Recorded only: silent until the recording has loaded. */
export function playLidHinge(opening: boolean) {
  play(opening ? 'lid-open' : 'lid-close', (t) => {
    const recording = samples['lid-hinge']
    // Closing plays a little slower: a lower, longer squeak, so the two don't sound identical.
    if (recording) sample(recording, t, { rate: opening ? 1 : CLOSING_RATE, level: HINGE_LEVEL })
  })
}

/** Playback speed of the hinge as the lid closes: about three semitones lower. */
const CLOSING_RATE = 0.85
/** The hinge stays in the background: three-quarters of the keys' volume. */
const HINGE_LEVEL = 0.75

/** Plays the machine's sounds as keys go down and up and the lid opens and closes, from either view. */
export function startMachineSounds(): () => void {
  void loadSamples()
  return machineStore.subscribe((state, previous) => {
    if (state.lidOpen !== previous.lidOpen) playLidHinge(state.lidOpen)
    if (state.heldKey && !previous.heldKey && state.lastTrace) {
      playKeyDown(state.lastTrace.stepped.filter(Boolean).length)
    } else if (!state.heldKey && previous.heldKey) {
      playKeyUp()
    }
  })
}
