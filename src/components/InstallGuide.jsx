import { useCallback, useEffect, useState } from 'react'
import { Download, Share, Smartphone } from 'lucide-react'
import {
  dismissInstallGuide,
  getInstallPlatform,
  getInstallSteps,
  wasInstallDismissed,
} from '@/lib/installApp'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Capture Chrome/Edge/Android install prompt once (module scope). */
let deferredInstallPrompt = null
let promptListenersBound = false

function bindInstallPromptCapture() {
  if (typeof window === 'undefined' || promptListenersBound) return
  promptListenersBound = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
    window.dispatchEvent(new Event('hakum-install-available'))
  })
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    window.dispatchEvent(new Event('hakum-app-installed'))
  })
}

async function runNativeInstall() {
  if (!deferredInstallPrompt) return false
  const ev = deferredInstallPrompt
  deferredInstallPrompt = null
  await ev.prompt()
  const choice = await ev.userChoice
  return choice?.outcome === 'accepted'
}

function StepList({ steps }) {
  if (!steps?.length) return null
  return (
    <ol className="install-steps">
      {steps.map((text, i) => (
        <li key={text}>
          <span className="install-step-num" aria-hidden>
            {i + 1}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  )
}

function GuideBody({ audience, copy, canNativeInstall, onInstall, busy }) {
  const forOps = audience === 'ops'
  return (
    <>
      <p className="install-lead">{copy.lead}</p>
      <StepList steps={copy.steps} />
      {copy.tip ? <p className="install-tip">{copy.tip}</p> : null}
      {canNativeInstall ? (
        <Button type="button" className="mt-3 min-h-11 w-full" disabled={busy} onClick={onInstall}>
          <Download data-icon="inline-start" />
          {forOps ? 'Install floor app' : 'Install Hakum'}
        </Button>
      ) : null}
    </>
  )
}

/**
 * @param {'popup'|'panel'|'compact'} [variant]
 * @param {'customer'|'ops'} [audience]
 * @param {boolean} [autoPopup] — customer popup; respects dismiss + delay
 */
export default function InstallGuide({
  variant = 'panel',
  audience = 'customer',
  autoPopup = false,
  surface = 'auto',
  className = '',
  onDismiss,
}) {
  const [platform, setPlatform] = useState(() => getInstallPlatform())
  const [open, setOpen] = useState(false)
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)

  const refresh = useCallback(() => {
    setPlatform(getInstallPlatform())
    setCanNativeInstall(Boolean(deferredInstallPrompt))
  }, [])

  useEffect(() => {
    bindInstallPromptCapture()
    refresh()
    const onAvail = () => refresh()
    window.addEventListener('hakum-install-available', onAvail)
    window.addEventListener('hakum-app-installed', onAvail)
    return () => {
      window.removeEventListener('hakum-install-available', onAvail)
      window.removeEventListener('hakum-app-installed', onAvail)
    }
  }, [refresh])

  useEffect(() => {
    if (!autoPopup || variant !== 'popup') return
    if (platform === 'installed' || wasInstallDismissed()) return
    // ponytail: one prompt at a time — wait for push autoPrompt (1.6s) before install popup
    try {
      if (localStorage.getItem('hakum-push-prompt-v1') !== '1') {
        /* push may still show first; delay install */
      }
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => {
      try {
        if (localStorage.getItem('hakum-prompt-busy') === '1') return
      } catch {
        /* ignore */
      }
      setOpen(true)
    }, 5200)
    return () => window.clearTimeout(t)
  }, [autoPopup, variant, platform])

  const copy = getInstallSteps(platform)

  function closePopup(persist) {
    setOpen(false)
    if (persist) {
      dismissInstallGuide()
      onDismiss?.()
    }
  }

  async function handleInstall() {
    setBusy(true)
    try {
      const ok = await runNativeInstall()
      if (ok) {
        dismissInstallGuide()
        setOpen(false)
        setHidden(true)
      }
      refresh()
    } finally {
      setBusy(false)
    }
  }

  if (platform === 'installed' && variant !== 'popup') {
    return null
  }

  if (hidden) return null

  // Customer account panel: respect 14-day dismiss.
  if (variant === 'panel' && audience === 'customer' && wasInstallDismissed()) {
    return null
  }

  if (variant === 'popup') {
    return (
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closePopup(false))}>
        <DialogContent className="install-dialog max-w-md gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
          <div className="install-dialog-head">
            <span className="install-dialog-badge" aria-hidden>
              <Smartphone className="size-5" />
            </span>
            <DialogHeader className="gap-1 text-left">
              <DialogTitle className="text-xl text-white">{copy.title}</DialogTitle>
              <DialogDescription className="text-white/75">
                {audience === 'ops'
                  ? 'Install for faster floor access and push alerts on tablet or phone.'
                  : 'Install for live queue, loyalty, and visit alerts on your phone.'}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="install-dialog-body">
            <GuideBody
              audience={audience}
              copy={copy}
              canNativeInstall={canNativeInstall}
              onInstall={handleInstall}
              busy={busy}
            />
          </div>
          <DialogFooter className="install-dialog-footer flex-col gap-2 sm:flex-col">
            {platform === 'ios' ? (
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Share className="size-3.5" aria-hidden /> Look for Share → Add to Home Screen
              </p>
            ) : null}
            <div className="flex w-full gap-2">
              <Button type="button" variant="ghost" className="min-h-11 flex-1" onClick={() => closePopup(true)}>
                Not now
              </Button>
              <Button type="button" className="min-h-11 flex-1" onClick={() => closePopup(true)}>
                Got it
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  if (variant === 'compact') {
    const light = surface === 'light' || (surface === 'auto' && audience === 'customer')
    return (
      <div className={`install-compact ${light ? 'install-compact-light' : ''} ${className}`}>
        <p className="install-compact-title">{copy.title}</p>
        <GuideBody
          audience={audience}
          copy={copy}
          canNativeInstall={canNativeInstall}
          onInstall={handleInstall}
          busy={busy}
        />
        <button type="button" className="install-dismiss" onClick={() => { dismissInstallGuide(); setHidden(true); onDismiss?.() }}>
          Dismiss
        </button>
      </div>
    )
  }

  // panel
  const panelOps = audience === 'ops' && surface !== 'light'
  const customerPanel = audience === 'customer' && !panelOps
  return (
    <aside
      className={`install-panel ${panelOps ? 'install-panel-ops' : ''} ${customerPanel ? 'install-panel-app' : ''} ${className}`}
      aria-label="Install app"
    >
      <div className="install-panel-top">
        <span className="install-panel-icon" aria-hidden>
          <Smartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="install-panel-eyebrow">{audience === 'ops' ? 'Floor app' : 'Get the app'}</p>
          <h2 className="install-panel-title">
            {customerPanel
              ? platform === 'ios'
                ? 'Add Hakum to your Home Screen'
                : platform === 'android'
                  ? 'Install Hakum on your phone'
                  : 'Install Hakum on this device'
              : copy.title}
          </h2>
          {customerPanel ? (
            <p className="install-panel-blurb">
              One tap for live queue, stamps, and visit alerts — best from the installed app.
            </p>
          ) : null}
        </div>
        {customerPanel ? (
          <button
            type="button"
            className="install-panel-dismiss"
            aria-label="Dismiss install guide"
            onClick={() => {
              dismissInstallGuide()
              setHidden(true)
              onDismiss?.()
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {customerPanel ? (
        <>
          <StepList steps={copy.steps.slice(0, 3)} />
          {copy.tip ? <p className="install-tip">{copy.tip}</p> : null}
          <div className="install-panel-actions">
            {canNativeInstall ? (
              <Button type="button" className="min-h-11 flex-1" disabled={busy} onClick={handleInstall}>
                <Download data-icon="inline-start" />
                Install Hakum
              </Button>
            ) : (
              <Button type="button" className="min-h-11 flex-1" onClick={() => setOpen(true)}>
                Show install steps
              </Button>
            )}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="install-dialog max-w-md gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
              <div className="install-dialog-head">
                <span className="install-dialog-badge" aria-hidden>
                  <Smartphone className="size-5" />
                </span>
                <DialogHeader className="gap-1 text-left">
                  <DialogTitle className="text-xl text-white">{copy.title}</DialogTitle>
                  <DialogDescription className="text-white/75">
                    Install for live queue, loyalty stamps, and visit alerts on your phone.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="install-dialog-body">
                <GuideBody
                  audience={audience}
                  copy={copy}
                  canNativeInstall={canNativeInstall}
                  onInstall={handleInstall}
                  busy={busy}
                />
              </div>
              <DialogFooter className="install-dialog-footer flex-col gap-2 sm:flex-col">
                {platform === 'ios' ? (
                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                    <Share className="size-3.5" aria-hidden /> Safari → Share → Add to Home Screen
                  </p>
                ) : null}
                <Button type="button" className="min-h-11 w-full" onClick={() => setOpen(false)}>
                  Got it
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <GuideBody
          audience={audience}
          copy={copy}
          canNativeInstall={canNativeInstall}
          onInstall={handleInstall}
          busy={busy}
        />
      )}
    </aside>
  )
}

/** Customer-only auto popup wrapper for layouts. */
export function CustomerInstallPopup({ enabled }) {
  if (!enabled) return null
  return <InstallGuide variant="popup" audience="customer" autoPopup />
}
