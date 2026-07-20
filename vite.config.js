import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleProvisionRequest } from './server/provisionCustomer.mjs'
import { handleProvisionStaffRequest } from './server/provisionStaff.mjs'
import { handleCustomerPortalRequest } from './server/customerPortal.mjs'

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
      server.middlewares.use('/api/provision-customer', (req, res) => {
        handleProvisionRequest(req, res, apiHelpers(server, req))
      })
      server.middlewares.use('/api/provision-staff', (req, res) => {
        handleProvisionStaffRequest(req, res, apiHelpers(server, req))
      })
      server.middlewares.use('/api/customer-portal', (req, res) => {
        handleCustomerPortalRequest(req, res, apiHelpers(server, req))
      })
      server.middlewares.use('/api/customer-signup', async (req, res) => {
        const { handleCustomerSignupRequest } = await import('./server/customerSignup.mjs')
        handleCustomerSignupRequest(req, res, apiHelpers(server, req))
      })
      server.middlewares.use('/api/customer-auth-lookup', async (req, res) => {
        const { handleCustomerAuthLookupRequest } = await import('./server/customerAuthLookup.mjs')
        handleCustomerAuthLookupRequest(req, res, apiHelpers(server, req))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), provisionApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
})
