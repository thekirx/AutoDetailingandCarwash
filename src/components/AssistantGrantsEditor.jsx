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
 * ASA permission matrix for People create/edit (Roles & Permissions — no separate route).
 * @param {{ grants: Record<string, boolean>, onChange: (next: Record<string, boolean>) => void }} props
 */
export default function AssistantGrantsEditor({ grants, onChange }) {
  const enabled = countEnabledAssistantGrants(grants)
  const total = ASSISTANT_GRANT_KEYS.length

  function toggle(key) {
    onChange({ ...grants, [key]: !grants?.[key] })
  }

  function setGroup(keys, value) {
    const next = { ...grants }
    for (const key of keys) next[key] = value
    onChange(next)
  }

  return (
    <div className="grants-matrix flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Roles &amp; permissions</Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {enabled} of {total} on
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onChange(setAssistantGrantsPreset('defaults'))}>
          Defaults
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onChange(setAssistantGrantsPreset('safe'))}>
          Safe (no write)
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onChange(setAssistantGrantsPreset('all'))}>
          Enable all
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Safe turns off Finance write, Planning edit, and Edit other ASA grants. Defaults match new ASA accounts.
      </p>
      <div className="max-h-72 overflow-auto rounded-[var(--shape-card)] border border-border">
        <table className="w-full min-w-[20rem] border-collapse text-sm">
          <thead className="sticky top-0 z-[1] bg-card">
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2.5 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">Permission</th>
              <th className="hidden px-3 py-2.5 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase sm:table-cell">Group</th>
              <th className="w-20 px-3 py-2.5 text-center text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">On</th>
            </tr>
          </thead>
          <tbody>
            {ASSISTANT_GRANT_GROUPS.map((group) => {
              const groupOn = group.keys.every((k) => Boolean(grants?.[k]))
              return (
                <GrantGroupRows
                  key={group.id}
                  group={group}
                  groupOn={groupOn}
                  grants={grants}
                  onToggle={toggle}
                  onSetGroup={setGroup}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GrantGroupRows({ group, groupOn, grants, onToggle, onSetGroup }) {
  return (
    <>
      <tr className="border-b border-border bg-muted/40">
        <td colSpan={2} className="px-3 py-2 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          {group.label}
        </td>
        <td className="px-2 py-1.5 text-center">
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-lg text-[10px] font-bold tracking-wide text-primary uppercase hover:bg-primary/10"
            onClick={() => onSetGroup(group.keys, !groupOn)}
            aria-pressed={groupOn}
          >
            {groupOn ? 'All' : 'Set'}
          </button>
        </td>
      </tr>
      {group.keys.map((key) => {
        const on = Boolean(grants?.[key])
        return (
          <tr key={key} className="border-b border-border/70 last:border-0">
            <td className="px-3 py-1.5 font-medium text-foreground">{ASSISTANT_GRANT_LABELS[key] || key}</td>
            <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">{group.label}</td>
            <td className="px-2 py-1.5 text-center">
              <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-brand-primary)]"
                  checked={on}
                  onChange={() => onToggle(key)}
                  aria-label={`${ASSISTANT_GRANT_LABELS[key] || key} ${on ? 'on' : 'off'}`}
                />
              </label>
            </td>
          </tr>
        )
      })}
    </>
  )
}
