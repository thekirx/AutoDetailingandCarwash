import { Link } from 'react-router-dom'
import { normalizeBlocks, resolveVideoEmbed } from '@/lib/contentBlocks'

/**
 * Renders blog/event content blocks for public + account surfaces.
 * Reading this as: branded editorial content for Hakum customers, blue accent, existing public DS.
 */
export default function ContentBlockRenderer({
  blocks = [],
  formsById = {},
  className = '',
  mobile = false,
}) {
  const rows = normalizeBlocks(blocks)

  return (
    <div className={`hakum-blocks ${mobile ? 'is-mobile' : ''} ${className}`.trim()}>
      {rows.map((block) => {
        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h2' : block.level === 3 ? 'h4' : 'h3'
          return (
            <Tag key={block.id} className={`hakum-block-heading level-${block.level}`}>
              {block.text}
            </Tag>
          )
        }
        if (block.type === 'paragraph') {
          return (
            <p key={block.id} className="hakum-block-p">
              {block.text}
            </p>
          )
        }
        if (block.type === 'image' && block.url) {
          return (
            <figure key={block.id} className="hakum-block-figure">
              <img src={block.url} alt={block.alt || ''} loading="lazy" />
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          )
        }
        if (block.type === 'video' && block.url) {
          const embed = resolveVideoEmbed(block.url)
          return (
            <figure key={block.id} className="hakum-block-video">
              {embed?.kind === 'iframe' ? (
                <div className="hakum-block-video-frame">
                  <iframe
                    src={embed.src}
                    title={block.caption || 'Video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : embed?.kind === 'file' ? (
                <video src={embed.src} controls playsInline preload="metadata" />
              ) : (
                <a className="hakum-block-link" href={block.url} target="_blank" rel="noreferrer">
                  Open video
                </a>
              )}
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          )
        }
        if (block.type === 'quote') {
          return (
            <blockquote key={block.id} className="hakum-block-quote">
              <p>{block.text}</p>
              {block.cite ? <cite>{block.cite}</cite> : null}
            </blockquote>
          )
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag key={block.id} className="hakum-block-list">
              {(block.items || []).map((item, i) => (
                <li key={`${block.id}-${i}`}>{item}</li>
              ))}
            </Tag>
          )
        }
        if (block.type === 'divider') {
          return <hr key={block.id} className="hakum-block-hr" />
        }
        if (block.type === 'cta') {
          const form = block.form_id ? formsById[block.form_id] : null
          const href = form?.slug
            ? `/f/${form.slug}`
            : block.url || null
          const label = block.label || 'Open'
          if (!href) return null
          const internal = href.startsWith('/')
          const cls = `hakum-block-cta ${block.style === 'secondary' ? 'is-secondary' : 'is-primary'}`
          if (internal) {
            return (
              <p key={block.id} className="hakum-block-cta-wrap">
                <Link className={cls} to={href}>
                  {label}
                </Link>
              </p>
            )
          }
          return (
            <p key={block.id} className="hakum-block-cta-wrap">
              <a className={cls} href={href} target="_blank" rel="noreferrer">
                {label}
              </a>
            </p>
          )
        }
        return null
      })}
    </div>
  )
}
