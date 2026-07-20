import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { phone, message, template_type = 'promo' } = await req.json()
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: 'phone and message required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Provider hook — set SMS_PROVIDER_API_KEY in Edge Function secrets
    const apiKey = Deno.env.get('SMS_PROVIDER_API_KEY')
    let providerStatus = 'queued'
    let providerResponse = null

    if (apiKey) {
      // ponytail: generic webhook-style provider; swap URL when vendor is finalized
      const res = await fetch(Deno.env.get('SMS_PROVIDER_URL') || 'https://api.sms-provider.local/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, text: message }),
      })
      providerStatus = res.ok ? 'sent' : 'failed'
      providerResponse = await res.text()
    }

    const { error } = await supabase.from('sms_events').insert({
      phone,
      message,
      event_type: template_type,
      status: providerStatus,
      provider_response: providerResponse,
    })

    if (error) {
      // tolerate alternate column names on older sms_events tables
      await supabase.from('sms_events').insert({
        to_phone: phone,
        body: message,
        template_type,
        status: providerStatus,
      })
    }

    return new Response(JSON.stringify({ ok: true, status: providerStatus }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
