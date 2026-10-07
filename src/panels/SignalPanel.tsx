import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { useMachine } from '../state/machineStore.ts'
import { STEP_SPEEDS, teachingStore, useTeaching } from '../state/teachingStore.ts'
import { doubleStepText, lessonSteps } from '../teaching/explain.ts'
import { announce } from '../ui2d/announce.ts'
import { useFold } from './fold.ts'
import { FoldIcon, Panel } from './Panel.tsx'

/** "How it works": x-ray and step-by-step controls, and the explanation of the last key press. */
export function SignalPanel() {
  const trace = useMachine((s) => s.lastTrace)
  const config = useMachine((s) => s.config)
  const xray = useTeaching((s) => s.xray)
  const stepMode = useTeaching((s) => s.stepMode)
  const cursor = useTeaching((s) => s.cursor)
  const playing = useTeaching((s) => s.playing)
  const secondsPerStep = useTeaching((s) => s.secondsPerStep)
  const { setXray, setStepMode, next, previous, restart, setPlaying, setSecondsPerStep } =
    teachingStore.getState()

  // The full list of steps folds away; in step mode the current step is shown above it anyway.
  const [listOpen, setListOpen] = useFold('how-steps', false)
  const listId = useId()

  const steps = useMemo(() => (trace ? lessonSteps(trace, config) : []), [trace, config])
  const current = Math.min(cursor, steps.length - 1)
  const doubleStep = trace ? doubleStepText(trace, config) : null
  const atEnd = current >= steps.length - 1

  // Auto-advance while playing.
  useEffect(() => {
    if (!stepMode || !playing || atEnd || steps.length === 0) return
    const timer = setTimeout(next, secondsPerStep * 1000)
    return () => clearTimeout(timer)
  }, [stepMode, playing, atEnd, current, steps.length, secondsPerStep, next])

  // In step mode, read each step out as it is reached.
  const announced = useRef<string | null>(null)
  useEffect(() => {
    if (!stepMode || steps.length === 0) return
    const step = steps[current]
    const key = `${trace?.positionsBefore}${trace?.input}:${current}`
    if (announced.current === key) return
    announced.current = key
    announce(`Step ${current + 1} of ${steps.length}: ${step.title}. ${step.detail}`)
  }, [stepMode, steps, current, trace])

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

      {stepMode && (
        <div className="mt-3 flex flex-col gap-2">
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Step controls"
          >
            <IconButton label="Restart" onClick={restart} disabled={!trace || current === 0}>
              <StepIcon shape="restart" />
            </IconButton>
            <IconButton label="Previous step" onClick={previous} disabled={!trace || current === 0}>
              <StepIcon shape="previous" />
            </IconButton>
            <IconButton
              label={playing ? 'Pause' : 'Play'}
              onClick={() => setPlaying(!playing)}
              disabled={!trace}
            >
              <StepIcon shape={playing ? 'pause' : 'play'} />
            </IconButton>
            <IconButton label="Next step" onClick={next} disabled={!trace || atEnd}>
              <StepIcon shape="next" />
            </IconButton>
            <label className="ml-auto flex items-center gap-1 text-sm">
              Speed
              <select
                className="rounded border border-stone-400 bg-white px-1 py-0.5"
                value={secondsPerStep}
                onChange={(e) => setSecondsPerStep(Number(e.target.value))}
              >
                {STEP_SPEEDS.map((s) => (
                  <option key={s.label} value={s.seconds}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {trace && (
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <div
                aria-hidden="true"
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-300"
              >
                <div
                  className="h-full rounded-full bg-amber-600 transition-[width]"
                  style={{ width: `${((current + 1) / steps.length) * 100}%` }}
                />
              </div>
              <span data-testid="step-position">
                Step {current + 1} of {steps.length}
              </span>
            </div>
          )}
        </div>
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
          {stepMode && (
            <div
              data-testid="current-step"
              className="mt-2 border-l-4 border-amber-600 bg-amber-100 py-1.5 pl-3 text-sm"
            >
              <span className="font-semibold">
                {current + 1}. {steps[current].title}
              </span>
              <span className="block text-stone-700">{steps[current].detail}</span>
            </div>
          )}
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

const ICONS = {
  restart: 'M3 3h2v10H3zM13 3v10L6 8z',
  previous: 'M11 3v10L4 8z',
  play: 'M4 2.5v11L13 8z',
  pause: 'M4 3h3v10H4zM9 3h3v10H9z',
  next: 'M5 3v10l7-5z',
}

/** Transport symbols, drawn rather than emoji so they look the same everywhere. */
function StepIcon({ shape }: { shape: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
      <path d={ICONS[shape]} />
    </svg>
  )
}

/** A compact control with a symbol; its name comes from `label` (also shown as a tooltip). */
function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 items-center justify-center rounded border border-stone-500 bg-white text-base text-stone-900 hover:bg-stone-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
    >
      <span aria-hidden="true">{children}</span>
    </button>
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
