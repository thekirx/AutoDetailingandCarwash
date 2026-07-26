import { useEffect, useMemo, useState } from 'react'
import SuggestInput from './SuggestInput'
import { filterVehicleMakes, filterVehicleModels, PH_VEHICLE_MAKES, modelsForMake } from '../lib/phVehicles'
import { supabase } from '../lib/supabase'

const FLOOR_INPUT =
  'mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-blue-300/60'
const PUBLIC_INPUT = undefined

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
        if (error || !data?.length) {
          cachedCatalog = null
          return null
        }
        const map = {}
        for (const row of data) {
          if (!map[row.make]) map[row.make] = []
          if (!map[row.make].includes(row.model)) map[row.make].push(row.model)
        }
        cachedCatalog = map
        return map
      })
      .finally(() => {
        catalogPromise = null
      })
  }
  return catalogPromise
}

function makesFromMap(map) {
  return Object.keys(map || {}).sort((a, b) => a.localeCompare(b))
}

/**
 * Brand + model smart search for PH market.
 * Prefers Super Admin vehicle_catalog when present; else static PH_VEHICLE_CATALOG.
 * Subscribes to realtime so TL/floor pickers see BossMich catalog edits without refresh.
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

  useEffect(() => {
    let alive = true
    function apply(map) {
      if (alive) setDbMap(map)
    }
    loadCatalogMap().then(apply)

    const channel = supabase
      .channel(`vehicle-catalog-picker:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_catalog' }, () => {
        clearVehicleCatalogCache()
        loadCatalogMap().then(apply)
      })
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [])

  const makeList = useMemo(() => {
    if (dbMap) return makesFromMap(dbMap)
    return PH_VEHICLE_MAKES
  }, [dbMap])

  const makeOptions = useMemo(() => {
    const q = String(make || '').trim().toLowerCase()
    if (!q) return makeList.slice(0, 14)
    return makeList.filter((m) => m.toLowerCase().includes(q)).slice(0, 14)
  }, [make, makeList])

  const modelOptions = useMemo(() => {
    if (dbMap) {
      const key = makeList.find((m) => m.toLowerCase() === String(make || '').trim().toLowerCase())
      const models = key ? dbMap[key] || [] : []
      const q = String(model || '').trim().toLowerCase()
      if (!q) return models.slice(0, 14)
      return models.filter((m) => m.toLowerCase().includes(q)).slice(0, 14)
    }
    const known = modelsForMake(make)
    if (known.length) return filterVehicleModels(make, model, 14)
    return filterVehicleModels(make, model, 14)
  }, [make, model, dbMap, makeList])

  const inputClass =
    variant === 'floor' ? FLOOR_INPUT : variant === 'crm' ? 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none' : PUBLIC_INPUT

  const labelClass =
    variant === 'floor'
      ? 'text-xs font-bold tracking-[0.14em] text-slate-500 uppercase'
      : variant === 'crm'
        ? 'flex flex-col gap-2 text-sm font-medium'
        : ''

  return (
    <>
      <SuggestInput
        label={makeLabel}
        value={make}
        required={required}
        placeholder="Toyota, Mitsubishi…"
        options={makeOptions.length ? makeOptions : makeList.slice(0, 12)}
        className={labelClass}
        inputClassName={inputClass}
        onChange={(next) => {
          onMakeChange(next)
          const allowed = dbMap
            ? (dbMap[makeList.find((m) => m.toLowerCase() === String(next || '').trim().toLowerCase())] || [])
            : modelsForMake(next)
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
        onChange={onModelChange}
      />
    </>
  )
}

export function clearVehicleCatalogCache() {
  cachedCatalog = null
}
