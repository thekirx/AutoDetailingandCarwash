import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveSupabaseConfig } from '../src/lib/supabaseConfig.js'

describe('Supabase browser configuration', () => {
  it('uses the configured project when both public values are present', () => {
    assert.deepEqual(
      resolveSupabaseConfig({ url: 'https://project.supabase.co', key: 'public-key', isDev: true }),
      { url: 'https://project.supabase.co', key: 'public-key', isPreview: false },
    )
  })

  it('allows the public site to render in local preview without credentials', () => {
    const config = resolveSupabaseConfig({ url: '', key: '', isDev: true })

    assert.equal(config.isPreview, true)
    assert.match(config.url, /^https:\/\//)
    assert.ok(config.key)
  })

  it('still rejects missing configuration outside local development', () => {
    assert.throws(
      () => resolveSupabaseConfig({ url: '', key: '', isDev: false }),
      /Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY/,
    )
  })
})
