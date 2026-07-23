import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleProvisionRequest } from './server/provisionCustomer.mjs'
import { handleProvisionStaffRequest } from './server/provisionStaff.mjs'
import { handleCustomerPortalRequest } from './server/customerPortal.mjs'
import { handlePublicBookRequest } from './server/publicBook.mjs'
import { handleBookingStatusRequest } from './server/bookingStatus.mjs'
import { handlePushSubscribeRequest, handleSendPushRequest } from './server/pushApi.mjs'

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
      const header = req.headers.authorization || ''
      return header.startsWith('Bearer ') ? header.slice(7) : null
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
      mount('/api/customer-portal', handleCustomerPortalRequest)
      mount('/api/customer-signup', async (req, res, helpers) => {
        const { handleCustomerSignupRequest } = await import('./server/customerSignup.mjs')
        return handleCustomerSignupRequest(req, res, helpers)
      })
      mount('/api/customer-auth-lookup', async (req, res, helpers) => {
        const { handleCustomerAuthLookupRequest } = await import('./server/customerAuthLookup.mjs')
        return handleCustomerAuthLookupRequest(req, res, helpers)
      })
      mount('/api/public-book', (req, res) => handlePublicBookRequest(req, res))
      mount('/api/booking-status', (req, res) => handleBookingStatusRequest(req, res))
      mount('/api/push-subscribe', (req, res) => handlePushSubscribeRequest(req, res))
      mount('/api/send-push', (req, res) => handleSendPushRequest(req, res))
      mount('/api/busybee', async (req, res) => {
        const mod = await import('./api/busybee.js')
        return mod.default(req, res)
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
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
})
