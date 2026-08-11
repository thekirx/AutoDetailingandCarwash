/**
 * Customer password sign-in that uses the real Auth email (never leaked).
 * Covers 09 vs +63 synthetic emails and Team Lead invite-by-email accounts.
 */
import { createClient } from '@supabase/supabase-js'
import { resolveCustomerAuthIntent } from '../src/lib/customerAccountLifecycle.js'

function anonClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or anon key')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * @param {{ status: string, authEmail?: string | null, password: string }} args
 */
export async function signInCustomerWithPassword({ status, authEmail, password }) {
  const intent = resolveCustomerAuthIntent({
    status,
    passwordProvided: Boolean(password),
    flow: 'signin',
  })
  if (intent.action === 'activate') {
    return { ok: false, status: 409, body: { error: intent.message, status, activate: true } }
  }
  if (intent.action === 'offer_signup') {
    return { ok: false, status: 404, body: { error: intent.message, status: 'unknown', offer_signup: true } }
  }
  if (intent.action === 'need_password') {
    return { ok: false, status: 400, body: { error: intent.message, status: 'ready' } }
  }
  if (!authEmail || !password) {
    return { ok: false, status: 401, body: { error: 'Invalid phone or password.' } }
  }

  const { data, error } = await anonClient().auth.signInWithPassword({
    email: authEmail,
    password,
  })
  if (error || !data?.session) {
    return { ok: false, status: 401, body: { error: 'Invalid phone or password.' } }
  }
  if (data.user?.user_metadata?.must_set_password) {
    return {
      ok: false,
      status: 409,
      body: { error: 'Activate your account to see your history.', status: 'needs_password', activate: true },
    }
  }
  return {
    ok: true,
    status: 200,
    body: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user_id: data.user.id,
    },
  }
}
