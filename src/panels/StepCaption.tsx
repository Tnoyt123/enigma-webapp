import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useMachine } from '../state/machineStore.ts'
import { STEP_SPEEDS, teachingStore, useTeaching } from '../state/teachingStore.ts'
import { lessonSteps } from '../teaching/explain.ts'
import { announce } from '../ui2d/announce.ts'

/**
 * The step-by-step walkthrough, shown right under the machine while step mode is on: the step
 * controls and what is happening at the current step, so the eye stays on the machine.
 */
export function StepCaption() {
  const trace = useMachine((s) => s.lastTrace)
  const config = useMachine((s) => s.config)
  const stepMode = useTeaching((s) => s.stepMode)
  const cursor = useTeaching((s) => s.cursor)
  const playing = useTeaching((s) => s.playing)
  const secondsPerStep = useTeaching((s) => s.secondsPerStep)
  const { next, previous, restart, setPlaying, setSecondsPerStep } = teachingStore.getState()

  const steps = useMemo(() => (trace ? lessonSteps(trace, config) : []), [trace, config])
  const current = Math.min(cursor, steps.length - 1)
  const atEnd = current >= steps.length - 1

  // Auto-advance while playing.
  useEffect(() => {
    if (!stepMode || !playing || atEnd || steps.length === 0) return
    const timer = setTimeout(next, secondsPerStep * 1000)
    return () => clearTimeout(timer)
  }, [stepMode, playing, atEnd, current, steps.length, secondsPerStep, next])

  // Read each step out as it is reached.
  const announced = useRef<string | null>(null)
  useEffect(() => {
    if (!stepMode || steps.length === 0) return
    const step = steps[current]
    const key = `${trace?.positionsBefore}${trace?.input}:${current}`
    if (announced.current === key) return
    announced.current = key
    announce(`Step ${current + 1} of ${steps.length}: ${step.title}. ${step.detail}`)
  }, [stepMode, steps, current, trace])

  if (!stepMode) return null

  return (
    <section
      aria-label="Step by step"
      className="rounded-xl border-l-8 border-amber-600 bg-amber-50 p-3 text-stone-900 shadow-lg sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex gap-1" role="group" aria-label="Step controls">
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
        </div>
        {trace && (
          <div className="flex min-w-32 flex-1 items-center gap-2 px-2 text-sm text-stone-600">
            <div
              aria-hidden="true"
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-300"
            >
              <div
                className="h-full rounded-full bg-amber-600 transition-[width]"
                style={{ width: `${((current + 1) / steps.length) * 100}%` }}
              />
            </div>
            <span data-testid="step-position" className="whitespace-nowrap">
              Step {current + 1} of {steps.length}
            </span>
          </div>
        )}
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

      {trace ? (
        <p data-testid="current-step" className="mt-2 text-sm">
          <span className="font-semibold">
            {current + 1}. {steps[current].title}
          </span>{' '}
          <span className="text-stone-700">{steps[current].detail}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-stone-700">
          Press a key, then follow what happens inside the machine one stage at a time.
        </p>
      )}
    </section>
  )
}

const ICONS = {
  restart: 'M2 3h2v10H2zM9 3v10L4 8zM14 3v10L9 8z', // |◀◀
  previous: 'M3 3h2v10H3zM13 3v10L6 8z', // |◀
  play: 'M4 2.5v11L13 8z', // ▶
  pause: 'M4 3h3v10H4zM9 3h3v10H9z', // ❚❚
  next: 'M3 3v10l7-5zM11 3h2v10h-2z', // ▶|
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
      className="flex size-9 items-center justify-center rounded border border-stone-500 bg-white text-stone-900 hover:bg-stone-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
