import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function BlogPage() {
  const [posts, setPosts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, author_label, published_at')
      .eq('is_published', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        setPosts(data || [])
      })
  }, [])

  return (
    <>
      <section className="inner-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">From the bay</p>
          <h1 className="display-title">Hakum Journal.</h1>
          <p className="inner-hero-copy">Detailing craft, ceramic care, and branch stories - written for drivers who care how a finish ages.</p>
        </div>
      </section>
      <section className="content-section">
        <div className="public-shell hakum-blog-grid">
          {error && <p className="form-error">{error}</p>}
          {!posts.length && !error && <p>No published posts yet. Check back soon.</p>}
          {posts.map((post) => (
            <article key={post.id} className="hakum-blog-card">
              {post.cover_url ? (
                <Link to={`/blog/${post.slug}`} className="hakum-blog-card-media">
                  <img src={post.cover_url} alt="" loading="lazy" />
                </Link>
              ) : null}
              <div className="hakum-blog-card-body">
                <p className="hakum-blog-meta">
                  {post.author_label || 'Hakum'}
                  {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ''}
                </p>
                <h2>
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
                <Link className="button button-blue" to={`/blog/${post.slug}`}>Read</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
