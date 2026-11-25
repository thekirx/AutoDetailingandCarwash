import { Link } from 'react-router-dom'
import { MapPinOff } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { resolvePostLoginPath } from '@/auth/authRedirect'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'

/** In-shell 404 for unknown /operations/* URLs so staff stay inside Hakum Ops navigation. */
export default function OpsNotFoundPage() {
  const { profile } = useAuth()
  const homeTo = resolvePostLoginPath(profile, null) || '/operations'

  return (
    <OpsPageShell
      eyebrow="Navigation"
      title="Operations page not found"
      icon={MapPinOff}
      breadcrumbs={[{ label: 'Ops', to: homeTo }, { label: 'Not found' }]}
      description="That operations route does not exist or may have moved to another hub."
    >
      <div className="max-w-lg rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm text-muted-foreground">
          Check the URL, use the sidebar or command search (⌘K), or return to your role&apos;s home workspace.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild className="min-h-11">
            <Link to={homeTo}>Go to Ops home</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/operations/settings">Settings hub</Link>
          </Button>
        </div>
      </div>
    </OpsPageShell>
  )
}
