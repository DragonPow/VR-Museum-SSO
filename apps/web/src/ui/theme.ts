import type { CSSProperties } from 'react'

export const brand = {
  blue: '#1050a0',
  blueDark: '#003f8f',
  blueDeep: '#082f6d',
  blueSoft: '#d8e8f8',
  sky: '#eef7ff',
  panel: 'rgba(255,255,255,0.86)',
  panelStrong: 'rgba(255,255,255,0.94)',
  text: '#0f2e54',
  muted: '#5f748c',
  line: 'rgba(16,80,160,0.22)',
  shadow: '0 18px 50px rgba(8,47,109,0.18)',
  fontFamily: '"Segoe UI", Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
}

export const glassPanel: CSSProperties = {
  background: brand.panel,
  border: `1px solid ${brand.line}`,
  boxShadow: brand.shadow,
  backdropFilter: 'blur(12px)',
}
