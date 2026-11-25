import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  CHATBOT_SETTINGS_EVENT,
  DEFAULT_CHATBOT_SETTINGS,
  fetchPublicChatbotSettings,
  isChatbotPathVisible,
  normalizeChatbotSettings,
} from '../lib/chatbotSettings.js'

const HakumChatbot = lazy(() => import('./HakumChatbot.jsx'))

/**
 * Global route-aware gate for Hakum Concierge.
 * Lazy-loads only on public & customer-app routes when Owner enabled the toggle.
 */
export default function HakumChatbotHost() {
  const { pathname } = useLocation()
  const [settings, setSettings] = useState(null)

  const refresh = useCallback(() => {
    fetchPublicChatbotSettings()
      .then(setSettings)
      .catch(() => setSettings({ ...DEFAULT_CHATBOT_SETTINGS }))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onUpdated = (e) => {
      if (e?.detail) setSettings(normalizeChatbotSettings(e.detail))
      else refresh()
    }
    const onFocus = () => refresh()
    window.addEventListener(CHATBOT_SETTINGS_EVENT, onUpdated)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener(CHATBOT_SETTINGS_EVENT, onUpdated)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  if (!isChatbotPathVisible(pathname)) return null
  if (!settings || settings.enabled === false) return null

  return (
    <Suspense fallback={null}>
      <HakumChatbot settings={settings} />
    </Suspense>
  )
}
