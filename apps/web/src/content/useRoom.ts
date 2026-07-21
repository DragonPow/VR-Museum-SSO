import { useState, useEffect, useRef } from 'react'
import { parseRoomData, rebaseAssetUrls } from '@vm/shared'
import type { RoomData, RoomStub } from '@vm/shared'
import { CONTENT_SOURCE } from './source.js'

type RoomState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: RoomData }

const cache = new Map<string, RoomData>()

export function useRoom(stub: RoomStub | undefined): RoomState {
  const [state, setState] = useState<RoomState>({ status: 'idle' })
  const loadingRef = useRef<string | null>(null)

  useEffect(() => {
    if (!stub) {
      setState({ status: 'idle' })
      return
    }

    const cacheKey = `${stub.id}:${stub.dataUrl}`
    const cached = cache.get(cacheKey)
    if (cached) {
      setState({ status: 'ok', data: cached })
      return
    }

    // Already fetching this room (React StrictMode double-fire guard)
    if (loadingRef.current === cacheKey) return
    loadingRef.current = cacheKey

    setState({ status: 'loading' })

    fetch(stub.dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((raw) => {
        const data = parseRoomData(
          rebaseAssetUrls(raw, { assetBaseUrl: CONTENT_SOURCE.assetBaseUrl, appBaseUrl: CONTENT_SOURCE.appBaseUrl, assetVersion: CONTENT_SOURCE.assetVersion }),
        )
        cache.set(cacheKey, data)
        setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
      .finally(() => {
        loadingRef.current = null
      })
  }, [stub?.id, stub?.dataUrl])

  return state
}
