# Hakum Auto Care — Services & Booking

Customer-facing React/Vite module for services, protection pricing, and booking requests.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Run `supabase/schema.sql` in the Supabase SQL editor to create the booking table and public insert policy.

## Vercel

Import the repository, keep the Vite defaults, and add the same two environment variables in Vercel project settings. `vercel.json` provides SPA routing fallback.

## Booking payload

The public form inserts `customer_name`, `vehicle_model`, `preferred_at`, `branch`, and `service_requested` into `public.bookings`. Public users can insert requests but cannot read booking records.
