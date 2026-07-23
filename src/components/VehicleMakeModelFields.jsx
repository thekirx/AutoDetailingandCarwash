import { useMemo } from 'react'
import SuggestInput from './SuggestInput'
import { filterVehicleMakes, filterVehicleModels, PH_VEHICLE_MAKES, modelsForMake } from '../lib/phVehicles'

const FLOOR_INPUT =
  'mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-blue-300/60'
const PUBLIC_INPUT = undefined // uses parent .booking-form input styles

/**
 * Brand + model smart search for PH market.
 * Changing brand clears model when the old model isn't valid for the new brand.
 */
export default function VehicleMakeModelFields({
  make,
  model,
  onMakeChange,
  onModelChange,
  required = true,
  variant = 'floor', // 'floor' | 'public' | 'crm'
  makeLabel = 'Vehicle brand',
  modelLabel = 'Vehicle model',
}) {
  const makeOptions = useMemo(() => filterVehicleMakes(make, 14), [make])
  const modelOptions = useMemo(() => {
    const known = modelsForMake(make)
    if (known.length) return filterVehicleModels(make, model, 14)
    // Unknown brand: still offer popular cross-brand models as weak hints from all catalogs
    if (!String(model || '').trim()) {
      return PH_VEHICLE_MAKES.slice(0, 0) // empty until they type a known brand
    }
    return filterVehicleModels(make, model, 14)
  }, [make, model])

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
        options={makeOptions.length ? makeOptions : PH_VEHICLE_MAKES.slice(0, 12)}
        className={labelClass}
        inputClassName={inputClass}
        onChange={(next) => {
          onMakeChange(next)
          const allowed = modelsForMake(next)
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
