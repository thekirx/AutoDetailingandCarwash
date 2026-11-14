import { Link } from 'react-router-dom'
import { normalizeBlocks, resolveVideoEmbed } from '@/lib/contentBlocks'

const CALLOUT_LABELS = {
  tip: 'Studio Tip',
  summary: 'Executive Summary',
  pricing: 'Pricing & Package Guide',
  note: 'Technical Note',
}

/**
 * Renders blog/event content blocks for public + account + live preview surfaces.
 * Supports WordPress-style blocks: heading, paragraph, image (normal/wide/full),
 * gallery (2-4 column responsive photo grid), callout box, video, quote, list, divider, and CTA.
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
          const layoutCls = block.layout && block.layout !== 'normal' ? `is-layout-${block.layout}` : ''
          const aspectCls = block.aspect && block.aspect !== 'auto' ? `is-aspect-${block.aspect.replace(':', '-')}` : ''
          return (
            <figure
              key={block.id}
              className={`hakum-block-figure ${layoutCls} ${aspectCls}`.trim()}
            >
              <img src={block.url} alt={block.alt || block.caption || 'Hakum Auto Care'} loading="lazy" />
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          )
        }
        if (block.type === 'gallery' && Array.isArray(block.images) && block.images.length > 0) {
          const cols = [2, 3, 4].includes(Number(block.columns)) ? Number(block.columns) : 2
          return (
            <figure key={block.id} className={`hakum-block-gallery cols-${cols}`}>
              <div
                className="hakum-block-gallery-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: mobile
                    ? '1fr'
                    : `repeat(auto-fit, minmax(${cols >= 3 ? '180px' : '240px'}, 1fr))`,
                  gap: '14px',
                }}
              >
                {block.images.map((img) => (
                  <div key={img.id || img.url} className="hakum-block-gallery-item">
                    <img
                      src={img.url}
                      alt={img.alt || img.caption || 'Hakum Auto Care gallery photo'}
                      loading="lazy"
                      style={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        objectFit: 'cover',
                        borderRadius: '10px',
                        display: 'block',
                      }}
                    />
                    {img.caption ? (
                      <span className="hakum-block-gallery-item-cap">{img.caption}</span>
                    ) : null}
                  </div>
                ))}
              </div>
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          )
        }
        if (block.type === 'callout') {
          const tone = block.tone || 'tip'
          const label = block.title || CALLOUT_LABELS[tone] || 'Studio Note'
          return (
            <aside key={block.id} className={`hakum-block-callout is-${tone}`}>
              <p className="hakum-block-callout-title">{label}</p>
              {block.text ? <p className="hakum-block-callout-body">{block.text}</p> : null}
            </aside>
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
