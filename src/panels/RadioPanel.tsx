import { useId, useState, type FormEvent, type ReactNode } from 'react'
import {
  ALPHABET,
  PROCEDURES,
  receiveMessage,
  sendMessage,
  toGroups,
  type ProcedureId,
  type ProcedureStep,
  type RadioMessage,
  type ReceivedMessage,
} from '../engine/index.ts'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { announce } from '../ui2d/announce.ts'
import { Panel } from './Panel.tsx'

const button =
  'rounded border border-stone-500 bg-white px-3 py-1 text-sm font-semibold text-stone-900 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600'
const field =
  'rounded border border-stone-400 bg-white px-2 py-1 font-mono text-stone-900 uppercase focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600'

const randomLetters = (n: number) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * 26)]).join('')

const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Sending and receiving radio messages the way operators did: the indicator procedure of the
 * period, the header line, and the text in groups. Shared by both views.
 */
export function RadioPanel() {
  const model = useMachine((s) => s.config.model)
  const procedures = Object.values(PROCEDURES).filter((p) => p.models.includes(model))
  const [chosen, setChosen] = useState<ProcedureId>(procedures[procedures.length - 1].id)
  // Switching model can leave the chosen procedure unavailable: fall back to the model's latest.
  const procedure = procedures.some((p) => p.id === chosen)
    ? chosen
    : procedures[procedures.length - 1].id
  const [tab, setTab] = useState<'send' | 'receive'>('send')
  const ids = { send: useId(), receive: useId() }

  return (
    <Panel id="radio" title="Radio message">
      <label className="mt-2 flex flex-col gap-1 text-sm">
        <span className="font-semibold">Procedure</span>
        <select
          className="rounded border border-stone-400 bg-white px-2 py-1"
          value={procedure}
          onChange={(e) => setChosen(e.target.value as ProcedureId)}
        >
          {procedures.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.period})
            </option>
          ))}
        </select>
      </label>

      <div role="tablist" aria-label="Send or receive" className="mt-3 flex gap-1">
        {(['send', 'receive'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${ids[id]}-tab`}
            aria-selected={tab === id}
            aria-controls={ids[id]}
            onClick={() => setTab(id)}
            className="rounded-t border border-b-0 border-stone-400 px-3 py-1 text-sm font-semibold aria-selected:bg-white aria-[selected=false]:bg-stone-200 focus-visible:outline-2 focus-visible:outline-amber-600"
          >
            {id === 'send' ? 'Send' : 'Receive'}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={ids[tab]}
        aria-labelledby={`${ids[tab]}-tab`}
        className="rounded-b rounded-tr border border-stone-400 bg-white p-3"
      >
        {tab === 'send' ? (
          <SendForm key={procedure} procedure={procedure} />
        ) : (
          <ReceiveForm key={procedure} procedure={procedure} />
        )}
      </div>
    </Panel>
  )
}

function SendForm({ procedure }: { procedure: ProcedureId }) {
  const config = useMachine((s) => s.config)
  const naval = procedure === 'naval'
  const startLength = naval ? config.rotors.length : 3
  const [grund, setGrund] = useState(() => randomLetters(startLength))
  const [key, setKey] = useState(() => randomLetters(3))
  const [kenngruppe, setKenngruppe] = useState(() => randomLetters(3))
  const [text, setText] = useState('')
  const [result, setResult] = useState<RadioMessage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      const message = sendMessage({
        procedure,
        config,
        plaintext: text,
        grundstellung: grund,
        messageKey: key,
        kenngruppe: procedure === 'doubled-1938' ? undefined : kenngruppe,
        time: nowHHMM(),
      })
      setResult(message)
      setError(null)
      announce('Message prepared. The steps and the radio message are below the form.')
    } catch (err) {
      setResult(null)
      setError((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-sm">
      <LetterField
        label={naval ? 'Grundstellung (from the key sheet)' : 'Start position (your choice)'}
        value={grund}
        length={startLength}
        onChange={setGrund}
        onRandom={naval ? undefined : () => setGrund(randomLetters(3))}
      />
      <LetterField
        label={naval ? 'Message trigram (Kenngruppenbuch)' : 'Message key (your choice)'}
        value={key}
        length={3}
        onChange={setKey}
        onRandom={() => setKey(randomLetters(3))}
      />
      {procedure !== 'doubled-1938' && (
        <LetterField
          label={naval ? 'Key-net trigram (Kenngruppenbuch)' : 'Key identification group'}
          value={kenngruppe}
          length={3}
          onChange={setKenngruppe}
          onRandom={() => setKenngruppe(randomLetters(3))}
        />
      )}
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Message</span>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${field} p-2`}
          placeholder="e.g. ANGRIFF UM DREI UHR"
        />
      </label>
      <button type="submit" className={`${button} self-start`}>
        Prepare message
      </button>
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      {result && (
        <Result header={result.header} body={result.body} steps={result.steps}>
          <p className="text-stone-700">
            Message key: <span className="font-mono font-semibold">{result.messageKey}</span>
          </p>
        </Result>
      )}
    </form>
  )
}

