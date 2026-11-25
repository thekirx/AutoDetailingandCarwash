import { toast } from 'sonner'
import { getAccessTokenFresh } from '@/lib/authToken'

/** /api/maintenance-schedules with the staff bearer token; throws the API error message. */
export async function maintenanceRequest(method, { query, body } = {}) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required')
  const qs = query ? `?${new URLSearchParams(query)}` : ''
  const res = await fetch(`/api/maintenance-schedules${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Maintenance request failed')
  return data
}

/** Car is at the shop → Paint Maintenance booking at Vehicle intake (callers confirm via UI dialog first). */
export async function processMaintenanceArrival(row) {
  const plate = row?.plate_number || 'this car'
  const data = await maintenanceRequest('POST', { body: { id: row.id, action: 'arrive' } })
  toast.success(`${plate} added to Vehicle intake${data.notify?.sms?.ok ? ' · SMS sent' : ''}`)
  return data
}
