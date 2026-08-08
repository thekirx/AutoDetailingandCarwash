import { useEffect, useMemo, useState } from 'react'
import SuggestInput from './SuggestInput'
import {
  catalogMakes,
  catalogRowsToMap,
  filterCatalogMakes,
  filterCatalogModels,
  modelsForCatalogMake,
  resolveCatalogMake,
} from '../lib/vehicleCatalog'
import { supabase } from '../lib/supabase'

const FLOOR_INPUT =
  'mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-blue-300/60'
const PUBLIC_INPUT = undefined
const SUGGEST_LIMIT = 40

let cachedCatalog = null
let catalogPromise = null

async function loadCatalogMap() {
  if (cachedCatalog) return cachedCatalog
  if (!catalogPromise) {
    catalogPromise = supabase
      .from('vehicle_catalog')
      .select('make, model')
      .eq('is_active', true)
      .order('make')
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) {
          cachedCatalog = null
          throw error
        }
        // Same source as Super Admin Cars (active rows only). Empty = empty picker — no static fork.
        const map = catalogRowsToMap(data || [])
        cachedCatalog = map
        return map
      })
      .finally(() => {
        catalogPromise = null
      })
  }
  return catalogPromise
}

/**
 * Brand + model smart search.
 * Source of truth: Super Admin `vehicle_catalog` (is_active). No static PH fallback.
 */
export default function VehicleMakeModelFields({
  make,
  model,
  onMakeChange,
  onModelChange,
  required = true,
  variant = 'floor',
  makeLabel = 'Vehicle brand',
  modelLabel = 'Vehicle model',
}) {
  const [dbMap, setDbMap] = useState(cachedCatalog)
  const [loadState, setLoadState] = useState(cachedCatalog ? 'ready' : 'loading')

  useEffect(() => {
    let alive = true
    function apply(map) {
      if (!alive) return
      setDbMap(map)
      setLoadState(Object.keys(map || {}).length ? 'ready' : 'empty')
    }
    function fail() {
      if (!alive) return
      setDbMap(null)
      setLoadState('error')
    }
    setLoadState((s) => (s === 'ready' && cachedCatalog ? 'ready' : 'loading'))
    loadCatalogMap().then(apply).catch(fail)

    const channel = supabase
      .channel(`vehicle-catalog-picker:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_catalog' }, () => {
        clearVehicleCatalogCache()
        loadCatalogMap().then(apply).catch(fail)
      })
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [])

  const makeList = useMemo(() => catalogMakes(dbMap), [dbMap])

  const makeOptions = useMemo(
    () => (dbMap ? filterCatalogMakes(dbMap, make, SUGGEST_LIMIT) : []),
    [dbMap, make],
  )

  const modelOptions = useMemo(
    () => (dbMap ? filterCatalogModels(dbMap, make, model, SUGGEST_LIMIT) : []),
    [dbMap, make, model],
  )

  const inputClass =
    variant === 'floor'
      ? FLOOR_INPUT
      : variant === 'crm'
        ? 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none'
        : PUBLIC_INPUT

  const labelClass =
    variant === 'floor'
      ? 'text-xs font-bold tracking-[0.14em] text-slate-500 uppercase'
      : variant === 'crm'
        ? 'flex flex-col gap-2 text-sm font-medium'
        : ''

  const statusHint =
    loadState === 'loading'
      ? 'Loading brand list from Cars catalog…'
      : loadState === 'error'
        ? 'Could not load Cars catalog. Refresh and try again.'
        : loadState === 'empty'
          ? 'Cars catalog is empty. Super Admin can add brands under Operations → Cars.'
          : null

  return (
    <>
      <SuggestInput
        label={makeLabel}
        value={make}
        required={required}
        placeholder={loadState === 'ready' ? 'Toyota, Mitsubishi…' : 'Loading brands…'}
        options={makeOptions.length ? makeOptions : makeList.slice(0, SUGGEST_LIMIT)}
        className={labelClass}
        inputClassName={inputClass}
        disabled={loadState === 'loading'}
        onChange={(next) => {
          const canonical = resolveCatalogMake(dbMap, next)
          onMakeChange(canonical || next)
          const allowed = modelsForCatalogMake(dbMap, canonical || next)
          if (model && allowed.length && !allowed.some((m) => m.toLowerCase() === model.toLowerCase())) {
            onModelChange('')
          }
        }}
      />
      <SuggestInput
        label={modelLabel}
        value={model}
        required={required}
        placeholder={make ? `Models for ${make}` : 'Pick a brand first'}
        options={modelOptions}
        className={labelClass}
        inputClassName={inputClass}
        disabled={loadState === 'loading' || !make}
        onChange={(next) => {
          const models = modelsForCatalogMake(dbMap, make)
          const hit = models.find((m) => m.toLowerCase() === String(next || '').trim().toLowerCase())
          onModelChange(hit || next)
        }}
      />
      {statusHint && variant === 'public' ? (
        <p className="field-hint booking-span-2" role="status">
          {statusHint}
        </p>
      ) : null}
    </>
  )
}

/* eslint-disable-next-line react-refresh/only-export-components -- cache reset helper for tests/forms */
export function clearVehicleCatalogCache() {
  cachedCatalog = null
  catalogPromise = null
}
