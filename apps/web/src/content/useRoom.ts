import { useState, useEffect, useRef } from 'react'
import { parseRoomData, rebaseAssetUrls } from '@vm/shared'
import type { RoomData, RoomStub } from '@vm/shared'

type RoomState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: RoomData }

const BASE = import.meta.env.BASE_URL
const ASSET_BASE_URL = (import.meta.env['VITE_ASSET_BASE_URL'] ?? '').replace(/\/+$/, '')
const cache = new Map<string, RoomData>()

export function useRoom(stub: RoomStub | undefined): RoomState {
  const [state, setState] = useState<RoomState>({ status: 'idle' })
  const loadingRef = useRef<string | null>(null)

  useEffect(() => {
    if (!stub) {
      setState({ status: 'idle' })
      return
    }

    const cached = cache.get(stub.id)
    if (cached) {
      setState({ status: 'ok', data: cached })
      return
    }

    // Already fetching this room (React StrictMode double-fire guard)
    if (loadingRef.current === stub.id) return
    loadingRef.current = stub.id

    setState({ status: 'loading' })

    fetch(stub.dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((raw) => {
        const data = parseRoomData(
          rebaseAssetUrls(raw, { assetBaseUrl: ASSET_BASE_URL, appBaseUrl: BASE }),
        )
        cache.set(stub.id, data)
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
