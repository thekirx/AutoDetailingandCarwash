import { useId } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { merchPhoto } from '@/lib/pointsShop'
import { uploadContentMedia } from '@/lib/contentMedia'

export default function MerchItemFields({ value, onChange, disabled, onBusy, children }) {
  const id = useId()
  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      toast.error('Choose a JPG, PNG or WebP photo under 8 MB.'); return
    }
    onBusy(true)
    try { const photo_url = await uploadContentMedia(file); onChange({ ...value, photo_url }) }
    catch (err) { toast.error(err.message) }
    finally { onBusy(false) }
  }
  return <>
    <div className="space-y-2"><Label htmlFor={`${id}-photo`}>Photo</Label>
      <div className="flex flex-wrap items-center gap-3"><img src={merchPhoto(value)} alt={value.photo_url ? value.name : 'Placeholder photo'} className="size-22 rounded-lg border object-cover" />
        <div className="min-w-0 flex-1"><Input id={`${id}-photo`} aria-label="Upload photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={upload} />
          {!value.photo_url ? <p className="mt-1 text-xs text-muted-foreground">Placeholder photo · Upload a real Hakum photo.</p> : null}</div>
      </div>
    </div>
    <div className="space-y-2"><Label htmlFor={`${id}-name`}>Name</Label><Input id={`${id}-name`} value={value.name} required disabled={disabled} onChange={(e) => onChange({ ...value, name:e.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor={`${id}-desc`}>One-line description</Label><Input id={`${id}-desc`} value={value.description || ''} maxLength={240} disabled={disabled} onChange={(e) => onChange({ ...value, description:e.target.value })} /></div>
    {children}
    <div className="space-y-2"><Label htmlFor={`${id}-points`}>Points</Label><Input id={`${id}-points`} type="number" min="1" max="100000" step="1" required value={value.points_price ?? ''} disabled={disabled} onChange={(e) => onChange({ ...value, points_price:e.target.value })} />
      <p className="text-xs text-muted-foreground">Customers use this many points to claim it in the app. Same for every size.</p>
    </div>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value.show_in_app)} disabled={disabled} onChange={(e) => onChange({ ...value, show_in_app:e.target.checked })} />Show in the Hakum app</label>
  </>
}
