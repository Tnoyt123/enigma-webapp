import { useState, type FormEvent } from 'react'
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
      <dl className="mt-2 flex flex-col gap-2 font-mono text-sm">
        <div>
          <dt className="font-sans font-semibold">Typed</dt>
          <dd
            data-testid="tape-input"
            tabIndex={0}
            className="max-h-24 overflow-y-auto break-words focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
          >
            {toGroups(tape.input) || <span className="font-sans text-stone-600">Nothing yet.</span>}
          </dd>
        </div>
        <div>
          <dt className="font-sans font-semibold">Lit</dt>
          <dd
            data-testid="tape-output"
            tabIndex={0}
            className="max-h-24 overflow-y-auto break-words focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
          >
            {toGroups(tape.output) || (
              <span className="font-sans text-stone-600">Nothing yet.</span>
            )}
          </dd>
        </div>
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
