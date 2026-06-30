import { useState, useEffect } from 'react'
import {
  DEFAULT_CONTENT,
  contentIndexFromContent,
  parseContent,
  parseContentIndex,
  roomDataFromContent,
} from '@vm/shared'
import type { Content, ContentIndex, Room } from '@vm/shared'

 type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: ContentIndex }

const BASE = import.meta.env.BASE_URL
const INDEX_URL =
  import.meta.env['VITE_CONTENT_INDEX_URL'] ??
  import.meta.env['VITE_CONTENT_URL'] ??
  ''

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

function roomDataUrl(content: Content, room: Room): string {
  const data = roomDataFromContent(content, room)
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data))}`
}

function indexFromContent(content: Content): ContentIndex {
  return contentIndexFromContent(content, (room) => roomDataUrl(content, room))
}

function parseIndexPayload(raw: unknown): ContentIndex {
  try {
    return parseContentIndex(rebaseUrls(raw))
  } catch {
    return indexFromContent(parseContent(rebaseUrls(raw)))
  }
}

let _cache: ContentIndex | null = null

export function useContentIndex(): State {
  const [state, setState] = useState<State>(
    _cache ? { status: 'ok', data: _cache } : { status: 'loading' },
  )

  useEffect(() => {
    if (_cache) return

    if (!INDEX_URL) {
      const data = indexFromContent(DEFAULT_CONTENT)
      _cache = data
      setState({ status: 'ok', data })
      return
    }

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
      .catch(() => {
        const data = indexFromContent(DEFAULT_CONTENT)
        _cache = data
        setState({ status: 'ok', data })
      })
  }, [])

  return state
}
