import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { allowedReviewAssigneePatch } from '@/lib/plannerTasks'
import { toast } from 'sonner'

export default function PlanningReviewPanel({ items = [], canEdit, onChanged }) {
  const [previews, setPreviews] = useState({})

  useEffect(() => {
    const paths = items.map((row) => row.assignee.proof_url).filter(Boolean)
    if (!paths.length) {
      setPreviews({})
      return
    }
    let cancelled = false
    supabase.storage.from('plan-proofs').createSignedUrls(paths, 3600).then(({ data, error }) => {
      if (cancelled || error) return
      const next = {}
      for (const row of data || []) {
        if (row.path && row.signedUrl) next[row.path] = row.signedUrl
      }
      setPreviews(next)
    })
    return () => {
      cancelled = true
    }
  }, [items.map((row) => row.assignee.proof_url).join('|')])

  async function act(row, action) {
    if (!canEdit) return
    const patch = allowedReviewAssigneePatch(row.assignee, action)
    if (!patch) return
    const { error } = await supabase.from('plan_card_assignees').update(patch).eq('id', row.assignee.id)
    if (error) return toast.error(error.message)
    toast.success(action === 'accept' ? 'Accepted' : 'Sent back')
    onChanged()
  }

  if (!items.length) {
    return (
      <div className="planner-empty">
        <strong>Nothing waiting for review</strong>
        <p>Proof submissions land here. Accept them or send the person back to work.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {items.map((row) => {
        const preview = row.assignee.proof_url ? previews[row.assignee.proof_url] : null
        return (
          <article key={row.assignee.id} className="planner-review-card planner-ticket">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">{row.card.list_title}</p>
              <h3 className="mt-1 text-lg font-semibold">{row.card.title}</h3>
              <p className="text-sm text-muted-foreground">
                {row.assignee.staff_profiles?.full_name || 'Assignee'}
                {row.assignee.proof_note ? ` · ${row.assignee.proof_note}` : ''}
              </p>
              {preview ? (
                <img src={preview} alt="Proof photo" className="mt-3 max-h-48 rounded-xl border border-border object-cover" />
              ) : row.assignee.proof_url ? (
                <p className="mt-1 text-xs text-muted-foreground">Photo attached</p>
              ) : null}
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => act(row, 'accept')}>Accept</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => act(row, 'return')}>Send back</Button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
