import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Edit3, Eye, EyeOff, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import BlogArticlePreview from '@/components/content/BlogArticlePreview'
import ContentStudioModal from '@/components/content/ContentStudioModal'
import { useAuth } from '@/auth/AuthProvider'
import { canManageSiteContent } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { buildBreadcrumbJsonLd, usePageMeta } from '@/lib/pageMeta'
import {
  deleteCmsBlog,
  prepareBlogForEditor,
  saveCmsBlog,
} from '@/lib/contentCmsApi'
import { extractContentMeta, estimateReadingStats } from '@/lib/contentBlocks'
import {
  buildBlogPostJsonLd,
  findBuiltInBlogPost,
  mergeBlogPostsWithGuides,
} from '@/lib/seoLocalGuides'

function decoratePost(row) {
  if (!row) return null
  const meta = extractContentMeta(row)
  const stats = estimateReadingStats(row.content_blocks, row.title, row.excerpt)
  return {
    ...row,
    category: meta.category || row.category || 'Technical Guide',
    region: meta.region || row.region || 'all',
    regionLabel: row.regionLabel || meta.region || 'Cavite & Batangas',
    tags: meta.tags || row.tags || [],
    ai_summary: meta.ai_summary || row.ai_summary || row.excerpt || '',
    seo_title: meta.seo_title || row.seo_title || '',
    seo_description: meta.seo_description || row.seo_description || '',
    seo_keywords: meta.seo_keywords || row.seo_keywords || '',
    canonical_url: meta.canonical_url || row.canonical_url || '',
    og_image_url: meta.og_image_url || row.og_image_url || '',
    noindex: Boolean(meta.noindex ?? row.noindex),
    read_minutes: Number(meta.read_minutes || row.read_minutes || stats.readMinutes || 4),
    is_featured: Boolean(meta.is_featured ?? row.is_featured ?? row.featured),
  }
}

