import { useState, useEffect } from 'react'
import {
  contentIndexFromContent,
  parseContent,
  parseContentIndex,
  rebaseAssetUrls,
  roomDataFromContent,
} from '@vm/shared'
import { CONTENT_SOURCE, fetchFirstContentJson } from './source.js'
import type { Content, ContentIndex, Room } from '@vm/shared'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: ContentIndex }


function roomDataUrl(content: Content, room: Room): string {
  const data = roomDataFromContent(content, room)
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data))}`
}

function indexFromContent(content: Content): ContentIndex {
  return contentIndexFromContent(content, (room) => roomDataUrl(content, room))
}

function parseIndexPayload(raw: unknown): ContentIndex {
  const rebased = rebaseAssetUrls(raw, { assetBaseUrl: CONTENT_SOURCE.assetBaseUrl, appBaseUrl: CONTENT_SOURCE.appBaseUrl, assetVersion: CONTENT_SOURCE.assetVersion })
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

    fetchFirstContentJson((raw) => parseIndexPayload(raw))
      .then((data) => {
        _cache = data as ContentIndex
        setState({ status: 'ok', data: data as ContentIndex })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
  }, [])

  return state
}
