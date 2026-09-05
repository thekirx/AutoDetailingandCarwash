import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'

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

  useReveal()

  return (
    <>
      <BdPageHero
        eyebrow="From the bay"
        title={
          <>
            Hakum
            <br />
            <em>Blog.</em>
          </>
        }
        copy="Detailing craft, ceramic care, and branch stories — written for drivers who care how a finish ages."
      />
      <section id="posts">
        <div className="bd-shell bd-catalog">
          {error ? (
            <p className="bd-state is-error" role="alert">
              {error}
            </p>
          ) : null}
          {!posts.length && !error ? (
            <p className="bd-state">No published posts yet. Check back soon.</p>
          ) : null}
          {posts.map((post) => (
            <article key={post.id} className="bd-post bd-reveal">
              {post.cover_url ? (
                <Link to={`/blog/${post.slug}`} className="bd-post-media">
                  <img src={post.cover_url} alt="" loading="lazy" />
                </Link>
              ) : null}
              <div className="bd-post-body">
                <p className="bd-event-date">
                  {post.author_label || 'Hakum'}
                  {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ''}
                </p>
                <h2>
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                {post.excerpt ? <p className="bd-post-excerpt">{post.excerpt}</p> : null}
                <Link className="bd-card-go" to={`/blog/${post.slug}`}>
                  Read this post
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
