import { Archive, Edit3, RotateCcw, Send, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function statusActions(status) {
  if (status === 'archived') return [{ label: 'Restore', value: 'draft', icon: RotateCcw }]
  if (status === 'published') return [
    { label: 'Unpublish', value: 'draft', icon: RotateCcw },
    { label: 'Archive', value: 'archived', icon: Archive },
  ]
  return [
    { label: 'Publish', value: 'published', icon: Send },
    { label: 'Archive', value: 'archived', icon: Archive },
  ]
}

export default function ContentList({ title, description, items, emptyText, onEdit, onStatus, onDelete }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!items.length ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{emptyText}</p> : null}
        {items.map((item) => (
          <article key={item.id} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="truncate font-medium text-foreground">{item.title}</h3>
                <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>{item.status || 'draft'}</Badge>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{item.excerpt || item.description || 'No description'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)}><Edit3 /> Edit</Button>
              {statusActions(item.status || 'draft').map(({ label, value, icon: Icon }) => (
                <Button key={value} type="button" size="sm" variant="outline" onClick={() => onStatus(item, value)}><Icon /> {label}</Button>
              ))}
              <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(item)}><Trash2 /> Delete</Button>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  )
}
