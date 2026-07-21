import { useState, useEffect } from 'react'
import { parseContent, rebaseAssetUrls } from '@vm/shared'
import { CONTENT_SOURCE, fetchFirstContentJson } from './source.js'
import type { Content } from '@vm/shared'

type State =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: Content }


let _cache: Content | null = null

export function useContent(): State {
  const [state, setState] = useState<State>(
    _cache ? { status: 'ok', data: _cache } : { status: 'loading' },
  )

  useEffect(() => {
    if (_cache) return
    fetchFirstContentJson((raw) => parseContent(
      rebaseAssetUrls(raw, { assetBaseUrl: CONTENT_SOURCE.assetBaseUrl, appBaseUrl: CONTENT_SOURCE.appBaseUrl, assetVersion: CONTENT_SOURCE.assetVersion }),
    ))
      .then((data) => {
        _cache = data as Content
        setState({ status: 'ok', data: data as Content })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
  }, [])

  return state
}
