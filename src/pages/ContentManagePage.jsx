import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import ContentList from '@/components/content/ContentList'
import EventEditor from '@/components/content/EventEditor'
import PostEditor from '@/components/content/PostEditor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  deleteContent,
  listEvents,
  listPosts,
  saveEvent,
  savePost,
  uploadContentMedia,
} from '@/lib/contentAdmin'
import { supabase } from '@/lib/supabase'

function postInput(row, status = row.status) {
  return {
    title: row.title,
    excerpt: row.excerpt,
    sourceUrl: row.source_url,
    mediaUrl: row.media_url,
    platform: row.platform,
    ctaLabel: row.cta_label,
    status,
    publishedAt: status === 'published' ? row.published_at : null,
  }
}

function eventInput(row, status = row.status) {
  return {
    title: row.title,
    description: row.description,
    branch: row.branch,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status,
    locationText: row.location_text,
    sourceUrl: row.source_url,
    registrationUrl: row.registration_url,
    mediaUrl: row.banner_url,
    platform: row.platform,
    ctaLabel: row.cta_label,
  }
}

function errorMessage(error) {
  if (!error) return 'The content change could not be saved.'
  if (typeof error === 'string') return error
  if (error.message) return error.message
  const first = Object.values(error)[0]
  return first || 'The content change could not be saved.'
}

export default function ContentManagePage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [events, setEvents] = useState([])
  const [editingPost, setEditingPost] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadPosts = useCallback(async () => {
    const result = await listPosts(supabase)
    if (result.error) toast.error(errorMessage(result.error))
    else setPosts(result.data || [])
  }, [])

  const loadEvents = useCallback(async () => {
    const result = await listEvents(supabase)
    if (result.error) toast.error(errorMessage(result.error))
    else setEvents(result.data || [])
  }, [])

  useEffect(() => { loadPosts(); loadEvents() }, [loadEvents, loadPosts])

  async function uploadIfNeeded(file, kind) {
    if (!file) return null
    const result = await uploadContentMedia(supabase, { file, kind, userId: user?.id })
    if (result.error) throw new Error(errorMessage(result.error))
    return result.data.publicUrl
  }

  async function handleSavePost(form, file) {
    setBusy(true)
    try {
      const mediaUrl = await uploadIfNeeded(file, 'posts')
      const result = await savePost(supabase, mediaUrl ? { ...form, mediaUrl } : form, editingPost?.id)
      if (result.error) throw new Error(errorMessage(result.error))
      toast.success(editingPost ? 'Post updated' : 'Post created')
      setEditingPost(null)
      await loadPosts()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEvent(form, file) {
    setBusy(true)
    try {
      const mediaUrl = await uploadIfNeeded(file, 'events')
      const result = await saveEvent(supabase, mediaUrl ? { ...form, mediaUrl } : form, editingEvent?.id)
      if (result.error) throw new Error(errorMessage(result.error))
      toast.success(editingEvent ? 'Event updated' : 'Event created')
      setEditingEvent(null)
      await loadEvents()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(kind, item, status) {
    setBusy(true)
    const result = kind === 'post'
      ? await savePost(supabase, postInput(item, status), item.id)
      : await saveEvent(supabase, eventInput(item, status), item.id)
    setBusy(false)
    if (result.error) return toast.error(errorMessage(result.error))
    toast.success(status === 'published' ? 'Content published' : `Content moved to ${status}`)
    return kind === 'post' ? loadPosts() : loadEvents()
  }

  async function remove(kind, item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return
    setBusy(true)
    const table = kind === 'post' ? 'social_posts' : 'events'
    const result = await deleteContent(supabase, table, item.id)
    setBusy(false)
    if (result.error) return toast.error(errorMessage(result.error))
    toast.success(kind === 'post' ? 'Post deleted' : 'Event deleted')
    return kind === 'post' ? loadPosts() : loadEvents()
  }

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Marketing Content</p>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Posts and Events</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Published content is shared with the public Hakum website. Drafts and archived content stay inside the Team Portal.</p>
      </header>
      <Tabs defaultValue="posts">
        <TabsList aria-label="Content type">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="grid gap-5 pt-4">
          <PostEditor item={editingPost} busy={busy} onSave={handleSavePost} onCancel={() => setEditingPost(null)} />
          <ContentList title="Posts" description="Latest Post previews and original social links." items={posts} emptyText="No Posts have been created yet." onEdit={setEditingPost} onStatus={(item, status) => changeStatus('post', item, status)} onDelete={(item) => remove('post', item)} />
        </TabsContent>
        <TabsContent value="events" className="grid gap-5 pt-4">
          <EventEditor item={editingEvent} busy={busy} onSave={handleSaveEvent} onCancel={() => setEditingEvent(null)} />
          <ContentList title="Events" description="The existing Events and Meets records, now with managed public previews." items={events} emptyText="No published events yet. Check back soon." onEdit={setEditingEvent} onStatus={(item, status) => changeStatus('event', item, status)} onDelete={(item) => remove('event', item)} />
        </TabsContent>
      </Tabs>
    </main>
  )
}
