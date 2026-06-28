import { useState, useEffect } from 'react'
import { parseContentIndex } from '@vm/shared'
import type { ContentIndex } from '@vm/shared'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: ContentIndex }

const BASE = import.meta.env.BASE_URL
const INDEX_URL =
  import.meta.env['VITE_CONTENT_INDEX_URL'] ??
  `${BASE}content/content-index.sample.json`

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

let _cache: ContentIndex | null = null

export function useContentIndex(): State {
  const [state, setState] = useState<State>(
    _cache ? { status: 'ok', data: _cache } : { status: 'loading' },
  )

  useEffect(() => {
    if (_cache) return
    fetch(INDEX_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((raw) => {
        const data = parseContentIndex(rebaseUrls(raw))
        _cache = data
        setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
  }, [])

  return state
}
