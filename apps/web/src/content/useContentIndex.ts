import { useState, useEffect } from 'react'
import {
  contentIndexFromContent,
  parseContent,
  parseContentIndex,
  rebaseAssetUrls,
  roomDataFromContent,
} from '@vm/shared'
import type { Content, ContentIndex, Room } from '@vm/shared'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: ContentIndex }

const BASE = import.meta.env.BASE_URL
const ASSET_BASE_URL = (import.meta.env['VITE_ASSET_BASE_URL'] ?? '').replace(/\/+$/, '')
const INDEX_URL = ASSET_BASE_URL
  ? `${ASSET_BASE_URL}/content.json`
  : `${BASE}content/content.sample.json`

function roomDataUrl(content: Content, room: Room): string {
  const data = roomDataFromContent(content, room)
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data))}`
}

function indexFromContent(content: Content): ContentIndex {
  return contentIndexFromContent(content, (room) => roomDataUrl(content, room))
}

function parseIndexPayload(raw: unknown): ContentIndex {
  const rebased = rebaseAssetUrls(raw, { assetBaseUrl: ASSET_BASE_URL, appBaseUrl: BASE })
  try {
    return parseContentIndex(rebased)
  } catch {
    return indexFromContent(parseContent(rebased))
  }
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
        const data = parseIndexPayload(raw)
        _cache = data
        setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
  }, [])

  return state
}
