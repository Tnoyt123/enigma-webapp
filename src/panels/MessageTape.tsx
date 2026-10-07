import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toGroups, toLetter } from '../engine/index.ts'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { announce } from '../ui2d/announce.ts'
import { Panel } from './Panel.tsx'

const button =
  'rounded border border-stone-500 bg-white px-3 py-1 text-sm font-semibold text-stone-900 hover:bg-stone-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600'

/** What went in and what lit up, in five-letter groups, plus whole-message encipherment. */
export function MessageTape() {
  const tape = useMachine((s) => s.tape)
  const { encipherText, clearTape, resetToTapeStart } = machineStore.getState()
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const output = encipherText(text)
    announce(
      output
        ? `Enciphered ${output.length} letters. The result is on the tape.`
        : 'There were no letters to encipher.',
    )
  }

  const copy = async () => {
    await navigator.clipboard.writeText(toGroups(tape.output))
    setCopied(true)
    announce('Output copied.')
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Panel id="tape" title="Message tape" summary={<TapeSummary />}>
      <TapeStrip input={tape.input} output={tape.output} />
      {/* For screen readers: the typed and lit letters as two lines of five-letter groups. */}
      <dl className="sr-only">
        <dt>Typed</dt>
        <dd data-testid="tape-input">{toGroups(tape.input) || 'Nothing yet.'}</dd>
        <dt>Lit</dt>
        <dd data-testid="tape-output">{toGroups(tape.output) || 'Nothing yet.'}</dd>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={button} disabled={!tape.output} onClick={copy}>
          {copied ? 'Copied' : 'Copy output'}
        </button>
        <button
          type="button"
          className={button}
          disabled={!tape.start}
          onClick={() => {
            resetToTapeStart()
            announce('Rotors reset to where the tape started; tape cleared.')
          }}
        >
          Reset rotors to {tape.start ? tape.start.map(toLetter).join('') : 'start'}
        </button>
        <button
          type="button"
          className={button}
          disabled={!tape.input}
          onClick={() => {
            clearTape()
            announce('Tape cleared.')
          }}
        >
          Clear tape
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
        <label htmlFor="bulk-text" className="text-sm font-semibold">
          Encipher or decipher a whole message
        </label>
        <textarea
          id="bulk-text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="bulk-help"
          className="rounded border border-stone-400 bg-white p-2 font-mono text-sm text-stone-900 uppercase focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
        />
        <p id="bulk-help" className="text-xs text-stone-600">
          Letters run through the machine from the current rotor positions; everything else is
          skipped. Enigma is its own inverse: to decipher, set the same starting positions and enter
          the ciphertext.
        </p>
        <button type="submit" className={`${button} self-start`}>
          Run through machine
        </button>
      </form>
    </Panel>
  )
}

/**
 * The paper tape: five-letter groups, each lit letter printed under the key that lit it, the
 * newest pair marked. It scrolls to keep the newest letters in view.
 */
function TapeStrip({ input, output }: { input: string; output: string }) {
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (strip.current) strip.current.scrollTop = strip.current.scrollHeight
  }, [output])

  const groups: number[][] = []
  for (let i = 0; i < output.length; i += 5) {
    groups.push(Array.from({ length: Math.min(5, output.length - i) }, (_, j) => i + j))
  }
  const newest = output.length - 1

  return (
    <div aria-hidden="true" className="mt-2">
      <div className="mb-1 flex gap-4 text-xs text-stone-600">
        <span>
          <span className="font-mono">abc</span> typed
        </span>
        <span>
          <span className="font-mono font-bold text-stone-900">ABC</span> lit
        </span>
      </div>
      <div
        ref={strip}
        data-testid="tape-strip"
        className="max-h-40 overflow-y-auto rounded border border-dashed border-stone-400 bg-[repeating-linear-gradient(to_bottom,#fdf6e3_0,#fdf6e3_3.25rem,#f3e9cc_3.25rem,#f3e9cc_3.3rem)] px-3 py-2 font-mono"
      >
        {output.length === 0 ? (
          <p className="py-2 font-sans text-sm text-stone-500">
            Type on the machine: each key and the lamp it lights appear here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {groups.map((group) => (
              <div key={group[0]} className="flex">
                {group.map((i) => (
                  <span
                    key={i}
                    data-newest={i === newest || undefined}
                    className={`flex w-[1.35ch] flex-col items-center rounded-sm leading-tight ${
                      i === newest ? 'bg-amber-300' : ''
                    }`}
                  >
                    <span className="text-xs text-stone-500">{input[i].toLowerCase()}</span>
                    <span className="text-lg font-bold text-stone-900">{output[i]}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Shown while the tape is folded: how much is on it, and the latest lit letters. */
function TapeSummary() {
  const tape = useMachine((s) => s.tape)
  if (!tape.output) return <p>Nothing typed yet.</p>
  return (
    <p>
      {tape.output.length} {tape.output.length === 1 ? 'letter' : 'letters'}; lit:{' '}
      <span className="font-mono">{toGroups(tape.output.slice(-15))}</span>
    </p>
  )
}
