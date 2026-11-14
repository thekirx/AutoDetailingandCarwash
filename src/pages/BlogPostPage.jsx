import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Edit3, Eye, EyeOff, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import ContentStudioModal from '@/components/content/ContentStudioModal'
import { useAuth } from '@/auth/AuthProvider'
import { canManageSiteContent } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { usePageMeta } from '@/lib/pageMeta'
import {
  deleteCmsBlog,
  prepareBlogForEditor,
  saveCmsBlog,
} from '@/lib/contentCmsApi'
import { extractContentMeta, estimateReadingStats } from '@/lib/contentBlocks'
import {
  SEO_LOCAL_GUIDES,
  buildBlogPostJsonLd,
  findBuiltInBlogPost,
} from '@/lib/seoLocalGuides'

function decoratePost(row) {
  if (!row) return null
  const meta = extractContentMeta(row.content_blocks)
  const stats = estimateReadingStats(row.content_blocks, row.excerpt)
  return {
    ...row,
    category: meta.category || row.category || 'Technical Guide',
    regionLabel: meta.region || row.regionLabel || 'Cavite & Batangas',
    ai_summary: meta.ai_summary || row.ai_summary || row.excerpt || '',
    read_minutes: Number(meta.read_minutes || row.read_minutes || stats.minutes || 4),
    featured: Boolean(meta.featured ?? row.featured),
  }
}

export default function BlogPostPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = canManageSiteContent(profile)
  const builtIn = useMemo(() => findBuiltInBlogPost(slug), [slug])
  const [post, setPost] = useState(() => decoratePost(builtIn))
  const [error, setError] = useState('')
  const [studioOpen, setStudioOpen] = useState(false)
  const [studioDraft, setStudioDraft] = useState(null)

  useEffect(() => {
    setPost(decoratePost(builtIn))
    setError('')
  }, [builtIn])

  const loadPost = useCallback(async () => {
    if (!slug) return
    const fallback = findBuiltInBlogPost(slug)
    let query = supabase
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, author_label, is_published, status, published_at, content_blocks')
      .eq('slug', slug)
    if (!canEdit) {
      query = query.eq('is_published', true).eq('status', 'published')
    }
    const { data, error: e } = await query.maybeSingle()
    if (data) {
      setPost(decoratePost(data))
      setError('')
    } else if (fallback) {
      setPost(decoratePost(fallback))
      setError('')
    } else if (e) {
      setError(e.message)
    } else {
      setError('Post not found.')
    }
  }, [slug, canEdit])

  useEffect(() => {
    loadPost()
  }, [loadPost])

  useEffect(() => {
    if (!slug) return undefined
    const channel = supabase
      ?.channel?.(`blog-post-live-${slug}`)
      ?.on('postgres_changes', { event: '*', schema: 'public', table: 'blogs' }, () => {
        loadPost()
      })
      ?.subscribe?.()
    return () => {
      if (channel) supabase?.removeChannel?.(channel)
    }
  }, [slug, loadPost])

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

  function openEditPost() {
    if (!post) return
    setStudioDraft(prepareBlogForEditor(post))
    setStudioOpen(true)
  }

  function openNewPost() {
    setStudioDraft(prepareBlogForEditor(null))
    setStudioOpen(true)
  }

  async function handleTogglePublish() {
    if (!post) return
    const nextPublished = !(post.is_published !== false && post.status !== 'draft')
    const prepared = prepareBlogForEditor({
      ...post,
      is_published: nextPublished,
      status: nextPublished ? 'published' : 'draft',
    })
    const res = await saveCmsBlog(prepared, { publish: nextPublished })
    if (!res.ok) {
      toast.error(res.error || 'Could not update article status')
      return
    }
    toast.success(nextPublished ? 'Article published' : 'Article moved to draft')
    if (res.data) setPost(decoratePost(res.data))
    else await loadPost()
  }

  async function handleDeletePost() {
    if (!post) return
    if (!window.confirm(`Delete "${post.title}"?`)) return
    if (post.isBuiltInGuide && String(post.id || '').startsWith('guide-')) {
      const archived = prepareBlogForEditor({
        ...post,
        is_published: false,
        status: 'archived',
      })
      const res = await saveCmsBlog({ ...archived, status: 'archived', is_published: false }, { publish: false })
      if (!res.ok) {
        toast.error(res.error || 'Could not archive guide')
        return
      }
      toast.success('Guide archived')
      navigate('/blog')
      return
    }
    const res = await deleteCmsBlog(post.id)
    if (!res.ok) {
      toast.error(res.error || 'Could not delete article')
      return
    }
    toast.success('Article deleted')
    navigate('/blog')
  }

  const relatedGuides = useMemo(
    () => SEO_LOCAL_GUIDES.filter((g) => g.slug !== slug).slice(0, 4),
    [slug],
  )

  const isDraft = post && (post.is_published === false || post.status === 'draft')

  return (
    <>
      <section className="inner-hero">
        <div className="public-shell" style={{ maxWidth: 780 }}>
          <p className="eyebrow eyebrow-light">
            {post?.regionLabel || post?.category || 'Blog'}
            {isDraft ? ' · DRAFT PREVIEW' : ''}
          </p>
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
          {canEdit && post ? (
            <div className="bd-cms-toolbar" role="region" aria-label="Article Studio Controls" style={{ marginBottom: 24 }}>
              <div className="bd-cms-toolbar-info">
                <span className="bd-cms-badge">
                  <Sparkles size={13} />
                  {isDraft ? 'Draft Mode' : 'Live Article'}
                </span>
                <span className="bd-cms-toolbar-text">
                  Edit blocks, upload WordPress-style photos, preview viewports, or manage publication status.
                </span>
              </div>
              <div className="bd-cms-toolbar-actions">
                <button type="button" className="bd-cms-btn is-primary" onClick={openEditPost}>
                  <Edit3 size={14} />
                  Edit Article
                </button>
                <button type="button" className="bd-cms-btn" onClick={handleTogglePublish}>
                  {isDraft ? <Eye size={14} /> : <EyeOff size={14} />}
                  {isDraft ? 'Publish Now' : 'Move to Draft'}
                </button>
                <button type="button" className="bd-cms-btn" onClick={openNewPost}>
                  <Plus size={14} />
                  New Article
                </button>
                <button type="button" className="bd-cms-btn is-danger" onClick={handleDeletePost}>
                  <Trash2 size={14} />
                  Delete
                </button>
                <Link to="/operations/content" className="bd-cms-btn is-link">
                  CMS Studio
                </Link>
              </div>
            </div>
          ) : null}

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

      {canEdit ? (
        <ContentStudioModal
          open={studioOpen}
          onOpenChange={setStudioOpen}
          kind="blog"
          initialData={studioDraft}
          onSaved={(saved) => {
            if (saved?.slug && saved.slug !== slug) {
              navigate(`/blog/${saved.slug}`)
            } else {
              loadPost()
            }
          }}
          onDeleted={() => navigate('/blog')}
        />
      ) : null}
    </>
  )
}
