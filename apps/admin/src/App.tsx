import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDraftStore } from './store.js'
import { Layout } from './ui/Layout.js'
import { Dashboard } from './pages/Dashboard.js'
import { Library } from './pages/Library.js'
import { Assign } from './pages/Assign.js'
import { Preview } from './pages/Preview.js'
import { Publish } from './pages/Publish.js'

export function App() {
  const init = useDraftStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/assign" element={<Assign />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