export default function BlogPostPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = canManageSiteContent(profile)
  const builtIn = useMemo(() => findBuiltInBlogPost(slug), [slug])
  const [post, setPost] = useState(() => decoratePost(builtIn))
  const [allFeedPosts, setAllFeedPosts] = useState(() => mergeBlogPostsWithGuides([]))
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
    const selectCols =
      'id, title, slug, excerpt, cover_url, author_label, status, is_published, published_at, updated_at, content_blocks'

    let postQuery = supabase.from('blogs').select(selectCols).eq('slug', slug)
    if (!canEdit) {
      postQuery = postQuery.in('status', ['published', 'scheduled'])
    }
    const [postRes, feedRes] = await Promise.all([
      postQuery.maybeSingle(),
      supabase
        .from('blogs')
        .select('id, title, slug, excerpt, cover_url, author_label, status, is_published, published_at, updated_at, content_blocks')
        .in('status', ['published', 'scheduled'])
        .order('published_at', { ascending: false })
        .limit(60),
    ])

    const mergedFeed = mergeBlogPostsWithGuides(feedRes.data || [])
    setAllFeedPosts(mergedFeed)

    if (postRes.data) {
      setPost(decoratePost(postRes.data))
      setError('')
    } else if (fallback) {
      setPost(decoratePost(fallback))
      setError('')
    } else if (postRes.error) {
      setError(postRes.error.message)
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

  const articleJsonLd = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.hakumautocare.com'
    const blogLd = buildBlogPostJsonLd(post, origin)
    if (!blogLd) return null
    const crumbLd = buildBreadcrumbJsonLd(
      [
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: post?.title || slug, path: `/blog/${slug}` },
      ],
      origin,
    )
    return { '@context': 'https://schema.org', '@graph': [blogLd, crumbLd] }
  }, [post, slug])

  // Post links get pasted into Facebook and WhatsApp; before this every one of
  // them scraped as the homepage (BUG-051).
  usePageMeta({
    title: post?.seo_title || post?.title || 'Article not found',
    description: post?.seo_description || post?.excerpt || post?.ai_summary,
    path: slug ? `/blog/${slug}` : '/blog',
    image: post?.og_image_url || post?.cover_url || '/og-image.png',
    ogType: post ? 'article' : 'website',
    keywords: post?.seo_keywords || (Array.isArray(post?.tags) ? post.tags.join(', ') : ''),
    canonical: post?.canonical_url || '',
    article: post
      ? {
        publishedTime: post.published_at || '',
        modifiedTime: post.updated_at || post.published_at || '',
        section: post.category || '',
        author: post.author_label || 'Hakum Auto Care',
      }
      : null,
    noindex: Boolean((error && !post) || post?.noindex),
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
    const currentlyPublished = post.status === 'published' && post.is_published !== false
    const nextPublished = !currentlyPublished
    try {
      const prepared = prepareBlogForEditor({
        ...post,
        is_published: nextPublished,
        status: nextPublished ? 'published' : 'draft',
      })
      const res = await saveCmsBlog(prepared, { publish: nextPublished })
      toast.success(nextPublished ? 'Article published' : 'Article moved to draft')
      if (res?.data || res?.slug) setPost(decoratePost(res.data || res))
      else await loadPost()
    } catch (err) {
      toast.error(err?.message || 'Could not update article status')
    }
  }

  async function handleDeletePost() {
    if (!post) return
    const isBuiltInOnly =
      Boolean(post.is_builtin_guide || post.isBuiltInGuide) && !/^[0-9a-f-]{36}$/i.test(String(post.id || ''))
    const verb = isBuiltInOnly ? 'Archive' : 'Delete'
    if (!window.confirm(`${verb} "${post.title}"?`)) return
    try {
      await deleteCmsBlog(post, profile)
      toast.success(isBuiltInOnly ? 'Guide archived' : 'Article deleted')
      navigate('/blog')
    } catch (err) {
      toast.error(err?.message || `Could not ${verb.toLowerCase()} article`)
    }
  }

  const relatedGuides = useMemo(() => {
    const others = allFeedPosts.filter((g) => g.slug && g.slug !== slug)
    if (!post) return others.slice(0, 4)
    const curTags = new Set(Array.isArray(post.tags) ? post.tags : [])
    const scored = others.map((candidate) => {
      let pts = 0
      if (candidate.category && candidate.category === post.category) pts += 3
      if (candidate.region && candidate.region === post.region && post.region !== 'all') pts += 3
      for (const t of Array.isArray(candidate.tags) ? candidate.tags : []) {
        if (curTags.has(t)) pts += 2
      }
      if (candidate.is_featured) pts += 1
      return { candidate, pts }
    })
    scored.sort((a, b) => b.pts - a.pts)
    return scored.slice(0, 4).map((x) => x.candidate)
  }, [allFeedPosts, post, slug])

  const { prevPost, nextPost } = useMemo(() => {
    const idx = allFeedPosts.findIndex((g) => g.slug === slug)
    if (idx < 0) return { prevPost: null, nextPost: null }
    return {
      prevPost: idx + 1 < allFeedPosts.length ? allFeedPosts[idx + 1] : null,
      nextPost: idx - 1 >= 0 ? allFeedPosts[idx - 1] : null,
    }
  }, [allFeedPosts, slug])

  const isDraft = post && (post.is_published === false || post.status === 'draft' || post.status === 'archived')

  const studioToolbar = canEdit && post ? (
    <div className="bd-cms-toolbar" role="region" aria-label="Article Studio Controls">
      <div className="bd-cms-toolbar-info">
        <span className="bd-cms-badge">
          <Sparkles size={13} />
          {isDraft ? 'Draft Mode' : 'Live Article'}
        </span>
        <span className="bd-cms-toolbar-text">
          Edit blocks, upload WordPress-style photos, preview full screen in real time, or update status.
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
  ) : null

  return (
    <>
      {error && !post ? (
        <section className="bredesign bd-sec" style={{ paddingTop: 140, minHeight: '60vh' }}>
          <div className="bd-wrap" style={{ maxWidth: 780 }}>
            <p className="bd-eyebrow">Hakum Journal</p>
            <h1>Article unavailable</h1>
            <p style={{ marginTop: 14, color: 'rgba(241, 241, 237, 0.84)' }}>{error}</p>
            <p style={{ marginTop: 24 }}>
              <Link to="/blog" className="hakum-block-cta is-primary">
                Back to Journal &amp; Guides
              </Link>
            </p>
          </div>
        </section>
      ) : (
        <BlogArticlePreview
          post={post || { title: 'Loading Hakum Journal…' }}
          relatedGuides={relatedGuides}
          prevPost={prevPost}
          nextPost={nextPost}
          toolbar={
            <>
              {studioToolbar}
              {error ? (
                <p className="form-error" style={{ marginTop: 12 }}>
                  {error}
                </p>
              ) : null}
            </>
          }
        />
      )}

      {canEdit ? (
        <ContentStudioModal
          open={studioOpen}
          onOpenChange={setStudioOpen}
          kind="blog"
          profile={profile}
          initialValue={studioDraft}
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
