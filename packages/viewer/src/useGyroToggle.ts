import { useState, useCallback } from 'react'

export function useGyroToggle() {
  const [gyroEnabled, setGyroEnabled] = useState(false)

  const toggleGyro = useCallback(async () => {
    if (gyroEnabled) { setGyroEnabled(false); return }
    const dor = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof dor.requestPermission === 'function') {
      const perm = await dor.requestPermission()
      if (perm !== 'granted') return
    }
    setGyroEnabled(true)
  }, [gyroEnabled])

  return { gyroEnabled, toggleGyro }
}
