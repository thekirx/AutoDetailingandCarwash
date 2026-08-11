import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleProvisionRequest } from './server/provisionCustomer.mjs'
import { handleProvisionStaffRequest, handleUpdateStaffRequest } from './server/provisionStaff.mjs'
import { handleCustomerPortalRequest } from './server/customerPortal.mjs'
import { handlePublicBookRequest } from './server/publicBook.mjs'
import { handleBookingStatusRequest } from './server/bookingStatus.mjs'
import { handlePushSubscribeRequest, handleSendPushRequest } from './server/pushApi.mjs'
import { handleBusybeeRequest } from './server/busybeeApi.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function apiHelpers(server, req) {
  const env = loadEnv(server.config.mode, root, '')
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) process.env[k] = v
  }
  const origin = req.headers.origin || `http://localhost:${server.config.server.port || 5173}`
  return {
    siteOrigin: origin,
    getBody: () => readBody(req),
    getAccessToken: () => {
      const header = req.headers.authorization || req.headers.Authorization || ''
      return typeof header === 'string' && header.toLowerCase().startsWith('bearer ')
        ? header.slice(7).trim()
        : null
    },
  }
}

function provisionApiPlugin() {
  return {
    name: 'hakum-provision-apis',
    configureServer(server) {
      const env = loadEnv(server.config.mode, root, '')
      for (const [k, v] of Object.entries(env)) {
        if (!process.env[k]) process.env[k] = v
      }

      const mount = (pathName, handler) => {
        server.middlewares.use(pathName, (req, res) => handler(req, res, apiHelpers(server, req)))
      }

      mount('/api/provision-customer', handleProvisionRequest)
      mount('/api/provision-staff', handleProvisionStaffRequest)
      mount('/api/update-staff', handleUpdateStaffRequest)
      mount('/api/customer-portal', handleCustomerPortalRequest)
      mount('/api/customer-signup', async (req, res, helpers) => {
        const { handleCustomerSignupRequest } = await import('./server/customerSignup.mjs')
        return handleCustomerSignupRequest(req, res, helpers)
      })
      mount('/api/customer-auth-lookup', async (req, res, helpers) => {
        const { handleCustomerAuthLookupRequest } = await import('./server/customerAuthLookup.mjs')
        return handleCustomerAuthLookupRequest(req, res, helpers)
      })
      mount('/api/customer-history', async (req, res) => {
        const { handleCustomerHistoryRequest } = await import('./server/customerHistoryApi.mjs')
        return handleCustomerHistoryRequest(req, res)
      })
      mount('/api/public-book', (req, res) => handlePublicBookRequest(req, res))
      mount('/api/plate-lookup', async (req, res) => {
        const { handlePublicPlateLookup } = await import('./server/publicPlateLookup.mjs')
        return handlePublicPlateLookup(req, res)
      })
      mount('/api/booking-status', (req, res) => handleBookingStatusRequest(req, res))
      mount('/api/push-subscribe', (req, res) => handlePushSubscribeRequest(req, res))
      mount('/api/send-push', (req, res) => handleSendPushRequest(req, res))
      mount('/api/notify-booking', async (req, res) => {
        const { handleNotifyBookingRequest } = await import('./server/notifyBookingApi.mjs')
        return handleNotifyBookingRequest(req, res)
      })
      mount('/api/notify-ops-form', async (req, res) => {
        const { handleNotifyOpsFormRequest } = await import('./server/notifyOpsFormApi.mjs')
        return handleNotifyOpsFormRequest(req, res)
      })
      mount('/api/lifecycle-sms', async (req, res) => {
        const { handleLifecycleSmsRequest } = await import('./server/lifecycleSmsApi.mjs')
        return handleLifecycleSmsRequest(req, res)
      })
      mount('/api/busybee', (req, res) => handleBusybeeRequest(req, res))
      mount('/api/notification-settings', async (req, res) => {
        const { handleNotificationSettingsRequest } = await import('./server/notificationSettingsApi.mjs')
        return handleNotificationSettingsRequest(req, res)
      })
      mount('/api/notification-broadcast', async (req, res) => {
        const { handleNotificationBroadcastRequest } = await import('./server/notificationBroadcastApi.mjs')
        return handleNotificationBroadcastRequest(req, res)
      })
      mount('/api/notification-broadcast-kinds', async (req, res) => {
        const { handleNotificationBroadcastKindsRequest } = await import('./server/notificationBroadcastKindsApi.mjs')
        return handleNotificationBroadcastKindsRequest(req, res)
      })
      mount('/api/notification-templates', async (req, res) => {
        const { handleNotificationTemplatesRequest } = await import('./server/notificationTemplatesApi.mjs')
        return handleNotificationTemplatesRequest(req, res)
      })
      mount('/api/birthday-greetings', async (req, res) => {
        const { handleBirthdayGreetingsRequest } = await import('./server/birthdayGreetingsApi.mjs')
        return handleBirthdayGreetingsRequest(req, res)
      })
      mount('/api/send-finance-quote', async (req, res, helpers) => {
        const { handleFinanceQuoteRequest } = await import('./server/sendFinanceQuote.mjs')
        return handleFinanceQuoteRequest(req, res, helpers)
      })
      mount('/api/data-center', async (req, res) => {
        const { handleDataCenterRequest } = await import('./server/dataCenter.mjs')
        return handleDataCenterRequest(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    provisionApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'og-image.png', 'manifest.webmanifest'],
      manifest: false,
      workbox: {
        importScripts: ['/push-sw.js'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Missing hashed assets must 404, not fall back to index.html (MIME text/html breaks modules).
        navigateFallbackDenylist: [/^\/api\//, /^\/assets\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      injectRegister: null,
      devOptions: {
        enabled: true,
        type: 'classic',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // ponytail: split heavy vendors so main chunk stays under Vite's 500kb warn when possible
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) return 'react-vendor'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('three') || id.includes('@react-three')) return 'three'
          if (id.includes('react-big-calendar') || id.includes('date-fns')) return 'calendar'
          if (id.includes('leaflet')) return 'maps'
          if (id.includes('lucide-react')) return 'icons'
        },
      },
    },
  },
})
