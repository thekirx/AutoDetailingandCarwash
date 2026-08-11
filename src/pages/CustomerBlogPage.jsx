import { useEffect, useState } from 'react'
import { Newspaper } from 'lucide-react'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { supabase } from '@/lib/supabase'

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
      <CustomerAppFrame title={active.title} onBack={() => setActive(null)}>
        {active.cover_url ? <img className="capp-cover" src={active.cover_url} alt="" /> : null}
        <div className="capp-article capp-ticket">
          <ContentBlockRenderer mobile blocks={active.content_blocks} />
        </div>
      </CustomerAppFrame>
    )
  }

  return (
    <CustomerAppFrame title="Blog" subtitle="Care tips and bay stories from Hakum." backTo="/account">
      {loading && !error ? (
        <>
          <div className="capp-skel" aria-hidden />
          <div className="capp-skel" aria-hidden />
        </>
      ) : null}
      {error ? <p className="capp-empty" role="alert">{error}</p> : null}
      {!loading && !posts.length && !error ? (
        <div className="capp-empty">No posts yet. Check back after the next bay story.</div>
      ) : null}
      {posts.map((post) => (
        <button key={post.id} type="button" className="capp-row" onClick={() => setActive(post)}>
          {post.cover_url ? (
            <img className="capp-thumb" src={post.cover_url} alt="" />
          ) : (
            <Newspaper className="capp-thumb" style={{ padding: '0.9rem' }} />
          )}
          <span>
            <strong>{post.title}</strong>
            <em>{post.excerpt || post.author_label}</em>
          </span>
        </button>
      ))}
    </CustomerAppFrame>
  )
}
