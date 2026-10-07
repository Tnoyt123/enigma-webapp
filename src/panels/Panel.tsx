import { useId, type ReactNode } from 'react'
import { useFold } from './fold.ts'

/** ▸ that turns to ▾ when open. */
export function FoldIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`size-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/**
 * A sidebar panel whose heading folds it away. Folded, it shows `summary` (if any) under the
 * heading. The content stays mounted while folded, so half-filled forms keep their contents.
 */
export function Panel({
  id,
  title,
  summary,
  children,
}: {
  id: string
  title: string
  summary?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useFold(id)
  const headingId = useId()
  const bodyId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl bg-amber-50 p-4 text-stone-900 shadow-lg"
    >
      <h2 id={headingId} className="font-serif text-xl font-bold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="-m-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-2 rounded p-1 text-left hover:text-amber-900 focus-visible:outline-2 focus-visible:outline-amber-600"
        >
          {title}
          <FoldIcon open={open} />
        </button>
      </h2>
      {!open && summary && <div className="mt-1 text-sm text-stone-700">{summary}</div>}
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}