function ReceiveForm({ procedure }: { procedure: ProcedureId }) {
  const config = useMachine((s) => s.config)
  const naval = procedure === 'naval'
  const [header, setHeader] = useState('')
  const [body, setBody] = useState('')
  const [grund, setGrund] = useState('')
  const [hasKenngruppe, setHasKenngruppe] = useState(true)
  const [result, setResult] = useState<ReceivedMessage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      const received = receiveMessage({
        procedure,
        config,
        header,
        body,
        grundstellung: grund,
        kenngruppe: hasKenngruppe,
      })
      setResult(received)
      setError(null)
      announce(`Deciphered with message key ${received.messageKey}.`)
    } catch (err) {
      setResult(null)
      setError((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-sm">
      {naval ? (
        <LetterField
          label="Grundstellung (from the key sheet)"
          value={grund}
          length={config.rotors.length}
          onChange={setGrund}
        />
      ) : (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Header</span>
          <input
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            className={field}
            placeholder={
              procedure === 'army-1940' ? 'e.g. 1840 – 179 – WXC KCH –' : 'e.g. 0915 – 31 – WZA –'
            }
            spellCheck={false}
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Message text</span>
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${field} p-2`}
          spellCheck={false}
        />
      </label>
      {procedure === 'army-1940' && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasKenngruppe}
            onChange={(e) => setHasKenngruppe(e.target.checked)}
            className="accent-amber-700"
          />
          The text starts with an identification group
        </label>
      )}
      <button type="submit" className={`${button} self-start`}>
        Decipher
      </button>
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      {result && (
        <Result steps={result.steps}>
          <p>
            <span className="font-semibold">Plaintext: </span>
            <span className="font-mono break-words" data-testid="received-plaintext">
              {toGroups(result.plaintext)}
            </span>
          </p>
        </Result>
      )}
    </form>
  )
}

function LetterField({
  label,
  value,
  length,
  onChange,
  onRandom,
}: {
  label: string
  value: string
  length: number
  onChange: (value: string) => void
  onRandom?: () => void
}) {
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-1 flex-col gap-1">
        <span className="font-semibold">{label}</span>
        <input
          value={value}
          maxLength={length}
          onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          className={`${field} w-24`}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      {onRandom && (
        <button
          type="button"
          className={button}
          onClick={onRandom}
          aria-label={`Random ${label.toLowerCase()}`}
        >
          Random
        </button>
      )}
    </div>
  )
}

/** The prepared or deciphered message, with the operator's steps to try on the machine. */
function Result({
  header,
  body,
  steps,
  children,
}: {
  header?: string
  body?: string
  steps: readonly ProcedureStep[]
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-stone-300 pt-2">
      {header !== undefined && body !== undefined && (
        <div>
          <p className="font-semibold">As transmitted</p>
          <pre
            data-testid="radio-message"
            tabIndex={0}
            className="overflow-x-auto rounded bg-stone-100 p-2 font-mono text-xs break-words whitespace-pre-wrap focus-visible:outline-2 focus-visible:outline-amber-600"
          >
            {header}
            {'\n'}
            {body}
          </pre>
          <button
            type="button"
            className={`${button} mt-1`}
            onClick={async () => {
              await navigator.clipboard.writeText(`${header}\n${body}`)
              setCopied(true)
              announce('Message copied.')
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? 'Copied' : 'Copy message'}
          </button>
        </div>
      )}
      {children}
      <ol className="flex flex-col gap-2" aria-label="Operator's steps">
        {steps.map((step, i) => (
          <li key={i} className="border-l-4 border-amber-600 pl-2">
            <span className="font-semibold">
              {i + 1}. {step.title}
            </span>
            <span className="block text-stone-700">{step.detail}</span>
            {step.setPositions && (
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-amber-900 underline"
                onClick={() => {
                  machineStore.getState().setPositions(step.setPositions!)
                  announce(`Rotors set to ${[...step.setPositions!].join(' ')}.`)
                }}
              >
                Set the rotors to {step.setPositions}
                {step.type && step.type.input.length <= 6
                  ? ` and try typing ${step.type.input}`
                  : ''}
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
