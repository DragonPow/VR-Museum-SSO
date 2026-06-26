import { useState } from 'react'
import { useContent } from './content/useContent.js'
import { Landing } from './pages/Landing.js'
import { Tour } from './pages/Tour.js'

type View = 'landing' | 'tour'

export function App() {
  const [view, setView] = useState<View>('landing')
  const state = useContent()

  if (state.status === 'loading') {
    return <LoadingScreen />
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.message} />
  }

  const { data: content } = state

  if (view === 'landing') {
    return <Landing content={content} onEnter={() => setView('tour')} />
  }

  return <Tour content={content} onBack={() => setView('landing')} />
}

function LoadingScreen() {
  return (
    <div style={centerStyle}>
      <div style={spinnerStyle} />
      <p style={{ color: '#7a7060', marginTop: '16px', fontSize: '14px' }}>Đang tải nội dung…</p>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={centerStyle}>
      <p style={{ color: '#c04040', fontSize: '14px' }}>Không thể tải nội dung:</p>
      <p style={{ color: '#7a7060', fontSize: '12px', marginTop: '8px' }}>{message}</p>
    </div>
  )
}

const centerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: '#1a1410',
}

const spinnerStyle: React.CSSProperties = {
  width: '36px', height: '36px',
  border: '3px solid rgba(200,168,90,0.2)',
  borderTop: '3px solid #c8a85a',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
}
