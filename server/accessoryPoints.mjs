import { createClient } from '@supabase/supabase-js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function canAssignAccessoryPoints(staff) {
  if (!staff?.is_active || staff.is_archived) return false
  if (staff.role === 'BossMich' || staff.role === 'admin') return true
  if (staff.role !== 'assistant_super_admin') return false
  const grants = staff.permission_grants || {}
  return Boolean(grants.services_merch || grants.pos)
}

/** BA and ASA set how many points an accessory costs in the customer shop. */
export async function handleAccessoryPointsRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Sign in required.' })
    const db = adminClient()
    const { data: userData, error: userError } = await db.auth.getUser(token)
    if (userError || !userData?.user) return json(res, 401, { error: 'Sign in required.' })
    const { data: staff } = await db
      .from('staff_profiles')
      .select('role, permission_grants, is_active, is_archived')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!canAssignAccessoryPoints(staff)) return json(res, 403, { error: 'Only a branch admin or assistant admin can set accessory points.' })

    const body = await readJsonBody(req)
    const productId = String(body.product_id || '').trim()
    const points = Math.floor(Number(body.points_price))
    if (!productId || !Number.isFinite(points) || points < 0 || points > 100000) {
      return json(res, 400, { error: 'Enter a point price from 0 to 100000.' })
    }
    const { data: product, error: readError } = await db
      .from('products')
      .select('id, category, name, usage_kind')
      .eq('id', productId)
      .maybeSingle()
    if (readError) return json(res, 400, { error: readError.message })
    if (!product || String(product.usage_kind || '').toLowerCase() === 'internal') {
      return json(res, 400, { error: 'Point prices are for accessories and sellables.' })
    }
    const { data, error } = await db
      .from('products')
      .update({ points_price: points, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select('id, name, points_price')
      .maybeSingle()
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { ok: true, product: data })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
