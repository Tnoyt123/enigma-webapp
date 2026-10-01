import { useId, useState } from 'react'
import {
  ALPHABET,
  MODELS,
  parsePlugboard,
  REFLECTORS,
  ROTORS,
  validateConfig,
  type ModelId,
  type ReflectorId,
  type RotorId,
} from '../engine/index.ts'
import { machineStore, useMachine } from '../state/machineStore.ts'
import { slotNames } from '../ui2d/layout.ts'

const field =
  'rounded border border-stone-400 bg-white px-2 py-1 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600'

/** The day's settings, laid out like a key sheet: model, reflector, rotor order, rings, plugboard. */
export function KeySheet() {
  const config = useMachine((s) => s.config)
  const { setModel, setReflector, setRotor, setRing } = machineStore.getState()
  const model = MODELS[config.model]
  const names = slotNames(model.slots)

  return (
    <section
      aria-labelledby="keysheet-heading"
      className="rounded-xl bg-amber-50 p-4 text-stone-900 shadow-lg"
    >
      <h2 id="keysheet-heading" className="font-serif text-xl font-bold">
        Key sheet
      </h2>

      <fieldset className="mt-3">
        <legend className="text-sm font-semibold">Machine</legend>
        <div className="mt-1 flex flex-col gap-1">
          {Object.values(MODELS).map((m) => (
            <label key={m.id} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={config.model === m.id}
                onChange={() => setModel(m.id as ModelId)}
                className="mt-1 accent-amber-700"
              />
              <span>
                <span className="font-semibold">{m.name}</span>
                <span className="block text-stone-600">{m.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <span className="font-semibold">
          Reflector <span className="font-normal text-stone-600">(Umkehrwalze)</span>
        </span>
        <select
          className={field}
          value={config.reflector}
          onChange={(e) => setReflector(e.target.value as ReflectorId)}
        >
          {model.reflectors.map((id) => (
            <option key={id} value={id}>
              {REFLECTORS[id].name}
            </option>
          ))}
        </select>
      </label>

      <table className="mt-3 w-full text-left text-sm">
        <caption className="text-left font-semibold">
          Rotor order and rings{' '}
          <span className="font-normal text-stone-600">(Walzenlage, Ringstellung)</span>
        </caption>
        <thead>
          <tr className="text-stone-600">
            <th scope="col" className="py-1 font-normal">
              Slot
            </th>
            <th scope="col" className="py-1 font-normal">
              Rotor
            </th>
            <th scope="col" className="py-1 font-normal">
              Ring
            </th>
          </tr>
        </thead>
        <tbody>
          {config.rotors.map((rotor, slot) => {
            const thinSlot = model.slots === 4 && slot === 0
            const choices = thinSlot ? model.thinRotors : model.rotors
            return (
              <tr key={slot}>
                <th scope="row" className="py-1 font-semibold">
                  {names[slot]}
                </th>
                <td className="py-1">
                  <select
                    aria-label={`${names[slot]} rotor`}
                    className={field}
                    value={rotor}
                    onChange={(e) => setRotor(slot, e.target.value as RotorId)}
                  >
                    {choices.map((id) => (
                      <option key={id} value={id} title={ROTORS[id].note}>
                        {id}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1">
                  <select
                    aria-label={`${names[slot]} ring setting`}
                    className={field}
                    value={config.rings[slot]}
                    onChange={(e) => setRing(slot, Number(e.target.value))}
                  >
                    {[...ALPHABET].map((letter, i) => (
                      <option key={letter} value={i}>
                        {letter} · {String(i + 1).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {model.slots === 4 && (
        <p className="mt-1 text-xs text-stone-600">
          The thin rotor never steps; with ring and position A it makes the M4 behave like an M3.
        </p>
      )}

      <PlugboardField />
    </section>
  )
}

/** Text entry for plugboard pairs ("AV BS CG"), kept in sync with the clickable plugboard. */
function PlugboardField() {
  const config = useMachine((s) => s.config)
  const setPlugboard = useMachine((s) => s.setPlugboard)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  const check = (text: string) => validateConfig({ ...config, plugboard: parsePlugboard(text) })

  const onChange = (text: string) => {
    setDraft(text)
    if (check(text).length === 0) {
      setPlugboard(parsePlugboard(text))
      setError(null)
    }
  }

  const commit = () => {
    if (draft === null) return
    const problems = check(draft)
    if (problems.length > 0) setError(problems.join(' '))
    else setDraft(null)
  }

  return (
    <div className="mt-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-semibold">
          Plugboard pairs <span className="font-normal text-stone-600">(Steckerverbindungen)</span>
        </span>
        <input
          className={`${field} font-mono uppercase placeholder:normal-case`}
          value={draft ?? config.plugboard.join(' ')}
          placeholder="e.g. AV BS CG"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      </label>
      {error && (
        <p id={errorId} className="mt-1 text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
