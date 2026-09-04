import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { Skeleton } from '@/components/customer/CustomerUi'
import { supabase } from '@/lib/supabase'

/** Read time from the block text; falls back to the excerpt so every card shows one. */
function readMinutes(post) {
  const text = [post.excerpt, ...(post.content_blocks || []).map((b) => b?.text || b?.content || '')].join(' ')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomerBlogPage() {
  const [posts, setPosts] = useState([])
  const [active, setActive] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, author_label, published_at, content_blocks')
      .eq('is_published', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        setPosts(data || [])
        setLoading(false)
      })
  }, [])

  if (active) {
    return (
      <CustomerAppFrame title={active.title} subtitle={[active.author_label, formatDate(active.published_at)].filter(Boolean).join(' · ')} onBack={() => setActive(null)}>
        {active.cover_url ? <img className="capp-cover" src={active.cover_url} alt="" /> : null}
        <article className="capp-article capp-card">
          <ContentBlockRenderer mobile blocks={active.content_blocks} />
        </article>
      </CustomerAppFrame>
    )
  }

  return (
    <CustomerAppFrame title="Blog" subtitle="Tips, stories, and everything automotive." backTo="/account" cols>
      {loading && !error ? (
        <div className="capp-span">
          <Skeleton n={2} />
        </div>
      ) : null}
      {error ? (
        <p className="capp-empty capp-span" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !posts.length && !error ? <div className="capp-empty capp-span">No posts yet. Check back after the next bay story.</div> : null}
      {posts.map((post) => (
        <button key={post.id} type="button" className="capp-post" onClick={() => setActive(post)}>
          {post.cover_url ? <img className="capp-post-cover" src={post.cover_url} alt="" loading="lazy" /> : null}
          <span className="capp-post-body">
            <h3>{post.title}</h3>
            {post.excerpt ? <p>{post.excerpt}</p> : null}
            <span className="capp-post-meta">
              <span>
                {formatDate(post.published_at)} · {readMinutes(post)} min read
              </span>
              <ArrowRight size={16} strokeWidth={2} aria-hidden />
            </span>
          </span>
        </button>
      ))}
    </CustomerAppFrame>
  )
}
