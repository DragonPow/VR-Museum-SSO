/** Minimal markdown renderer — supports **bold**, *italic*, # headings, newlines. No deps needed. */
export function MarkdownText({ text, style }: { text: string; style?: React.CSSProperties }) {
  if (!text) return null

  const paragraphs = text.split(/\n\n+/)

  return (
    <div style={style}>
      {paragraphs.map((para, pi) => {
        const trimmed = para.trim()
        if (!trimmed) return null

        // Heading
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
        if (headingMatch) {
          const level = headingMatch[1]!.length
          const content = renderInline(headingMatch[2]!)
          const fontSize = level === 1 ? '20px' : level === 2 ? '17px' : '15px'
          return (
            <p key={pi} style={{ fontWeight: 700, fontSize, color: '#f5e6c8', marginBottom: '10px' }}>
              {content}
            </p>
          )
        }

        // List
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split('\n').filter((l) => l.match(/^[-*]\s/))
          return (
            <ul key={pi} style={{ paddingLeft: '18px', marginBottom: '10px', color: '#c8bfb0' }}>
              {items.map((item, ii) => (
                <li key={ii} style={{ marginBottom: '4px', lineHeight: 1.6 }}>
                  {renderInline(item.replace(/^[-*]\s+/, ''))}
                </li>
              ))}
            </ul>
          )
        }

        // Normal paragraph (handle \n as <br>)
        const lines = trimmed.split('\n')
        return (
          <p key={pi} style={{ marginBottom: '10px', lineHeight: 1.7, color: '#c8bfb0' }}>
            {lines.map((line, li) => (
              <span key={li}>
                {renderInline(line)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#f0e0c0', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}
