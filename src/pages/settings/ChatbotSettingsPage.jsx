import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Bot,
  ExternalLink,
  Eye,
  EyeOff,
  MessageCircle,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isSuperAdmin } from '@/auth/permissions'
import {
  CHATBOT_ACCENT_PRESETS,
  CHATBOT_PROMO_DESTINATIONS,
  DEFAULT_CHATBOT_SETTINGS,
  DEFAULT_SUGGESTED_PROMPTS,
  normalizeSuggestedPrompts,
} from '@/lib/chatbotSettingsRules'
import {
  fetchAdminChatbotSettings,
  normalizeChatbotSettings,
  saveAdminChatbotSettings,
} from '@/lib/chatbotSettings'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

function ToggleSwitch({ id, checked, disabled, onToggle, label }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3.5 py-2">
      <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
        {label}
      </Label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onToggle(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          aria-hidden
          className={`pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function isValidHttpUrl(raw) {
  try {
    const parsed = new URL(String(raw || '').trim())
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/** Settings -> Customer Concierge Chatbot (Super Admin / Owner only). */
export default function ChatbotSettingsPage() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState(() => ({ ...DEFAULT_CHATBOT_SETTINGS }))
  const [promptsText, setPromptsText] = useState(() => DEFAULT_SUGGESTED_PROMPTS.join('\n'))
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allowed = isSuperAdmin(profile)

  const syncFromSettings = useCallback((settings) => {
    setForm(settings)
    setPromptsText((settings.suggested_prompts || DEFAULT_SUGGESTED_PROMPTS).join('\n'))
  }, [])

  const load = useCallback(async () => {
    if (!allowed) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminChatbotSettings()
      syncFromSettings(res.settings)
      setUpdatedAt(res.updatedAt)
    } catch (err) {
      setError(err.message || 'Could not load chatbot settings.')
    } finally {
      setLoading(false)
    }
  }, [allowed, syncFromSettings])

  useEffect(() => {
    load()
  }, [load])

  const parsedPrompts = useMemo(() => normalizeSuggestedPrompts(promptsText), [promptsText])
  const accentId = Object.prototype.hasOwnProperty.call(CHATBOT_ACCENT_PRESETS, form.accent_preset)
    ? form.accent_preset
    : 'sapphire'
  const previewToneMap = {
    sapphire: { btn: 'bg-blue-600', pill: 'bg-blue-500/20 text-blue-300', link: 'text-blue-300' },
    cobalt: { btn: 'bg-[var(--color-brand-primary)]', pill: 'bg-[var(--color-brand-primary)]/30 text-blue-200', link: 'text-blue-200' },
    emerald: { btn: 'bg-emerald-600', pill: 'bg-emerald-500/20 text-emerald-300', link: 'text-emerald-300' },
    amber: { btn: 'bg-amber-700', pill: 'bg-amber-600/25 text-amber-300', link: 'text-amber-300' },
  }
  const previewTone = previewToneMap[accentId] || previewToneMap.sapphire

  if (!allowed) {
    return <Navigate to="/operations/access-denied" replace />
  }

  async function persist(nextValue, successMessage) {
    setSaving(true)
    setError('')
    try {
      const res = await saveAdminChatbotSettings(nextValue, { actorId: user?.id || null })
      syncFromSettings(res.settings)
      setUpdatedAt(res.updatedAt)
      toast.success(successMessage)
      return true
    } catch (err) {
      const msg = err.message || 'Could not save chatbot settings.'
      setError(msg)
      toast.error(msg)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleEnabled(checked) {
    const previous = form
    const next = normalizeChatbotSettings({
      ...form,
      suggested_prompts: parsedPrompts,
      enabled: Boolean(checked),
    })
    syncFromSettings(next)
    const ok = await persist(
      next,
      next.enabled
        ? 'Hakum Concierge chatbot is now ON for public & customer pages.'
        : 'Hakum Concierge chatbot is now OFF and hidden from visitors.',
    )
    if (!ok) {
      syncFromSettings(previous)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.human_handoff_enabled) {
      if (!isValidHttpUrl(form.facebook_url) || !isValidHttpUrl(form.messenger_url)) {
        const msg = 'Enter valid https:// URLs for Hakum Facebook Page and Messenger.'
        setError(msg)
        toast.error(msg)
        return
      }
    }
    await persist(
      { ...form, suggested_prompts: parsedPrompts },
      'Hakum Concierge chatbot settings saved',
    )
  }

  function handleResetAllDefaults() {
    syncFromSettings({
      ...DEFAULT_CHATBOT_SETTINGS,
      enabled: form.enabled,
    })
  }

  return (
    <OpsPageShell
      eyebrow="Settings"
      title="Hakum Concierge Chatbot"
      icon={Bot}
      breadcrumbs={[{ label: 'Settings', to: '/operations/settings' }, { label: 'Chatbot' }]}
      description="Turn the movable customer assistant ON or OFF, configure Facebook & Messenger human handoff, customize featured product spotlight cards, and manage quick prompts. Super Admin only."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="min-h-11 cursor-pointer" disabled={loading || saving} onClick={load}>
            <RefreshCw className={`mr-1.5 size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/operations/settings">← Company settings</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/home">Preview on Home</Link>
          </Button>
        </div>
      }
    >
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={load} disabled={loading || saving}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <CardTitle className="text-lg">Visibility across public site & customer app</CardTitle>
                  <Badge variant={form.enabled ? 'default' : 'secondary'}>
                    {form.enabled ? (
                      <>
                        <Eye className="mr-1 size-3.5" aria-hidden />
                        Live / ON
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-1 size-3.5" aria-hidden />
                        Hidden / OFF
                      </>
                    )}
                  </Badge>
                </div>
                <CardDescription>
                  Appears cleanly in the corner until tapped (never auto-pops over browsing). Hidden inside Operations and branch TV kiosks.
                </CardDescription>
              </div>
              <ToggleSwitch
                id="chatbot-enabled-switch"
                checked={form.enabled}
                disabled={saving}
                onToggle={handleToggleEnabled}
                label={form.enabled ? 'Chatbot active' : 'Chatbot paused'}
              />
            </CardHeader>
            {updatedAt ? (
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Last saved:{' '}
                {new Date(updatedAt).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </CardContent>
            ) : null}
          </Card>

          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="size-4 text-primary" aria-hidden />
                      Greeting, launcher & accent color
                    </CardTitle>
                    <CardDescription>
                      100% deterministic knowledge engine — instant answers with zero external AI cost.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="chatbot-launcher-label">Launcher tooltip pill</Label>
                        <Input
                          id="chatbot-launcher-label"
                          maxLength={48}
                          value={form.launcher_label}
                          onChange={(e) => setForm((prev) => ({ ...prev, launcher_label: e.target.value }))}
                          placeholder={DEFAULT_CHATBOT_SETTINGS.launcher_label}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="chatbot-welcome-title">Assistant header title</Label>
                        <Input
                          id="chatbot-welcome-title"
                          maxLength={64}
                          value={form.welcome_title}
                          onChange={(e) => setForm((prev) => ({ ...prev, welcome_title: e.target.value }))}
                          placeholder={DEFAULT_CHATBOT_SETTINGS.welcome_title}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="chatbot-welcome-message">Welcome message</Label>
                      <Textarea
                        id="chatbot-welcome-message"
                        rows={2}
                        maxLength={280}
                        value={form.welcome_message}
                        onChange={(e) => setForm((prev) => ({ ...prev, welcome_message: e.target.value }))}
                        placeholder={DEFAULT_CHATBOT_SETTINGS.welcome_message}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Widget accent preset</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.values(CHATBOT_ACCENT_PRESETS).map((preset) => {
                          const selected = form.accent_preset === preset.id
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, accent_preset: preset.id }))}
                              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
                                selected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/60'
                              }`}
                            >
                              <span
                                aria-hidden
                                className={`size-3.5 rounded-full border border-white/30 ${preset.swatchClass}`}
                              />
                              {preset.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="size-4 text-primary" aria-hidden />
                        Human Handoff (Facebook & Messenger)
                      </CardTitle>
                      <CardDescription>
                        Lets customers jump straight to Hakum’s real team when they ask for a human agent or custom quote.
                      </CardDescription>
                    </div>
                    <ToggleSwitch
                      id="chatbot-handoff-switch"
                      checked={form.human_handoff_enabled}
                      disabled={saving}
                      onToggle={(val) => setForm((prev) => ({ ...prev, human_handoff_enabled: val }))}
                      label={form.human_handoff_enabled ? 'Enabled' : 'Hidden'}
                    />
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="chatbot-human-label">Messenger button label</Label>
                        <Input
                          id="chatbot-human-label"
                          maxLength={32}
                          value={form.human_cta_label}
                          onChange={(e) => setForm((prev) => ({ ...prev, human_cta_label: e.target.value }))}
                          placeholder={DEFAULT_CHATBOT_SETTINGS.human_cta_label}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="chatbot-messenger-url">Direct Messenger URL</Label>
                        <Input
                          id="chatbot-messenger-url"
                          type="url"
                          value={form.messenger_url}
                          onChange={(e) => setForm((prev) => ({ ...prev, messenger_url: e.target.value }))}
                          placeholder={DEFAULT_CHATBOT_SETTINGS.messenger_url}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="chatbot-facebook-url">Hakum Auto Care Facebook Page URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="chatbot-facebook-url"
                          type="url"
                          value={form.facebook_url}
                          onChange={(e) => setForm((prev) => ({ ...prev, facebook_url: e.target.value }))}
                          placeholder={DEFAULT_CHATBOT_SETTINGS.facebook_url}
                        />
                        {isValidHttpUrl(form.facebook_url) ? (
                          <Button type="button" variant="outline" size="icon" asChild className="shrink-0" title="Test Facebook link">
                            <a href={form.facebook_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" aria-hidden />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" aria-hidden />
                        Studio Product Spotlight (Non-Invasive)
                      </CardTitle>
                      <CardDescription>
                        Quietly highlights a featured service or offer inside the open Main Menu without interrupting visitors.
                      </CardDescription>
                    </div>
                    <ToggleSwitch
                      id="chatbot-promo-switch"
                      checked={form.promo_enabled}
                      disabled={saving}
                      onToggle={(val) => setForm((prev) => ({ ...prev, promo_enabled: val }))}
                      label={form.promo_enabled ? 'Shown inside menu' : 'Off'}
                    />
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="chatbot-promo-eyebrow">Spotlight tag</Label>
                        <Input
                          id="chatbot-promo-eyebrow"
                          maxLength={36}
                          value={form.promo_eyebrow}
                          onChange={(e) => setForm((prev) => ({ ...prev, promo_eyebrow: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="chatbot-promo-cta">Button label</Label>
                        <Input
                          id="chatbot-promo-cta"
                          maxLength={32}
                          value={form.promo_cta_label}
                          onChange={(e) => setForm((prev) => ({ ...prev, promo_cta_label: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="chatbot-promo-title">Featured headline</Label>
                      <Input
                        id="chatbot-promo-title"
                        maxLength={72}
                        value={form.promo_title}
                        onChange={(e) => setForm((prev) => ({ ...prev, promo_title: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="chatbot-promo-desc">Short offer copy</Label>
                      <Textarea
                        id="chatbot-promo-desc"
                        rows={2}
                        maxLength={180}
                        value={form.promo_description}
                        onChange={(e) => setForm((prev) => ({ ...prev, promo_description: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="chatbot-promo-dest">CTA destination</Label>
                      <select
                        id="chatbot-promo-dest"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={form.promo_cta_path}
                        onChange={(e) => setForm((prev) => ({ ...prev, promo_cta_path: e.target.value }))}
                      >
                        {CHATBOT_PROMO_DESTINATIONS.map((dest) => (
                          <option key={dest.path} value={dest.path}>
                            {dest.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Suggested quick-chat prompts</CardTitle>
                    <CardDescription>
                      Up to 8 suggested questions shown as tappable chips above the chat input (one per line).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Textarea
                      id="chatbot-suggested-prompts"
                      rows={6}
                      value={promptsText}
                      onChange={(e) => setPromptsText(e.target.value)}
                      placeholder={DEFAULT_SUGGESTED_PROMPTS.join('\n')}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {parsedPrompts.map((chip) => (
                        <Badge key={chip} variant="outline" className="font-normal">
                          {chip}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={handleResetAllDefaults}>
                    <RotateCcw className="mr-1.5 size-4" aria-hidden />
                    Restore defaults
                  </Button>
                  <Button type="submit" className="min-h-11" disabled={saving}>
                    <Save className="mr-1.5 size-4" aria-hidden />
                    {saving ? 'Saving…' : 'Save chatbot customization'}
                  </Button>
                </div>
              </div>

              {/* Live preview column */}
              <div className="space-y-4">
                <Card className="sticky top-6 overflow-hidden border-slate-800 bg-slate-950 text-[var(--color-surface-page)]">
                  <CardHeader className="border-b border-white/10 pb-3">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Live customer widget preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-4">
                    <div className="rounded-xl border border-white/10 bg-slate-900 p-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full border border-white/15 bg-slate-950">
                          <img src="/branding/hakum-mark-ow.png" alt="Hakum emblem" className="size-4 object-contain" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold uppercase tracking-wider">{form.welcome_title || 'Hakum Concierge'}</p>
                          <p className="text-[11px] text-slate-400">Instant answers · Live catalog</p>
                        </div>
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-slate-300">{form.welcome_message}</p>

                      {form.promo_enabled ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${previewTone.pill}`}>
                            {form.promo_eyebrow}
                          </span>
                          <p className="mt-1.5 text-xs font-semibold text-white">{form.promo_title}</p>
                          <p className="mt-1 text-[11px] leading-snug text-slate-300">{form.promo_description}</p>
                          <span className={`mt-2.5 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold text-white ${previewTone.btn}`}>
                            {form.promo_cta_label} →
                          </span>
                        </div>
                      ) : null}

                      {form.human_handoff_enabled ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px]">
                          <span className="text-slate-300">Need a real person?</span>
                          <span className={`font-semibold ${previewTone.link}`}>
                            {form.human_cta_label} →
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      <span className="rounded-full border border-white/15 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
                        {form.launcher_label}
                      </span>
                      <span className="grid size-12 place-items-center rounded-full border border-white/25 bg-slate-950 shadow-lg">
                        <img src="/branding/hakum-mark-ow.png" alt="Launcher circle" className="size-6 object-contain" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      )}
    </OpsPageShell>
  )
}
