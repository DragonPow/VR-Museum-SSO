import { useState, useEffect } from 'react'
import { parseContent, rebaseAssetUrls } from '@vm/shared'
import type { Content } from '@vm/shared'

type State =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: Content }

const BASE = import.meta.env.BASE_URL // e.g. '/VR-Museum-SSO/'
const ASSET_BASE_URL = (import.meta.env['VITE_ASSET_BASE_URL'] ?? '').replace(/\/+$/, '')
const CONTENT_URL = ASSET_BASE_URL
  ? `${ASSET_BASE_URL}/content.json`
  : `${BASE}content/content.sample.json`

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
        const data = parseContent(
          rebaseAssetUrls(raw, { assetBaseUrl: ASSET_BASE_URL, appBaseUrl: BASE }),
        )
        _cache = data
        setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
  }, [])

  return state
}
