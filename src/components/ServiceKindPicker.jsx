import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { formatMoney } from '@/queue/queueApi'
import { resolveServicePriceMinor } from '@/lib/servicePricing'
import {
  SERVICE_KINDS,
  filterServicesByKind,
  searchServices,
  serviceKindFromPayCategory,
} from '@/lib/serviceKinds'

/**
 * Tablet-first multi-select for TL "add car": kind tabs + search + dropdown list.
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
  const kindTabs = useMemo(() => {
    if (!Array.isArray(kinds) || !kinds.length) return SERVICE_KINDS
    const allow = new Set(kinds)
    return SERVICE_KINDS.filter((k) => allow.has(k.id))
  }, [kinds])

  const [kind, setKind] = useState(() => kindTabs[0]?.id || 'service')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!kindTabs.some((k) => k.id === kind)) setKind(kindTabs[0]?.id || 'service')
  }, [kindTabs, kind])

  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds])

  const kindServices = useMemo(() => filterServicesByKind(services, kind), [services, kind])
  const filtered = useMemo(() => searchServices(kindServices, query), [kindServices, query])

  const selectedRows = useMemo(
    () => (services || []).filter((svc) => selectedSet.has(svc.id)),
    [services, selectedSet],
  )

  const kindMeta = kindTabs.find((k) => k.id === kind) || kindTabs[0] || SERVICE_KINDS[0]

  const toggle = (serviceId) => {
    if (disabled) return
    const next = new Set(selectedIds || [])
    if (next.has(serviceId)) next.delete(serviceId)
    else next.add(serviceId)
    onChange([...next])
  }

  const remove = (serviceId) => {
    if (disabled) return
    onChange((selectedIds || []).filter((id) => id !== serviceId))
  }

  return (
    <fieldset className="sm:col-span-2 space-y-3" disabled={disabled}>
      <legend className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
        Services for this visit
      </legend>

      <div className="floor-kind-tabs" role="tablist" aria-label="Service kind">
        {kindTabs.map((row) => {
          const active = kind === row.id
          const count = filterServicesByKind(services, row.id).length
          return (
            <button
              key={row.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setKind(row.id)
                setQuery('')
                setOpen(true)
              }}
              className={`floor-touch-btn floor-kind-tab ${active ? 'floor-kind-tab-active' : ''}`}
            >
              <span className="block">{row.shortLabel}</span>
              <span className="floor-kind-tab-count">{count}</span>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">{kindMeta.hint}</p>

      <div className="relative">
        <label className="sr-only" htmlFor="service-kind-search">
          Search {kindMeta.label}
        </label>
        <div className="pointer-events-none absolute inset-y-0 left-3 z-[1] flex items-center text-muted-foreground">
          <Search size={16} aria-hidden />
        </div>
        <input
          id="service-kind-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${kindMeta.label.toLowerCase()}…`}
          className="floor-control !mt-0 pl-10 pr-12"
          autoComplete="off"
        />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="service-kind-listbox"
          onClick={() => setOpen((v) => !v)}
          className="absolute inset-y-0 right-0 z-[1] grid min-w-12 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground"
        >
          <ChevronsUpDown size={18} aria-hidden />
          <span className="sr-only">{open ? 'Close list' : 'Open list'}</span>
        </button>
      </div>

      {open && (
        <ul
          id="service-kind-listbox"
          role="listbox"
          aria-multiselectable="true"
          className="floor-picker-list"
        >
          {!filtered.length ? (
            <li className="floor-picker-empty">
              No {kindMeta.label.toLowerCase()} match. Ask Super Admin to add one under Catalog.
            </li>
          ) : (
            filtered.map((service) => {
              const checked = selectedSet.has(service.id)
              const sized = resolveServicePriceMinor(service, vehicleType)
              return (
                <li key={service.id} role="option" aria-selected={checked}>
                  <button
                    type="button"
                    onClick={() => toggle(service.id)}
                    className={`floor-picker-item${checked ? ' floor-picker-item-checked' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{service.name}</span>
                      <span className="floor-picker-item-meta">
                        {serviceKindFromPayCategory(service.pay_category)} · {formatMoney(sized)}
                      </span>
                    </span>
                    <span className="floor-picker-item-check">
                      <Check size={14} aria-hidden />
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Selected services">
          {selectedRows.map((service) => (
            <span key={service.id} className="floor-chip-selected">
              <span className="truncate">{service.name}</span>
              <button
                type="button"
                onClick={() => remove(service.id)}
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
