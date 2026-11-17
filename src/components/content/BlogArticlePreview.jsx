import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Check, Clock, Copy, MapPin, Share2, Sparkles, User } from 'lucide-react'
import { estimateReadingStats, extractContentMeta, normalizeBlocks } from '@/lib/contentBlocks'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'

const REGION_LABELS = {
  all: 'Cavite, Laguna & Batangas',
  bacoor: 'Bacoor, Cavite',
  cavite: 'Cavite Province',
  imus: 'Imus, Cavite',
  batangas: 'Batangas City',
  'molino-daang-hari': 'Molino & Daang Hari',
}

function formatPublishDate(value) {
  if (!value) return 'Draft'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return 'Recently updated'
    return d.toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Recently updated'
  }
}

/**
 * Shared Hakum editorial article view used by BOTH:
 * - Public BlogPostPage (/blog/:slug)
 * - Real-time Content Studio / Content Admin Live Preview (including Full-Screen mode)
 *
 * Always renders inside `.bredesign` tokens + `.hakum-blocks.is-editorial-dark` so preview
 * and published output match pixel-for-pixel with verified WCAG AA/AAA contrast.
 */
export default function BlogArticlePreview({
  post = {},
  formsById = {},
  relatedGuides = [],
  isPreview = false,
  mobile = false,
  toolbar = null,
}) {
  const [copied, setCopied] = useState(false)
  const meta = extractContentMeta(post)
  const blocks = normalizeBlocks(post?.content_blocks)
  const stats = estimateReadingStats(blocks, post?.title || '', post?.excerpt || '')
  const readMinutes = Number(post?.read_minutes || meta.read_minutes) || stats.readMinutes || 3
  const regionKey = String(post?.region || meta.region || 'all').toLowerCase()
  const regionLabel =
    REGION_LABELS[regionKey] || post?.regionLabel || REGION_LABELS.all
  const category = post?.category || meta.category || 'Hakum Journal'
  const isPublished =
    post?.status === 'published' ? post?.is_published !== false : Boolean(post?.is_published) && post?.status !== 'archived'
  const isArchived = post?.status === 'archived'
  const coverUrl = post?.cover_url || '/branding/hakum-lw-blue.png'
  const authorLabel = post?.author_label || 'Hakum Auto Care'
  const displayDate = formatPublishDate(post?.published_at || post?.updated_at)

  async function handleShare() {
    if (isPreview) return
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: post?.title || 'Hakum Auto Care Journal',
          text: post?.excerpt || '',
          url,
        })
        return
      }
    } catch {
      // Fall back to clipboard copy
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && url) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2200)
      }
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <div className={`bredesign bd-article-shell ${isPreview ? 'is-studio-preview' : ''} ${mobile ? 'is-mobile-frame' : ''}`.trim()}>
      <section className={`bd-page-hero bd-article-hero ${isPreview ? 'is-preview' : ''}`.trim()}>
        <div
          className="bd-page-hero-media"
          style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}
          aria-hidden="true"
        />
        <div className="bd-page-hero-scrim" aria-hidden="true" />
        <div className="bd-wrap bd-page-hero-in">
          <div className="bd-article-topbar">
            {isPreview ? (
              <span className="bd-article-crumb">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Live Hakum Editorial Preview
              </span>
            ) : (
              <Link to="/blog" className="bd-article-crumb is-link">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                All Journal Stories &amp; Guides
              </Link>
            )}
            {(!isPublished || isArchived) && (
              <span className="bd-post-badge is-draft">
                {isArchived ? 'Archived — Hidden from public' : 'Draft Preview'}
              </span>
            )}
          </div>

          <span className="bd-eyebrow">
            {category} · {regionLabel}
          </span>
          <h1>{post?.title || 'Untitled Hakum Article'}</h1>
          {post?.excerpt ? <p className="bd-page-hero-copy">{post.excerpt}</p> : null}

          <div className="bd-article-meta-bar">
            <span className="bd-article-meta-pill">
              <User className="size-3.5" aria-hidden="true" />
              <span>{authorLabel}</span>
            </span>
            <span className="bd-article-meta-pill">
              <Calendar className="size-3.5" aria-hidden="true" />
              <span>{displayDate}</span>
            </span>
            <span className="bd-article-meta-pill">
              <Clock className="size-3.5" aria-hidden="true" />
              <span>{readMinutes} min read</span>
            </span>
            <span className="bd-article-meta-pill">
              <MapPin className="size-3.5" aria-hidden="true" />
              <span>{regionLabel}</span>
            </span>
            {!isPreview && (
              <button
                type="button"
                onClick={handleShare}
                className="bd-article-meta-btn"
                title="Share or copy article link"
              >
                {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Share2 className="size-3.5" aria-hidden="true" />}
                <span>{copied ? 'Link Copied' : 'Share'}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="bd-sec bd-article-body-sec">
        <div className="bd-wrap">
          {toolbar ? <div className="bd-article-studio-slot">{toolbar}</div> : null}

          <article className="bd-article-prose">
            {coverUrl ? (
              <figure className="bd-article-cover-frame">
                <img
                  src={coverUrl}
                  alt={post?.title || 'Hakum Auto Care article cover'}
                  loading="eager"
                />
              </figure>
            ) : null}

            {meta.ai_summary || post?.branch_info || post?.branch_note || post?.excerpt ? (
              <aside className="bd-article-summary-box" aria-label="Quick Summary">
                <span className="bd-eyebrow">Quick Summary</span>
                <p className="bd-article-summary-text">{meta.ai_summary || post.excerpt}</p>
                {post?.branch_info ? (
                  <p className="bd-article-branch-meta">
                    <strong>{post.branch_info.name}:</strong> {post.branch_info.landmark}
                    {post.branch_info.phone ? (
                      <>
                        {' · '}
                        <a href={`tel:${String(post.branch_info.phone).replace(/\s+/g, '')}`}>
                          {post.branch_info.phone}
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : post?.branch_note ? (
                  <p className="bd-article-branch-meta">
                    Recommended Branches: {post.branch_note} —{' '}
                    <Link to="/book">Reserve your slot</Link>
                  </p>
                ) : null}
              </aside>
            ) : null}

            {blocks.length > 0 ? (
              <ContentBlockRenderer
                blocks={blocks}
                formsById={formsById}
                className="is-editorial-dark"
                mobile={mobile}
              />
            ) : (
              <div className="bd-article-empty-body">
                <p>
                  {isPreview
                    ? 'Start adding Headings, Paragraphs, Photos, Callout Boxes, Lists, Quotes, or CTAs on the left to watch your live Hakum article take shape in real time.'
                    : 'This article is currently being finalized by the Hakum Auto Care editorial desk.'}
                </p>
                {!isPreview ? (
                  <p className="hakum-block-cta-wrap">
                    <Link to="/book" className="hakum-block-cta is-primary">
                      Book a visit
                    </Link>
                  </p>
                ) : null}
              </div>
            )}

            <div className="bd-article-footer-bar">
              <div className="bd-article-footer-copy">
                <span className="bd-eyebrow">Hakum Auto Care · Cavite &amp; Batangas</span>
                <p>Precision car wash, graphene ceramic coating, PPF &amp; studio lounge.</p>
              </div>
              <div className="bd-article-footer-actions">
                {!isPreview ? (
                  <button type="button" onClick={handleShare} className="bd-cms-btn">
                    {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                    {copied ? 'Copied URL' : 'Copy Link'}
                  </button>
                ) : null}
                {isPreview ? (
                  <span className="hakum-block-cta is-primary">Book a Visit</span>
                ) : (
                  <Link to="/book" className="hakum-block-cta is-primary">
                    Book a Visit
                  </Link>
                )}
              </div>
            </div>

            {Array.isArray(relatedGuides) && relatedGuides.length > 0 && !isPreview ? (
              <section className="bd-article-related" aria-label="More regional and technical guides">
                <span className="bd-eyebrow">More Regional &amp; Technical Guides</span>
                <div className="bd-article-related-grid">
                  {relatedGuides.map((g) => (
                    <Link
                      key={g.slug || g.id}
                      to={`/blog/${g.slug}`}
                      className="bd-article-related-card"
                    >
                      <span className="bd-post-badge">{g.category || 'Journal Guide'}</span>
                      <strong>{g.title}</strong>
                      {g.excerpt ? <p className="bd-article-related-excerpt">{g.excerpt}</p> : null}
                      <span className="bd-card-go">Read guide -&gt;</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </article>
        </div>
      </section>
    </div>
  )
}
