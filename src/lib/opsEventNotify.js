import { getAccessTokenFresh } from './authToken'

/** Fire-and-forget: the write already succeeded; the server picks recipients from the record. */
export async function notifyOpsEvent(event, id) {
  try {
    const token = await getAccessTokenFresh()
    if (!token || !id) return
    await fetch('/api/notify-ops-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event, id }),
    })
  } catch {
    /* ponytail: notify is best-effort */
  }
}
