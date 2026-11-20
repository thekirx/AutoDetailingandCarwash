import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BatteryCharging,
  Bell,
  CheckCheck,
  ChevronLeft,
  MessageSquare,
  Signal,
  Sparkles,
  Wifi,
} from 'lucide-react'
import {
  analyzeBusybeeSms,
  renderNotificationMessage,
} from '@/lib/notificationCopy'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const DEFAULT_PREVIEW_VARS = Object.freeze({
  name: 'Ana',
  plate: 'ABC-1234',
  service: 'Ceramic Coating',
  branch: 'Bacoor',
  when: ', Nov 20, 10:00 AM',
  code: 'BD8K2P',
  appUrl: 'hakumautocare.com',
})

/**
 * High-end Apple / Android mobile phone simulator preview for notification copy.
 * Renders both iOS Lock Screen Push Notification and iMessage/SMS chat bubble
 * with real-time GSM-7 / UCS-2 character metrics and BusyBee credit calculation.
 */
export default function NotificationSimulatorPreview({
  channel = 'both',
  title = '',
  body = '',
  sms_body = '',
  allow_multipart = false,
  sampleVars = DEFAULT_PREVIEW_VARS,
  triggerRoute = '/account',
  className = '',
}) {
  const [activeTab, setActiveTab] = useState(channel === 'sms' ? 'sms' : 'push')

  const effectiveTab = channel === 'sms' ? 'sms' : channel === 'push' ? 'push' : activeTab

  const renderedTitle = useMemo(
    () => renderNotificationMessage(title || 'Notification', sampleVars),
    [title, sampleVars],
  )

  const renderedPushBody = useMemo(
    () => renderNotificationMessage(body || 'Notification message body…', sampleVars),
    [body, sampleVars],
  )

  const rawSms = sms_body || body || ''
  const renderedSmsBody = useMemo(
    () => renderNotificationMessage(rawSms || 'SMS text message body…', sampleVars),
    [rawSms, sampleVars],
  )

  const smsAnalysis = useMemo(
    () => analyzeBusybeeSms(rawSms, { allowMultiPart: Boolean(allow_multipart) }),
    [rawSms, allow_multipart],
  )

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Simulator mode switcher */}
      {channel === 'both' ? (
        <div
          role="tablist"
          aria-label="Simulator preview channel"
          className="flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1 text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'push'}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition cursor-pointer',
              effectiveTab === 'push'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab('push')}
          >
            <Bell className="size-3.5 text-primary" aria-hidden />
            iOS Lock Screen
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'sms'}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition cursor-pointer',
              effectiveTab === 'sms'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab('sms')}
          >
            <MessageSquare className="size-3.5 text-emerald-500" aria-hidden />
            SMS Bubble
          </button>
        </div>
      ) : null}

      {/* Phone chassis */}
      <div className="relative mx-auto w-full max-w-[320px] rounded-[2.5rem] border-[4px] border-zinc-700/90 bg-zinc-950 p-2.5 shadow-2xl ring-1 ring-black/40">
        {/* Dynamic Island / speaker notch */}
        <div className="absolute top-3.5 left-1/2 z-20 flex h-4 w-24 -translate-x-1/2 items-center justify-between rounded-full bg-black px-2">
          <div className="size-2 rounded-full bg-zinc-900 ring-1 ring-zinc-800" />
          <div className="size-2.5 rounded-full bg-zinc-900/90 ring-1 ring-zinc-800" />
        </div>

        {/* Screen canvas */}
        <div className="relative flex min-h-[460px] flex-col overflow-hidden rounded-[2rem] bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-white antialiased">
          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-3 pb-2 text-[11px] font-semibold tracking-tight text-zinc-300">
            <span>9:41</span>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Signal className="size-3" aria-hidden />
              <Wifi className="size-3" aria-hidden />
              <div className="flex items-center gap-0.5">
                <span className="text-[10px]">100%</span>
                <BatteryCharging className="size-3.5 text-emerald-400" aria-hidden />
              </div>
            </div>
          </div>

          {effectiveTab === 'push' ? (
            /* =================== LOCK SCREEN PUSH NOTIFICATION =================== */
            <div className="flex flex-1 flex-col justify-between p-4 pt-6">
              {/* Lock screen clock */}
              <div className="space-y-0.5 text-center">
                <p className="text-[12px] font-medium tracking-wide text-zinc-400">Tuesday, November 20</p>
                <h2 className="text-5xl font-extralight tracking-tight text-white/95">09:41</h2>
              </div>

              {/* Notification card banner */}
              <div className="my-auto rounded-2xl border border-white/15 bg-zinc-900/90 p-3.5 shadow-xl backdrop-blur-xl">
                {/* App header */}
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-lg bg-red-600 shadow-xs">
                      <span className="text-[11px] font-black tracking-tight text-white">H</span>
                    </div>
                    <span className="text-[11px] font-semibold tracking-wider text-zinc-200 uppercase">
                      Hakum Auto Care
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">now</span>
                </div>

                {/* Content */}
                <div className="mt-2.5 space-y-1">
                  <p className="text-[13px] font-bold leading-snug text-white">
                    {renderedTitle}
                  </p>
                  <p className="text-[12px] leading-relaxed text-zinc-300 break-words">
                    {renderedPushBody}
                  </p>
                </div>

                {/* Footer cue */}
                <div className="mt-2.5 flex items-center justify-between pt-1.5 text-[10px] text-zinc-400">
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Sparkles className="size-3" aria-hidden />
                    Tap to view
                  </span>
                  <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[9px] text-zinc-400">
                    {triggerRoute}
                  </code>
                </div>
              </div>

              {/* Bottom unlock swipe indicator */}
              <div className="flex flex-col items-center gap-1.5 pb-2 text-center">
                <div className="h-1 w-24 rounded-full bg-zinc-600/80" />
                <span className="text-[10px] text-zinc-500">Swipe up to open</span>
              </div>
            </div>
          ) : (
            /* =================== SMS MESSAGE CHAT THREAD =================== */
            <div className="flex flex-1 flex-col justify-between bg-zinc-950 p-3 text-zinc-100">
              {/* iMessage navigation bar */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center gap-1 text-primary">
                  <ChevronLeft className="size-4" aria-hidden />
                  <span className="text-[11px] font-medium">Messages</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex size-7 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-white shadow-xs">
                    H
                  </div>
                  <span className="mt-0.5 text-[10px] font-semibold text-zinc-200">Hakum Auto Care</span>
                </div>
                <span className="text-[11px] font-medium text-primary">Info</span>
              </div>

              {/* Chat thread */}
              <div className="my-auto space-y-2 py-4">
                <p className="text-center text-[10px] font-medium text-zinc-500">
                  Text Message · Today 9:41 AM
                </p>

                {/* Speech bubble */}
                <div className="flex flex-col items-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-xs bg-red-600 px-3.5 py-2.5 text-[12px] leading-relaxed text-white shadow-md break-words">
                    {renderedSmsBody}
                  </div>
                  <span className="mt-1 flex items-center gap-1 text-[9px] text-zinc-500">
                    Delivered
                    <CheckCheck className="size-3 text-zinc-400" aria-hidden />
                  </span>
                </div>
              </div>

              {/* SMS Metrics Card inside phone */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-2.5 text-[11px]">
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="font-semibold">BusyBee SMS metrics</span>
                  <Badge
                    variant={smsAnalysis.encoding === 'GSM-7' ? 'outline' : 'secondary'}
                    className="text-[10px] font-bold"
                  >
                    {smsAnalysis.encoding}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400 tabular-nums">
                  <span>
                    Chars: <strong className={smsAnalysis.ok ? 'text-zinc-200' : 'text-red-400'}>{smsAnalysis.length}</strong> / {smsAnalysis.maxChars}
                  </span>
                  <span>
                    Credits: <strong className="text-zinc-200">{smsAnalysis.credits}</strong> credit{smsAnalysis.credits === 1 ? '' : 's'}
                  </span>
                </div>
                {smsAnalysis.warning ? (
                  <p className="mt-1 flex items-start gap-1 text-[10px] text-amber-400">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {smsAnalysis.warning}
                  </p>
                ) : null}
              </div>

              {/* Home indicator bar */}
              <div className="flex justify-center pt-2">
                <div className="h-1 w-24 rounded-full bg-zinc-700/70" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
