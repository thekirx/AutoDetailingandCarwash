import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import { supabase } from '@/lib/supabase'
import { usePageMeta } from '@/lib/pageMeta'
import {
  SEO_LOCAL_GUIDES,
  buildBlogPostJsonLd,
  findBuiltInBlogPost,
} from '@/lib/seoLocalGuides'

export default function BlogPostPage() {
  const { slug } = useParams()
  const builtIn = useMemo(() => findBuiltInBlogPost(slug), [slug])
  const [post, setPost] = useState(() => builtIn)
  const [error, setError] = useState('')

  useEffect(() => {
    setPost(builtIn)
    setError('')
  }, [builtIn])

  const articleJsonLd = useMemo(
    () =>
      buildBlogPostJsonLd(
        post,
        typeof window !== 'undefined' ? window.location.origin : 'https://www.hakumautocare.com',
      ),
    [post],
  )

  // Post links get pasted into Facebook and WhatsApp; before this every one of
  // them scraped as the homepage (BUG-051).
  usePageMeta({
    title: post?.title,
    description: post?.ai_summary || post?.excerpt,
    path: slug ? `/blog/${slug}` : '/events',
    image: post?.cover_url || '/og-image.png',
    jsonLd: articleJsonLd,
    jsonLdId: 'hakum-blogpost-jsonld',
  })

  useEffect(() => {
    if (!slug) return
    const fallback = findBuiltInBlogPost(slug)
    supabase
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, author_label, published_at, content_blocks')
      .eq('slug', slug)
      .eq('is_published', true)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (data) {
          setPost(data)
          setError('')
        } else if (fallback) {
          setPost(fallback)
          setError('')
        } else if (e) {
          setError(e.message)
        } else {
          setError('Post not found.')
        }
      })
  }, [slug])

  const relatedGuides = useMemo(
    () => SEO_LOCAL_GUIDES.filter((g) => g.slug !== slug).slice(0, 4),
    [slug],
  )

  return (
    <>
      <section className="inner-hero">
        <div className="public-shell" style={{ maxWidth: 780 }}>
          <p className="eyebrow eyebrow-light">{post?.regionLabel || post?.category || 'Blog'}</p>
          <h1 className="display-title">{post?.title || 'Blog'}</h1>
          {post && (
            <p className="inner-hero-copy">
              {post.author_label || 'Hakum Auto Care'}
              {post.read_minutes ? ` · ${post.read_minutes} min read` : ''}
              {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ''}
            </p>
          )}
        </div>
      </section>
      <section className="content-section">
        <div className="public-shell hakum-article" style={{ maxWidth: 780 }}>
          {error && <p className="form-error">{error}</p>}
          {post?.cover_url ? (
            <img className="hakum-article-cover" src={post.cover_url} alt={post.title || ''} />
          ) : null}

          {post?.ai_summary ? (
            <aside className="bd-article-summary-box" aria-label="Executive summary">
              <p className="bd-eyebrow">Quick Summary</p>
              <p className="bd-article-summary-text">{post.ai_summary}</p>
              {post.branch_info ? (
                <div className="bd-article-branch-meta">
                  <strong>{post.branch_info.name}:</strong> {post.branch_info.landmark} ·{' '}
                  <a href={`tel:${post.branch_info.phone.replace(/\s+/g, '')}`} className="dark-link">
                    {post.branch_info.phone}
                  </a>
                </div>
              ) : null}
            </aside>
          ) : null}

          {post && <ContentBlockRenderer blocks={post.content_blocks} />}

          {relatedGuides.length > 0 ? (
            <nav className="bd-article-related" aria-label="Related regional guides">
              <p className="bd-eyebrow">More Regional &amp; Technical Guides</p>
              <div className="bd-article-related-grid">
                {relatedGuides.map((g) => (
                  <Link key={g.slug} to={`/blog/${g.slug}`} className="bd-article-related-card">
                    <span className="bd-post-badge">{g.regionLabel || g.category}</span>
                    <strong>{g.title}</strong>
                  </Link>
                ))}
              </div>
            </nav>
          ) : null}

          <p className="hakum-article-footer">
            <Link className="dark-link" to="/blog">
              All posts
            </Link>
            {' · '}
            <Link className="dark-link" to="/events">
              Events
            </Link>
            {' · '}
            <Link className="dark-link" to="/book">
              Book a visit
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
