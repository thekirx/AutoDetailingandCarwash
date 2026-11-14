import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canManageSiteContent } from '@/auth/permissions'
import ContentStudioModal from '@/components/content/ContentStudioModal'
import {
  createEmptyBlogDraft,
  deleteCmsBlog,
  fetchAllCmsBlogs,
  prepareBlogForEditor,
  saveCmsBlog,
} from '@/lib/contentCmsApi'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'
import {
  SEO_COMPARISON_ROWS,
  SEO_LOCAL_FAQS,
  SEO_REGIONAL_PILLARS,
  mergeBlogPostsWithGuides,
} from '../lib/seoLocalGuides'

const REGION_FILTERS = [
  { id: 'all', label: 'All Guides & Stories' },
  { id: 'bacoor', label: 'Bacoor' },
  { id: 'batangas', label: 'Batangas City' },
  { id: 'imus', label: 'Imus' },
  { id: 'cavite', label: 'Cavite Province' },
  { id: 'craft', label: 'Paint & Ceramic Craft' },
]

export function BlogListSection() {
  const { profile } = useAuth()
  const canEdit = canManageSiteContent(profile)
  const [dbPosts, setDbPosts] = useState([])
  const [error, setError] = useState('')
  const [activeRegion, setActiveRegion] = useState('all')
  const [showDrafts, setShowDrafts] = useState(false)
  const [editorPost, setEditorPost] = useState(null)

  const loadBlogs = useCallback(async () => {
    if (canEdit) {
      const rows = await fetchAllCmsBlogs()
      setDbPosts(rows || [])
      return
    }
    const { data, error: e } = await supabase
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, author_label, published_at, status, is_published, content_blocks')
      .eq('is_published', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    if (e) setError('')
    setDbPosts(data || [])
  }, [canEdit])

  useEffect(() => {
    loadBlogs()
    const channel = supabase
      .channel('public-blogs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blogs' }, () => loadBlogs())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadBlogs])

  const allPosts = useMemo(
    () => mergeBlogPostsWithGuides(dbPosts, { includeDrafts: canEdit && showDrafts }),
    [dbPosts, canEdit, showDrafts],
  )

  const visiblePosts = useMemo(() => {
    if (activeRegion === 'all') return allPosts
    return allPosts.filter((p) => (p.region || 'craft') === activeRegion)
  }, [allPosts, activeRegion])

  async function handleQuickDelete(post) {
    if (!window.confirm(`Delete "${post.title}"?`)) return
    try {
      await deleteCmsBlog(post, profile)
      toast.success('Blog post deleted')
      loadBlogs()
    } catch (err) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  async function handleQuickTogglePublish(post) {
    try {
      const prepared = prepareBlogForEditor(post)
      const nextPublished = !prepared.is_published
      await saveCmsBlog(
        {
          ...prepared,
          status: nextPublished ? 'published' : 'draft',
          is_published: nextPublished,
        },
        profile,
      )
      toast.success(nextPublished ? 'Published live' : 'Moved to drafts')
      loadBlogs()
    } catch (err) {
      toast.error(err?.message || 'Update failed')
    }
  }

  return (
    <>
      <section id="blog" className="bd-community-blog">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div>
              <p className="bd-eyebrow">From the bay · Local guides &amp; craft</p>
              <h2 className="bd-skew">Blog &amp; regional guides.</h2>
            </div>
            <p>
              In-depth car wash, auto detailing, ceramic coating, and Paint Protection Film (PPF) guides for drivers in
              Bacoor, Batangas City, Imus, and across Cavite.
            </p>
          </div>

          {canEdit && (
            <div className="bd-cms-toolbar" role="region" aria-label="Blog CMS Controls">
              <div className="bd-cms-toolbar-info">
                <span className="bd-post-badge">CMS Studio Mode</span>
                <span>Signed in with Blog &amp; Events editing permissions.</span>
              </div>
              <div className="bd-cms-toolbar-actions">
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  onClick={() => setEditorPost(createEmptyBlogDraft())}
                >
                  <Plus size={15} aria-hidden="true" /> New Blog Post
                </button>
                <button
                  type="button"
                  className="bd-btn bd-btn-quiet"
                  onClick={() => setShowDrafts((v) => !v)}
                >
                  {showDrafts ? 'Showing Drafts & Published' : 'Show Drafts'}
                </button>
                <Link className="bd-btn bd-btn-quiet" to="/operations/content">
                  <Settings2 size={15} aria-hidden="true" /> Full Studio
                </Link>
              </div>
            </div>
          )}

          <div className="bd-blog-filters bd-reveal" role="tablist" aria-label="Filter blog guides by location or topic">
            {REGION_FILTERS.map((filter) => {
              const active = activeRegion === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`bd-blog-filter-pill ${active ? 'is-active' : ''}`}
                  onClick={() => setActiveRegion(filter.id)}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>

          <div className="bd-catalog">
            {error ? (
              <p className="bd-state is-error" role="alert">
                {error}
              </p>
            ) : null}
            {visiblePosts.map((post) => {
              const isPublished = Boolean(post.is_published ?? true) && post.status !== 'archived'
              return (
                <article key={post.id || post.slug} className="bd-post bd-reveal">
                  {post.cover_url ? (
                    <Link to={`/blog/${post.slug}`} className="bd-post-media">
                      <img src={post.cover_url} alt={post.title} loading="lazy" />
                    </Link>
                  ) : null}
                  <div className="bd-post-body">
                    <div className="bd-post-meta-row">
                      {post.regionLabel || post.category ? (
                        <span className="bd-post-badge">{post.regionLabel || post.category}</span>
                      ) : null}
                      {!isPublished && (
                        <span className="bd-post-badge is-draft">{post.status || 'Draft'}</span>
                      )}
                      <p className="bd-event-date">
                        {post.author_label || 'Hakum Auto Care'}
                        {post.read_minutes
                          ? ` · ${post.read_minutes} min read`
                          : post.published_at
                            ? ` · ${new Date(post.published_at).toLocaleDateString()}`
                            : ''}
                      </p>
                    </div>
                    <h2>
                      <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>
                    {post.excerpt ? <p className="bd-post-excerpt">{post.excerpt}</p> : null}
                    {post.highlights?.length ? (
                      <ul className="bd-post-highlights">
                        {post.highlights.slice(0, 2).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="bd-post-actions">
                      <Link className="bd-card-go" to={`/blog/${post.slug}`}>
                        Read full guide
                      </Link>
                      <Link className="bd-post-book-link" to={post.branch_info?.bookHref || '/book'}>
                        Book slot
                      </Link>
                    </div>
                    {canEdit && (
                      <div className="bd-cms-card-actions">
                        <button
                          type="button"
                          className="bd-cms-inline-btn"
                          onClick={() => setEditorPost(prepareBlogForEditor(post))}
                        >
                          <Pencil size={13} aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          className="bd-cms-inline-btn"
                          onClick={() => handleQuickTogglePublish(post)}
                        >
                          {isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          className="bd-cms-inline-btn is-danger"
                          onClick={() => handleQuickDelete(post)}
                        >
                          <Trash2 size={13} aria-hidden="true" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="regional-seo-hub" className="bd-seo-regions" aria-labelledby="regional-seo-heading">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div>
              <p className="bd-eyebrow">Where we serve</p>
              <h2 id="regional-seo-heading" className="bd-skew">
                Why drivers rank Hakum #1 across Cavite &amp; Batangas.
              </h2>
            </div>
            <p>
              Dedicated studio standards for every corridor—whether you commute daily through Bacoor, Batangas City,
              Imus, or anywhere in Cavite.
            </p>
          </div>

          <div className="bd-seo-pillar-grid">
            {SEO_REGIONAL_PILLARS.map((pillar) => (
              <article key={pillar.id} id={pillar.id} className="bd-seo-pillar-card bd-reveal">
                <div className="bd-seo-pillar-top">
                  <span className="bd-post-badge">{pillar.badge}</span>
                  <p className="bd-seo-pillar-sub">{pillar.subhead}</p>
                </div>
                <h3>
                  <Link to={`/blog/${pillar.guideSlug}`}>{pillar.heading}</Link>
                </h3>
                <p className="bd-seo-pillar-copy">{pillar.summary}</p>
                <div className="bd-seo-keyword-row" aria-label="Popular local services">
                  {pillar.keywords.map((kw) => (
                    <span key={kw} className="bd-seo-kw-chip">
                      {kw}
                    </span>
                  ))}
                </div>
                <div className="bd-cta-row bd-seo-pillar-actions">
                  <Link className="bd-btn bd-btn-primary" to={`/blog/${pillar.guideSlug}`}>
                    Read local guide
                  </Link>
                  <Link className="bd-btn bd-btn-quiet" to={pillar.bookHref}>
                    Book branch
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="studio-comparison" className="bd-seo-comparison" aria-labelledby="comparison-heading">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div>
              <p className="bd-eyebrow">Studio vs. standard wash</p>
              <h2 id="comparison-heading" className="bd-skew">
                The Hakum difference, side by side.
              </h2>
            </div>
            <p>
              How Hakum Auto Care compares against generic roadside car washes and dealership add-on packages in Bacoor,
              Batangas City, Imus, and Cavite.
            </p>
          </div>

          <div className="bd-comparison-table-wrap bd-reveal">
            <table className="bd-comparison-table">
              <thead>
                <tr>
                  <th scope="col">Detailing Standard</th>
                  <th scope="col" className="is-hakum">
                    Hakum Auto Care Studio
                  </th>
                  <th scope="col">Generic Roadside Wash</th>
                  <th scope="col">Dealership / Casa Add-On</th>
                </tr>
              </thead>
              <tbody>
                {SEO_COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td className="is-hakum">{row.hakum}</td>
                    <td>{row.roadside}</td>
                    <td>{row.dealership}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="local-seo-faq" className="bd-seo-faq" aria-labelledby="local-faq-heading">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div>
              <p className="bd-eyebrow">Direct answers</p>
              <h2 id="local-faq-heading" className="bd-skew">
                Local car wash &amp; detailing FAQ.
              </h2>
            </div>
            <p>
              Clear answers on branches, ceramic coating, Paint Protection Film (PPF), and booking in Bacoor, Batangas
              City, Imus, and Cavite.
            </p>
          </div>

          <div className="bd-faq-stack bd-reveal">
            {SEO_LOCAL_FAQS.map((item, index) => (
              <details key={item.question} className="bd-faq-item" open={index === 0}>
                <summary className="bd-faq-question">{item.question}</summary>
                <div className="bd-faq-answer">
                  <p>{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {canEdit && (
        <ContentStudioModal
          open={Boolean(editorPost)}
          onOpenChange={(open) => !open && setEditorPost(null)}
          kind="blog"
          initialValue={editorPost}
          profile={profile}
          onSaved={() => loadBlogs()}
          onDeleted={() => loadBlogs()}
        />
      )}
    </>
  )
}

export default function BlogPage() {
  useReveal()
  return (
    <>
      <BdPageHero
        eyebrow="From the bay"
        title={
          <>
            Hakum
            <br />
            <em>Blog &amp; Guides.</em>
          </>
        }
        copy="Detailing craft, ceramic care, and local studio guides for Bacoor, Batangas City, Imus, and Cavite."
      />
      <BlogListSection />
    </>
  )
}
