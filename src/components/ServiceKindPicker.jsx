import { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { formatMoney } from '@/queue/queueApi'
import { resolveServicePriceMinor } from '@/lib/servicePricing'
import { groupServicesByKind } from '@/lib/serviceKinds'

/**
 * Tablet-first multi-select for TL "add car": one searchable list, Services and Packages as sections.
 * Theme-safe via .floor-* classes (light overrides under .floor-shell and .command-shell).
 */
export default function ServiceKindPicker({
  services = [],
  selectedIds = [],
  vehicleType = 'medium',
  onChange,
  disabled = false,
  kinds = null,
}) {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds])
  const groups = useMemo(() => groupServicesByKind(services, kinds, query), [services, kinds, query])
  const selectedRows = useMemo(
    () => (services || []).filter((svc) => selectedSet.has(svc.id)),
    [services, selectedSet],
  )
  const totalMinor = selectedRows.reduce((sum, svc) => sum + resolveServicePriceMinor(svc, vehicleType), 0)

  const toggle = (serviceId) => {
    if (disabled) return
    const next = new Set(selectedIds || [])
    if (next.has(serviceId)) next.delete(serviceId)
    else next.add(serviceId)
    onChange([...next])
  }

  return (
    <fieldset className="sm:col-span-2 space-y-2" disabled={disabled}>
      <legend className="flex w-full items-baseline justify-between gap-3 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
        <span>Services &amp; packages *</span>
        {selectedRows.length ? (
          <span className="tabular-nums tracking-normal normal-case text-foreground">
            {selectedRows.length} picked · {formatMoney(totalMinor)}
          </span>
        ) : null}
      </legend>

      <div className="relative">
        <label className="sr-only" htmlFor="service-kind-search">Search services and packages</label>
        <div className="pointer-events-none absolute inset-y-0 left-3 z-[1] flex items-center text-muted-foreground">
          <Search size={16} aria-hidden />
        </div>
        <input
          id="service-kind-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search wash, wax, package…"
          className="floor-control !mt-0 !pl-10"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>

      <div className="floor-picker-list" role="listbox" aria-multiselectable="true" aria-label="Services and packages">
        {!groups.length ? (
          <p className="floor-picker-empty">
            {query ? `Nothing matches “${query}”.` : 'No services or packages yet. Ask Super Admin to add one under Catalog.'}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.id} role="group" aria-label={group.label}>
              <p className="floor-picker-group" aria-hidden>
                {group.label}
                <span>{group.rows.length}</span>
              </p>
              {group.rows.map((service) => {
                const checked = selectedSet.has(service.id)
                return (
                  <button
                    key={service.id}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(service.id)}
                    className={`floor-picker-item${checked ? ' floor-picker-item-checked' : ''}`}
                  >
                    <span className="floor-picker-item-check">
                      <Check size={14} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{service.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatMoney(resolveServicePriceMinor(service, vehicleType))}
                    </span>
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected services">
          {selectedRows.map((service) => (
            <span key={service.id} className="floor-chip-selected">
              <span className="truncate">{service.name}</span>
              <button
                type="button"
                onClick={() => toggle(service.id)}
                className="grid size-7 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                aria-label={`Remove ${service.name}`}
              >
                <X size={14} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </fieldset>
  )
}
