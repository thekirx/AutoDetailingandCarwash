/**
 * Public customer self-signup (service role creates auth + customers row).
 */
import { createClient } from '@supabase/supabase-js'
import { phoneLoginEmail } from '../src/lib/customerAuth.js'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function signupCustomer({ body }) {
  const fullName = String(body.full_name || '').trim()
  const phone = String(body.phone || '').trim()
  const emailRaw = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!fullName) throw Object.assign(new Error('Full name is required.'), { status: 400 })
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    throw Object.assign(new Error('A valid phone number is required.'), { status: 400 })
  }
  if (password.length < 8) throw Object.assign(new Error('Password must be at least 8 characters.'), { status: 400 })

  const email = emailRaw || phoneLoginEmail(phone)
  if (!email.includes('@')) throw Object.assign(new Error('Valid email is required.'), { status: 400 })

  const admin = adminClient()
  const [first, ...rest] = fullName.split(/\s+/)
  const last = rest.join(' ') || null

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'customer', full_name: fullName, phone, must_set_password: false },
  })
  if (createError) throw Object.assign(new Error(createError.message), { status: 400 })

  const { error: profileError } = await admin.from('customers').upsert(
    {
      id: created.user.id,
      role: 'customer',
      full_name: fullName,
      first_name: first || null,
      last_name: last,
      phone,
      email,
      is_archived: false,
    },
    { onConflict: 'id' },
  )
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw Object.assign(new Error(profileError.message), { status: 400 })
  }

  return { user_id: created.user.id, email, login_hint: emailRaw ? email : phone }
}

export async function handleCustomerSignupRequest(req, res, { getBody }) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }
    const body = await getBody()
    const result = await signupCustomer({ body })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = err.status || 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || String(err) }))
  }
}
