import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { brand } from './ui/theme.js'


document.documentElement.style.fontFamily = brand.fontFamily
document.body.style.fontFamily = brand.fontFamily

const fontStyle = document.createElement('style')
fontStyle.textContent = "*, button, input, select, textarea { font-family: " + brand.fontFamily + "; }"
document.head.appendChild(fontStyle)

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
