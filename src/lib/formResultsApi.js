import { supabase } from '@/lib/supabase'

async function callFormsResultsApi(body) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Sign in required to load form results.')

  const resp = await fetch('/api/staff?operation=manage-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json?.error || `Form results request failed (${resp.status})`)
  }
  return json
}

export function fetchFormResultsSnapshot() {
  return callFormsResultsApi({ action: 'list-form-results' })
}

export function updateFormSubmissionAsOwner({ id, status, payload, respondent_label, calendar_at }) {
  return callFormsResultsApi({
    action: 'update-form-submission',
    id,
    status,
    payload,
    respondent_label,
    calendar_at,
  })
}

export function deleteFormSubmissionAsOwner(id) {
  return callFormsResultsApi({ action: 'delete-form-submission', id })
}
