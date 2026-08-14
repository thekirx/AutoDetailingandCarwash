import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ContentBlockRenderer from '@/components/content/ContentBlockRenderer'
import { supabase } from '@/lib/supabase'

export default function BlogPostPage() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    supabase
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, author_label, published_at, content_blocks')
      .eq('slug', slug)
      .eq('is_published', true)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        else if (!data) setError('Post not found.')
        else setPost(data)
      })
  }, [slug])

  return (
    <>
      <section className="inner-hero">
        <div className="public-shell" style={{ maxWidth: 720 }}>
          <p className="eyebrow eyebrow-light">Blog</p>
          <h1 className="display-title">{post?.title || 'Blog'}</h1>
          {post && (
            <p className="inner-hero-copy">
              {post.author_label || 'Hakum Auto Care'}
              {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ''}
            </p>
          )}
        </div>
      </section>
      <section className="content-section">
        <div className="public-shell hakum-article" style={{ maxWidth: 720 }}>
          {error && <p className="form-error">{error}</p>}
          {post?.cover_url ? (
            <img className="hakum-article-cover" src={post.cover_url} alt="" />
          ) : null}
          {post && <ContentBlockRenderer blocks={post.content_blocks} />}
          <p className="hakum-article-footer">
            <Link className="dark-link" to="/blog">All posts</Link>
            {' · '}
            <Link className="dark-link" to="/events">Events</Link>
            {' · '}
            <Link className="dark-link" to="/book">Book a visit</Link>
          </p>
        </div>
      </section>
    </>
  )
}
