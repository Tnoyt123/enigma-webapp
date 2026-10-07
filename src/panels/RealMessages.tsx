import { useState } from 'react'
import {
  fromKeySheet,
  HISTORICAL_MESSAGES,
  MODELS,
  REFLECTORS,
  toGroups,
  type HistoricalMessage,
} from '../engine/index.ts'
import { machineStore } from '../state/machineStore.ts'
import { announce } from '../ui2d/announce.ts'
import { Panel } from './Panel.tsx'

const button =
  'rounded border border-stone-500 bg-white px-3 py-1 text-sm font-semibold text-stone-900 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600'

const store = () => machineStore.getState()

/**
 * Real wartime messages to decipher: choosing one sets the machine to the key it was sent on,
 * then the operator's steps run on the machine, so the result appears on the tape.
 */
export function RealMessages() {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const chosen = HISTORICAL_MESSAGES.find((m) => m.id === chosenId) ?? null

  const choose = (message: HistoricalMessage) => {
    // A message with an indicator starts where the operator did: at the Grundstellung.
    const start = message.indicator?.grundstellung ?? message.start
    store().loadSetup(fromKeySheet(message.key), start)
    setChosenId(message.id)
    announce(
      `${message.name}. The machine is set to its key, with the rotors at ${start}. The steps follow.`,
    )
  }

  return (
    <Panel id="real" title="Real messages">
      <p className="mt-2 text-sm text-stone-700">
        Decipher a real wartime message on the machine, set up with the key it was sent on.
      </p>
      <div className="mt-2 flex flex-col gap-1" role="group" aria-label="Messages">
        {HISTORICAL_MESSAGES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={m.id === chosenId}
            onClick={() => choose(m)}
            className="flex items-baseline justify-between gap-2 rounded border border-stone-400 bg-white px-3 py-1.5 text-left text-sm hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600 aria-pressed:border-amber-700 aria-pressed:bg-amber-100"
          >
            <span className="font-semibold">{m.title}</span>
            <span className="text-xs whitespace-nowrap text-stone-600">
              {MODELS[m.key.model].name} · {m.date}
            </span>
          </button>
        ))}
      </div>
      {chosen && <MessageCard key={chosen.id} message={chosen} />}
    </Panel>
  )
}

function MessageCard({ message }: { message: HistoricalMessage }) {
  const [keyResult, setKeyResult] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { key, indicator } = message

  const decipherKey = () => {
    store().setPositions(indicator!.grundstellung)
    store().clearTape()
    const out = store().encipherText(indicator!.encrypted)
    setKeyResult(out)
    announce(`${indicator!.encrypted} deciphers to ${out}: the message key.`)
  }

  const decipherMessage = () => {
    store().setPositions(message.start)
    store().clearTape()
    const out = store().encipherText(message.ciphertext)
    setResult(out)
    announce(
      out === message.plaintext
        ? `Deciphered ${out.length} letters. They match the published decryption.`
        : `Deciphered ${out.length} letters, but they don't match the published decryption.`,
    )
  }

  return (
    <article
      aria-label={message.name}
      className="mt-3 flex flex-col gap-2 border-t border-stone-300 pt-3 text-sm"
    >
      <p>{message.context}</p>
      <p className="text-xs text-stone-600">{message.source}</p>

      <p>
        <span className="font-semibold">Key sheet</span> (now set on the machine):{' '}
        <span className="font-mono text-xs">
          {[
            MODELS[key.model].name,
            REFLECTORS[key.reflector].name,
            key.rotors,
            `rings ${key.rings}`,
            `plugs ${key.plugboard}`,
          ].join(' · ')}
        </span>
      </p>
      {message.header && (
        <p>
          <span className="font-semibold">Header</span>{' '}
          <span className="font-mono text-xs">{message.header}</span>
        </p>
      )}
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Ciphertext</p>
          <button
            type="button"
            className="text-xs font-semibold text-amber-900 underline"
            onClick={async () => {
              await navigator.clipboard.writeText(message.ciphertext)
              setCopied(true)
              announce('Ciphertext copied.')
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? 'Copied' : 'Copy ciphertext'}
          </button>
        </div>
        {/* All of it shown, and one click selects exactly it: a drag-selection that ran on
            past the end would pick up the steps below, and those letters would be enciphered too. */}
        <p
          data-testid="real-ciphertext"
          className="rounded bg-stone-100 p-2 font-mono text-xs break-words select-all"
        >
          {message.ciphertext}
        </p>
      </div>

      <ol className="flex flex-col gap-2" aria-label="Operator's steps">
        {indicator && (
          <li className="border-l-4 border-amber-600 pl-2">
            <span className="font-semibold">1. Decipher the message key</span>
            <span className="block text-stone-700">
              The header's indicator {indicator.grundstellung} {indicator.encrypted}: with the
              rotors at {indicator.grundstellung}, typing {indicator.encrypted} gives the key the
              message was sent at.
            </span>
            <button type="button" className={`${button} mt-1`} onClick={decipherKey}>
              Type {indicator.encrypted} at {indicator.grundstellung}
            </button>
            {keyResult && (
              <span className="ml-2" data-testid="message-key-result">
                → <span className="font-mono font-bold">{keyResult}</span>
              </span>
            )}
          </li>
        )}
        <li className="border-l-4 border-amber-600 pl-2">
          <span className="font-semibold">
            {indicator ? '2. ' : ''}Set the rotors to {message.start} and type the message
          </span>
          <span className="block text-stone-700">
            Enigma is its own inverse: typing the ciphertext lights up the plaintext.
          </span>
          <button type="button" className={`${button} mt-1`} onClick={decipherMessage}>
            Decipher the message
          </button>
        </li>
      </ol>

      {result !== null && (
        <div data-testid="real-message-result">
          <p className="font-semibold">
            Plaintext{' '}
            {result === message.plaintext ? (
              <span className="font-normal text-green-800">✓ matches the published decryption</span>
            ) : (
              <span className="font-normal text-red-800">
                ✗ doesn't match the published decryption: was the setup changed?
              </span>
            )}
          </p>
          <p className="font-mono text-xs break-words">{toGroups(result)}</p>
          <p className="mt-1 text-xs text-stone-600">
            Operators wrote X for a full stop or a space, and spelled numbers out.
          </p>
        </div>
      )}
    </article>
  )
}
