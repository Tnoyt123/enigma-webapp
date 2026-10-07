import { useEffect, useId, useMemo, useRef } from 'react'
import { useMachine } from '../state/machineStore.ts'
import { teachingStore, useTeaching } from '../state/teachingStore.ts'
import { doubleStepText, lessonSteps } from '../teaching/explain.ts'
import { useFold } from './fold.ts'
import { FoldIcon, Panel } from './Panel.tsx'

/**
 * "How it works": the x-ray and step-by-step switches, and every step of the last key press.
 * The walkthrough itself (controls and current step) is the StepCaption under the machine.
 */
export function SignalPanel() {
  const trace = useMachine((s) => s.lastTrace)
  const config = useMachine((s) => s.config)
  const xray = useTeaching((s) => s.xray)
  const stepMode = useTeaching((s) => s.stepMode)
  const cursor = useTeaching((s) => s.cursor)
  const { setXray, setStepMode } = teachingStore.getState()

  // The full list of steps folds away; in step mode the current step is shown under the machine.
  const [listOpen, setListOpen] = useFold('how-steps', false)
  const listId = useId()

  const steps = useMemo(() => (trace ? lessonSteps(trace, config) : []), [trace, config])
  const current = Math.min(cursor, steps.length - 1)
  const doubleStep = trace ? doubleStepText(trace, config) : null

  // Keep the current step in view in the list.
  const currentItem = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (stepMode && listOpen) currentItem.current?.scrollIntoView({ block: 'nearest' })
  }, [stepMode, current, listOpen])

  return (
    <Panel id="how" title="How it works">
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Switch label="X-ray: show the signal path" checked={xray} onChange={setXray} />
        <Switch label="Step by step" checked={stepMode} onChange={setStepMode} />
      </div>

      {doubleStep && (
        <p
          data-testid="double-step-note"
          className="mt-3 rounded-lg border-l-4 border-amber-600 bg-amber-100 p-3 text-sm"
        >
          {doubleStep}
        </p>
      )}

      {!trace ? (
        <p className="mt-3 text-sm text-stone-700">
          Press a key to see what happens inside the machine. Turn on x-ray to see the path the
          current takes, or step by step to follow it one stage at a time.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            <span className="font-semibold">
              {trace.input} → {trace.output}
            </span>{' '}
            <span className="text-stone-700">
              (rotors {[...trace.positionsBefore].join(' ')} → {[...trace.positionsAfter].join(' ')}
              )
            </span>
          </p>
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls={listId}
            onClick={() => setListOpen(!listOpen)}
            className="mt-2 flex items-center gap-1 rounded text-sm font-semibold text-amber-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
          >
            <FoldIcon open={listOpen} />
            All {steps.length} steps
          </button>
          <ol
            id={listId}
            hidden={!listOpen}
            // Scrollable, so it must be reachable by keyboard.
            tabIndex={0}
            className="mt-1 max-h-80 overflow-y-auto pr-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
            aria-label="Path of the current"
          >
            {steps.map((step, i) => {
              const isCurrent = stepMode && i === current
              const upcoming = stepMode && i > current
              return (
                <li
                  key={i}
                  ref={isCurrent ? currentItem : undefined}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`border-l-4 py-1.5 pl-3 ${
                    isCurrent
                      ? 'border-amber-600 bg-amber-100'
                      : upcoming
                        ? 'border-transparent text-stone-500'
                        : 'border-transparent'
                  }`}
                >
                  <span className="font-semibold">
                    {i + 1}. {step.title}
                  </span>
                  {(!stepMode || i <= current) && (
                    <span className="block text-stone-700">{step.detail}</span>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </Panel>
  )
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      {/* A transparent native checkbox over the drawn track: real hit target, switch semantics. */}
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none relative h-5 w-9 rounded-full bg-stone-400 transition-colors peer-checked:bg-amber-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber-600 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
        />
      </span>
      <span>{label}</span>
    </label>
  )
}
