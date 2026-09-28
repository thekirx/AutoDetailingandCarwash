import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import BdPageHero from '../components/public/bredesign/BdPageHero'
import useReveal from '../components/public/bredesign/useReveal'

export function BlogListSection() {
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
        if (e) setError('Stories are temporarily unavailable. Please check back soon.')
        setPosts(data || [])
      })
  }, [])

  return (
      <section id="blog" className="bd-community-blog">
        <div className="bd-shell">
          <div className="bd-head bd-reveal">
            <div><p className="bd-eyebrow">From the bay</p><h2 className="bd-skew">Latest stories.</h2></div>
            <p>Detailing craft, ceramic care, and branch stories for drivers who care how a finish ages.</p>
          </div>
          <div className="bd-catalog">
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
        </div>
      </section>
  )
}

export default function BlogPage() {
  useReveal()
  return (
    <>
      <BdPageHero
        eyebrow="From the bay"
        title={<>Hakum<br /><em>Blog.</em></>}
        copy="Detailing craft, ceramic care, and branch stories — written for drivers who care how a finish ages."
      />
      <BlogListSection />
    </>
  )
}
