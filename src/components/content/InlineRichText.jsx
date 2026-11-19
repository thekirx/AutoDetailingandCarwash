import { Link } from 'react-router-dom'
import { parseInlineRichText } from '@/lib/contentBlocks'

/**
 * XSS-safe WordPress inline rich-text renderer supporting **bold**, *italic*,
 * `code`, and [anchor text](internal-or-https-url) links without dangerouslySetInnerHTML.
 */
export default function InlineRichText({ text = '' }) {
  const segments = parseInlineRichText(text)
  if (!segments.length) return null

  return segments.map((seg, idx) => {
    const key = `${seg.type}-${idx}`
    if (seg.type === 'bold') return <strong key={key}>{seg.text}</strong>
    if (seg.type === 'italic') return <em key={key}>{seg.text}</em>
    if (seg.type === 'code') return <code key={key} className="hakum-inline-code">{seg.text}</code>
    if (seg.type === 'link') {
      if (seg.isInternal) {
        return (
          <Link key={key} to={seg.href} className="hakum-inline-link">
            {seg.text}
          </Link>
        )
      }
      return (
        <a
          key={key}
          href={seg.href}
          target="_blank"
          rel="noopener noreferrer"
          className="hakum-inline-link"
        >
          {seg.text}
        </a>
      )
    }
    return <span key={key}>{seg.text}</span>
  })
}
