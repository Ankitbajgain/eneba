import { useEffect, useState } from 'react'
import { checkStoreConnection } from './api'

type ConnectionState = 'checking' | 'ready' | 'unavailable'

export function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    checkStoreConnection(controller.signal).then(
      () => { if (!controller.signal.aborted) setState('ready') },
      () => { if (!controller.signal.aborted) setState('unavailable') },
    )
    return () => controller.abort()
  }, [attempt])

  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8" aria-labelledby="connection-title">
      <div className="mb-5 flex items-center gap-3">
        <span className={`size-2.5 rounded-full ${state === 'ready' ? 'bg-lime-300' : state === 'checking' ? 'bg-amber-300' : 'bg-rose-300'}`} aria-hidden="true" />
        <h2 id="connection-title" className="text-lg font-semibold">Store connection</h2>
      </div>
      <div role="status" aria-live="polite" className="min-h-20 text-sm leading-6 text-violet-100">
        {state === 'checking' && <p>Checking the store connection…</p>}
        {state === 'ready' && <p>The store connection is ready. Shopping features are coming next.</p>}
        {state === 'unavailable' && <p>We couldn’t connect to the store. Please try again in a moment.</p>}
      </div>
      <button
        type="button"
        disabled={state === 'checking'}
        onClick={() => { setState('checking'); setAttempt(value => value + 1) }}
        className="mt-4 w-full rounded-lg bg-lime-300 px-5 py-3 text-sm font-bold text-violet-950 transition hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {state === 'checking' ? 'Checking…' : 'Check connection again'}
      </button>
    </section>
  )
}
