import { useState, useEffect, useRef } from 'react'
import { parseRoomData } from '@vm/shared'
import type { RoomData, RoomStub } from '@vm/shared'

type RoomState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: RoomData }

const BASE = import.meta.env.BASE_URL
const cache = new Map<string, RoomData>()

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

export function useRoom(stub: RoomStub | undefined): RoomState {
  const [state, setState] = useState<RoomState>({ status: 'idle' })
  const loadingRef = useRef<string | null>(null)

  useEffect(() => {
    if (!stub) { setState({ status: 'idle' }); return }

    const cached = cache.get(stub.id)
    if (cached) { setState({ status: 'ok', data: cached }); return }

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
        const data = parseRoomData(rebaseUrls(raw))
        cache.set(stub.id, data)
        setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: String(err) })
      })
      .finally(() => { loadingRef.current = null })
  }, [stub?.id, stub?.dataUrl])

  return state
}
