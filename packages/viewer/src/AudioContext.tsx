import React, { createContext, useContext, useState, useEffect, useRef } from 'react'

interface PlaylistItem {
  url: string
  volume?: number | undefined
  loop?: boolean | undefined
}

interface AudioContextType {
  muted: boolean
  setMuted: (muted: boolean) => void
  playAmbient: (url: string, options?: { loop?: boolean | undefined; volume?: number | undefined } | undefined) => void
  playAmbientPlaylist: (items: PlaylistItem[]) => void
  pauseAmbient: () => void
  resumeAmbient: () => void
  stopAmbient: () => void
  playItemAudio: (url: string, options?: { volume?: number | undefined; loop?: boolean | undefined } | undefined) => void
  playItemPlaylist: (items: PlaylistItem[]) => void
  stopItemAudio: () => void
  stopAll: () => void
  isItemAudioPlaying: boolean
  isAmbientPlaying: boolean
  unlockAudio: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function useMuseumAudio() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useMuseumAudio must be used within an AudioProvider')
  }
  return context
}

function clampAudioVolume(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

function sameAudioUrl(audio: HTMLAudioElement, nextUrl: string): boolean {
  const current = audio.currentSrc || audio.src
  if (!current) return false
  try {
    return new URL(current, window.location.href).href === new URL(nextUrl, window.location.href).href
  } catch {
    return current === nextUrl
  }
}

function playlistKey(items: PlaylistItem[]): string {
  return items.map((item) => `${item.url}|${item.volume ?? ''}|${item.loop ? 1 : 0}`).join('\n')
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMutedState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vm_audio_muted')
      return saved == null ? true : saved === 'true'
    }
    return true
  })

  const [isItemAudioPlaying, setIsItemAudioPlayingState] = useState(false)
  const [isAmbientPlaying, setIsAmbientPlayingState] = useState(false)

  const ambientAudioRef = useRef<HTMLAudioElement | null>(null)
  const itemAudioRef = useRef<HTMLAudioElement | null>(null)
  const unlockedRef = useRef(false)
  const isItemAudioPlayingRef = useRef(false)
  const isAmbientPlayingRef = useRef(false)
  const isAmbientPausedRef = useRef(false)

  const ambientUrlRef = useRef<string | null>(null)
  const ambientTargetVolumeRef = useRef<number>(0.25)
  const ambientPlaylistRef = useRef<PlaylistItem[]>([])
  const ambientPlaylistIndexRef = useRef<number>(0)
  const ambientPlaylistKeyRef = useRef<string>('')

  const playlistRef = useRef<PlaylistItem[]>([])
  const playlistIndexRef = useRef<number>(0)

  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const setItemAudioPlaying = (value: boolean) => {
    isItemAudioPlayingRef.current = value
    setIsItemAudioPlayingState(value)
  }

  const setAmbientPlaying = (value: boolean) => {
    isAmbientPlayingRef.current = value
    setIsAmbientPlayingState(value)
  }

  const ensureAudioElements = () => {
    if (!ambientAudioRef.current) {
      const ambient = new Audio()
      ambient.muted = muted
      ambient.addEventListener('ended', handleAmbientAudioEnded)
      ambientAudioRef.current = ambient
    }

    if (!itemAudioRef.current) {
      const itemAudio = new Audio()
      itemAudio.muted = muted
      itemAudio.addEventListener('ended', handleItemAudioEnded)
      itemAudioRef.current = itemAudio
    }

    return { ambient: ambientAudioRef.current, itemAudio: itemAudioRef.current }
  }

  const prepareAudioSource = (audio: HTMLAudioElement, url: string) => {
    audio.pause()
    if (sameAudioUrl(audio, url)) {
      try { audio.currentTime = 0 } catch {}
    } else {
      audio.src = url
    }
  }

  const playCurrentAmbientItem = () => {
    const { ambient } = ensureAudioElements()
    const playlist = ambientPlaylistRef.current
    const index = ambientPlaylistIndexRef.current
    const item = playlist[index]

    if (!item) {
      setAmbientPlaying(false)
      return
    }

    const volume = clampAudioVolume(item.volume, ambientTargetVolumeRef.current)
    ambientUrlRef.current = item.url
    ambientTargetVolumeRef.current = volume
    prepareAudioSource(ambient, item.url)
    ambient.loop = playlist.length === 1 && Boolean(item.loop)
    ambient.volume = (isItemAudioPlayingRef.current || isAmbientPausedRef.current) ? 0 : volume

    setAmbientPlaying(true)
    if (isAmbientPausedRef.current) {
      ambient.pause()
      return
    }

    ambient.play().catch(err => {
      console.warn('Ambient play failed/blocked:', err)
    })
  }

  const handleAmbientAudioEnded = () => {
    const playlist = ambientPlaylistRef.current
    const currentIndex = ambientPlaylistIndexRef.current
    const currentItem = playlist[currentIndex]

    if (playlist.length === 0) {
      setAmbientPlaying(false)
      return
    }

    const nextIndex = currentIndex + 1
    if (nextIndex < playlist.length) {
      ambientPlaylistIndexRef.current = nextIndex
      playCurrentAmbientItem()
      return
    }

    if (currentItem?.loop || playlist.some(item => item.loop)) {
      ambientPlaylistIndexRef.current = 0
      playCurrentAmbientItem()
      return
    }

    setAmbientPlaying(false)
  }

  const playCurrentPlaylistItem = () => {
    const { itemAudio } = ensureAudioElements()
    const playlist = playlistRef.current
    const index = playlistIndexRef.current
    const item = playlist[index]

    if (!item) {
      setItemAudioPlaying(false)
      resumeAmbientPlayback()
      return
    }

    prepareAudioSource(itemAudio, item.url)
    itemAudio.volume = clampAudioVolume(item.volume, 1.0)
    itemAudio.loop = playlist.length === 1 && Boolean(item.loop)

    setItemAudioPlaying(true)
    itemAudio.play().catch(err => {
      console.warn('Playlist item play failed/blocked:', err)
    })

    const ambient = ambientAudioRef.current
    if (ambient && isAmbientPlayingRef.current) {
      fadeVolume(ambient, 0, 400)
    }
  }

  const handleItemAudioEnded = () => {
    const playlist = playlistRef.current
    const currentIndex = playlistIndexRef.current

    if (playlist.length === 0) {
      setItemAudioPlaying(false)
      resumeAmbientPlayback()
      return
    }

    const currentItem = playlist[currentIndex]
    if (currentItem && currentItem.loop && playlist.length === 1) {
      playCurrentPlaylistItem()
      return
    }

    const nextIndex = currentIndex + 1
    if (nextIndex < playlist.length) {
      playlistIndexRef.current = nextIndex
      playCurrentPlaylistItem()
      return
    }

    if (playlist.some(item => item.loop)) {
      playlistIndexRef.current = 0
      playCurrentPlaylistItem()
      return
    }

    setItemAudioPlaying(false)
    resumeAmbientPlayback()
  }

  useEffect(() => {
    const { ambient, itemAudio } = ensureAudioElements()

    return () => {
      ambient.pause()
      itemAudio.pause()
      ambient.removeEventListener('ended', handleAmbientAudioEnded)
      itemAudio.removeEventListener('ended', handleItemAudioEnded)
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vm_audio_muted', String(muted))
    }
    if (ambientAudioRef.current) {
      ambientAudioRef.current.muted = muted
    }
    if (itemAudioRef.current) {
      itemAudioRef.current.muted = muted
    }
  }, [muted])

  const unlockAudio = () => {
    unlockedRef.current = true
  }

  const setMuted = (value: boolean) => {
    setMutedState(value)
    if (ambientAudioRef.current) ambientAudioRef.current.muted = value
    if (itemAudioRef.current) itemAudioRef.current.muted = value
    if (!value) {
      unlockAudio()
      resumeAmbientPlayback()
    }
  }

  const fadeVolume = (audio: HTMLAudioElement, targetVolume: number, duration: number, onComplete?: () => void) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current)
      fadeIntervalRef.current = null
    }

    const stepTime = 30
    const steps = duration / stepTime
    const startVolume = audio.volume
    const safeTargetVolume = clampAudioVolume(targetVolume, audio.volume)
    const volumeDiff = safeTargetVolume - startVolume
    let currentStep = 0

    fadeIntervalRef.current = setInterval(() => {
      currentStep++
      const nextVolume = startVolume + (volumeDiff * (currentStep / steps))
      audio.volume = Math.max(0, Math.min(1, nextVolume))

      if (currentStep >= steps) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
        fadeIntervalRef.current = null
        audio.volume = safeTargetVolume
        if (onComplete) onComplete()
      }
    }, stepTime)
  }

  const playAmbient = (url: string, options?: { loop?: boolean | undefined; volume?: number | undefined } | undefined) => {
    playAmbientPlaylist([{ url, volume: options?.volume, loop: options?.loop !== false }])
  }

  const playAmbientPlaylist = (items: PlaylistItem[]) => {
    const playable = items.filter((item) => item.url)
    if (playable.length === 0) {
      stopAmbient()
      return
    }

    const nextKey = playlistKey(playable)
    if (ambientPlaylistKeyRef.current === nextKey && isAmbientPlayingRef.current) {
      const current = playable[ambientPlaylistIndexRef.current] ?? playable[0]
      if (current) {
        ambientTargetVolumeRef.current = clampAudioVolume(current.volume, ambientTargetVolumeRef.current)
      }
      resumeAmbientPlayback()
      return
    }

    ambientPlaylistRef.current = playable
    ambientPlaylistIndexRef.current = 0
    ambientPlaylistKeyRef.current = nextKey
    playCurrentAmbientItem()
  }

  const pauseAmbient = () => {
    isAmbientPausedRef.current = true
    const ambient = ambientAudioRef.current
    if (!ambient || !isAmbientPlayingRef.current) return

    fadeVolume(ambient, 0, 250, () => {
      ambient.pause()
    })
  }

  const stopAmbient = () => {
    isAmbientPausedRef.current = false
    const ambient = ambientAudioRef.current
    if (!ambient) return

    ambient.pause()
    ambientUrlRef.current = null
    ambientPlaylistRef.current = []
    ambientPlaylistIndexRef.current = 0
    ambientPlaylistKeyRef.current = ''
    setAmbientPlaying(false)
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current)
      fadeIntervalRef.current = null
    }
  }

  const playItemAudio = (url: string, options?: { volume?: number | undefined; loop?: boolean | undefined } | undefined) => {
    playItemPlaylist([{ url, volume: options?.volume, loop: options?.loop }])
  }

  const playItemPlaylist = (items: PlaylistItem[]) => {
    unlockAudio()
    playlistRef.current = items
    playlistIndexRef.current = 0
    playCurrentPlaylistItem()
  }

  const stopItemAudio = () => {
    const itemAudio = itemAudioRef.current
    if (!itemAudio) return

    itemAudio.pause()
    setItemAudioPlaying(false)
    playlistRef.current = []
    playlistIndexRef.current = 0
    resumeAmbientPlayback()
  }

  const resumeAmbientPlayback = () => {
    if (isAmbientPausedRef.current) return

    const ambient = ambientAudioRef.current
    if (ambient && isAmbientPlayingRef.current && ambientUrlRef.current) {
      fadeVolume(ambient, ambientTargetVolumeRef.current, 400)
      ambient.play().catch(err => {
        console.warn('Failed to resume ambient play:', err)
      })
    }
  }

  const resumeAmbient = () => {
    isAmbientPausedRef.current = false
    resumeAmbientPlayback()
  }

  const stopAll = () => {
    stopAmbient()
    const itemAudio = itemAudioRef.current
    if (itemAudio) {
      itemAudio.pause()
      setItemAudioPlaying(false)
      playlistRef.current = []
      playlistIndexRef.current = 0
    }
  }

  return (
    <AudioContext.Provider
      value={{
        muted,
        setMuted,
        playAmbient,
        playAmbientPlaylist,
        pauseAmbient,
        resumeAmbient,
        stopAmbient,
        playItemAudio,
        playItemPlaylist,
        stopItemAudio,
        stopAll,
        isItemAudioPlaying,
        isAmbientPlaying,
        unlockAudio,
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}