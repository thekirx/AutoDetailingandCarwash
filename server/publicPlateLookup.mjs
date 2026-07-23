/**
 * Public plate soft-lookup — returns vehicle make/model/type only (no customer PII).
 */
import { createClient } from '@supabase/supabase-js'

function normalizePlate(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin env')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function handlePublicPlateLookup(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const url = new URL(req.url, 'http://localhost')
    const plate = normalizePlate(url.searchParams.get('plate') || '')
    if (plate.length < 2) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ found: false }))
      return
    }

    const db = admin()
    const { data, error } = await db
      .from('vehicles')
      .select('vehicle_make, vehicle_model, vehicle_type, vehicle_year, color')
      .eq('normalized_plate_number', plate)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ found: false }))
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        found: true,
        vehicle_make: data.vehicle_make || '',
        vehicle_model: data.vehicle_model || '',
        vehicle_type: data.vehicle_type || '',
        vehicle_year: data.vehicle_year != null ? String(data.vehicle_year) : '',
        vehicle_color: data.color || '',
      }),
    )
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: String(err.message || err) }))
  }
}
