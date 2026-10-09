import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Eye, History, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { resolvePosShellTab, summarizePendingHandoffs } from '@/lib/posInsights'
import { filterBranchesForProfile, pickDefaultBranchSlug } from '@/queue/queueLogic'
import DailySheetPanel from '@/pages/pos/DailySheetPanel'
import PosSheetHistory from '@/pages/pos/PosSheetHistory'
import PosTodayPanel from '@/pages/pos/PosTodayPanel'

/** Investor POS: today's numbers and Daily Sheet history for assigned branches. Nothing to ring up, edit, or approve. */
export default function PosReadOnlyView({ profile }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = resolvePosShellTab(searchParams.get('tab'), { readOnly: true })
  const [branches, setBranches] = useState([])
  const [branch, setBranch] = useState(() => pickDefaultBranchSlug(profile, []))
  const [handoffs, setHandoffs] = useState([])
  const [openSheet, setOpenSheet] = useState(null)

  useEffect(() => {
    listBranches()
      .then((rows) => {
        const scoped = filterBranchesForProfile(rows, profile)
        setBranches(scoped)
        setBranch((current) => (scoped.some((b) => b.slug === current) ? current : scoped[0]?.slug || ''))
      })
      .catch(() => setBranches([]))
  }, [profile])

  useEffect(() => {
    if (!branch) return
    supabase
      .from('pos_handoffs')
      .select('id, amount_minor, bookings(final_price_minor, price_minor)')
      .eq('status', 'pending')
      .eq('branch', branch)
      .then(({ data }) => setHandoffs(data || []))
  }, [branch])

  const branchLabel = branches.find((b) => b.slug === branch)?.name || branch || 'No branch assigned'
  const pending = useMemo(() => summarizePendingHandoffs(handoffs), [handoffs])

  const setTab = (next) => {
    setOpenSheet(null)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('tab', next)
      return params
    }, { replace: true })
  }

  return (
    <OpsPageShell
      className="hakum-pos"
      eyebrow="Investor · view only"
      title="POS"
      description={`Sales, cars waiting to pay, and Daily Sheets · ${branchLabel}`}
      meta={
        <>
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
          <span>{branchLabel}</span>
        </>
      }
      actions={
        branches.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Branch
            <select
              value={branch}
              onChange={(e) => {
                setOpenSheet(null)
                setBranch(e.target.value)
              }}
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            >
              {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </label>
        ) : null
      }
    >
      <p className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Eye className="size-4 shrink-0" aria-hidden />
        View only. Sales are rung up and Daily Sheets are filled in by the branch team.
      </p>

      {!branch ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-foreground">
          No branch is assigned to your account yet. Ask the Super Admin to assign one in People.
        </p>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="flex w-full flex-col gap-5">
          <OpsTabList
            aria-label="POS sections"
            tabs={[
              { id: 'dashboard', label: 'Today' },
              { id: 'history', label: 'Sheet history', icon: History },
            ]}
          />
          <TabsContent value="dashboard" className="mt-0 outline-none">
            {tab === 'dashboard' ? (
              <PosTodayPanel
                branch={branch}
                branchLabel={branchLabel}
                waitingCount={pending.count}
                waitingMinor={pending.totalMinor}
              />
            ) : null}
          </TabsContent>
          <TabsContent value="history" className="mt-0 outline-none">
            {tab === 'history' && openSheet ? (
              <div className="flex flex-col gap-4">
                <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setOpenSheet(null)}>
                  <ArrowLeft data-icon="inline-start" aria-hidden />
                  Back to sheet history
                </Button>
                <DailySheetPanel key={openSheet.id} mode="review" sheetId={openSheet.id} profile={profile} />
              </div>
            ) : null}
            {tab === 'history' && !openSheet ? (
              <PosSheetHistory branch={branch} branchLabel={branchLabel} onOpenSheet={(_, row) => setOpenSheet(row)} />
            ) : null}
          </TabsContent>
        </Tabs>
      )}
    </OpsPageShell>
  )
}
