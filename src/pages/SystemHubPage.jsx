import { Suspense, lazy, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Database, ScrollText, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessAudit, canAccessDataCenter } from '@/auth/permissions'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { resolveOpsTab } from '@/lib/opsShell'

const AuditLogPage = lazy(() => import('@/pages/AuditLogPage'))
const DataCenterPage = lazy(() => import('@/pages/DataCenterPage'))

const SYSTEM_SHELL_TABS = Object.freeze([
  { id: 'audit', label: 'Audit log', icon: ScrollText },
  { id: 'data-center', label: 'Data Center', icon: Database },
])

/**
 * Unified System & Data hub — combines immutable admin Audit Log and
 * Super Admin-only Data Center export/import/purge controls behind strict RBAC.
 */
export default function SystemHubPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const canAudit = canAccessAudit(profile)
  const canData = canAccessDataCenter(profile)

  const visibleTabs = useMemo(
    () =>
      SYSTEM_SHELL_TABS.filter((t) => {
        if (t.id === 'audit') return canAudit
        if (t.id === 'data-center') return canData
        return false
      }),
    [canAudit, canData],
  )

  if (!visibleTabs.length) {
    return <Navigate to="/operations/access-denied" replace />
  }

  const defaultTab = visibleTabs[0].id
  const tab = resolveOpsTab(searchParams.get('tab'), visibleTabs.map((t) => t.id), defaultTab)

  function setShellTab(next) {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (next === defaultTab) n.delete('tab')
      else n.set('tab', next)
      return n
    }, { replace: true })
  }

  const loadingPanel = <Skeleton className="h-64 rounded-2xl" />

  return (
    <OpsPageShell
      className="hakum-system-hub hakum-audit hakum-data-center"
      eyebrow="Operations Insight"
      title="System & Data"
      icon={ShieldCheck}
      description="Governance audit trail, catalog/CRM JSON portability, PITR readiness, and safe retention cleanup."
    >
      <Tabs value={tab} onValueChange={setShellTab} className="flex flex-col gap-5">
        {visibleTabs.length > 1 ? <OpsTabList tabs={visibleTabs} aria-label="System & Data sections" /> : null}

        {canAudit ? (
          <TabsContent value="audit" className="mt-0 outline-none">
            <Suspense fallback={loadingPanel}>
              <AuditLogPage embedded />
            </Suspense>
          </TabsContent>
        ) : null}

        {canData ? (
          <TabsContent value="data-center" className="mt-0 outline-none">
            <Suspense fallback={loadingPanel}>
              <DataCenterPage embedded />
            </Suspense>
          </TabsContent>
        ) : null}
      </Tabs>
    </OpsPageShell>
  )
}
