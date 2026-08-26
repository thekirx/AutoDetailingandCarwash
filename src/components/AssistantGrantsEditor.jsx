import {
  ASSISTANT_GRANT_GROUPS,
  ASSISTANT_GRANT_KEYS,
  ASSISTANT_GRANT_LABELS,
  countEnabledAssistantGrants,
  setAssistantGrantsPreset,
} from '@/auth/permissions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

/**
 * Grouped ASA permission toggles for People create/edit.
 * @param {{ grants: Record<string, boolean>, onChange: (next: Record<string, boolean>) => void }} props
 */
export default function AssistantGrantsEditor({ grants, onChange }) {
  const enabled = countEnabledAssistantGrants(grants)
  const total = ASSISTANT_GRANT_KEYS.length

  function toggle(key) {
    onChange({ ...grants, [key]: !grants?.[key] })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Permission grants</Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {enabled} of {total} on
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(setAssistantGrantsPreset('defaults'))}>
          Defaults
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(setAssistantGrantsPreset('safe'))}>
          Safe (no write)
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(setAssistantGrantsPreset('all'))}>
          Enable all
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Safe turns off Finance write, Planning edit, and Edit other ASA grants. Defaults match new ASA accounts.
      </p>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
        {ASSISTANT_GRANT_GROUPS.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{group.label}</p>
            <div className="space-y-1.5">
              {group.keys.map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm" title={key}>
                  <input type="checkbox" checked={Boolean(grants?.[key])} onChange={() => toggle(key)} />
                  <span className="font-medium">{ASSISTANT_GRANT_LABELS[key] || key}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
