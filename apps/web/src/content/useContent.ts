import { useState, useEffect } from 'react'
import { parseContent } from '@vm/shared'
import type { Content } from '@vm/shared'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: Content }

const BASE = import.meta.env.BASE_URL                          // e.g. '/VR-Museum-SSO/'
const CONTENT_URL = import.meta.env['VITE_CONTENT_URL'] ?? `${BASE}content/content.sample.json`

// Walk every string in the parsed content and prefix root-relative /content/ paths
// with the app's base URL so assets resolve correctly on sub-path deployments.
function rebaseUrls(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.startsWith('/content/')
      ? BASE.replace(/\/$/, '') + value
      : value
  }
  if (Array.isArray(value)) return value.map(rebaseUrls)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebaseUrls(v)]))
  }
  return value
}

let _cache: Content | null = null

export function useContent(): State {
  const [state, setState] = useState<State>(
    _cache ? { status: 'ok', data: _cache } : { status: 'loading' },
  )

  useEffect(() => {
    if (_cache) return
    fetch(CONTENT_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((raw) => {
        const data = parseContent(rebaseUrls(raw))
        _cache = data
        setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
  }, [])

  return state
}
