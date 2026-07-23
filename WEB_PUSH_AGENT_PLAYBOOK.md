# Web Push Agent Playbook

**Audience:** AI coding agents and humans porting web push to **any** project.  
**Goal:** Implement end-to-end browser Web Push (subscribe → store → send → display → click) without prior product context.

This playbook is **stack-agnostic**. Examples mention Vite/React/Supabase because that pattern is common; replace names, not the loop.

Kado Kohi–specific event matrices and QA live in [`PWA_WEB_PUSH.md`](./PWA_WEB_PUSH.md). Prefer **this file** when starting a new app or when the agent has no repo memory.

---

## 0. Agent contract (read first)

When the user asks to “add push notifications”, do this in order:

1. **Confirm constraints** (1–2 questions max if unknown): HTTPS host? PWA already? Auth model (signed-in only vs guest)? Who gets alerts (customer / staff / both)?
2. **Implement the loop** in §2–§8 — do not invent FCM-only mobile SDKs unless they asked for native apps.
3. **Wire product events** only after durable writes succeed (§9).
4. **Verify** with the checklist in §12 before claiming done.
5. **Never** commit VAPID private keys or service-role secrets.

**Definition of done**

- User can enable/disable notifications behind a gesture.
- Subscriptions persist and prune when endpoints die.
- At least one real business event sends a push that opens the correct deep link.
- Lint/build (or project equivalent) passes; send auth cannot be abused by anonymous clients to spam arbitrary users.

---

## 1. Mental model

Web Push is **three cooperating pieces**:

| Layer | Responsibility |
|-------|----------------|
| Browser + Service Worker | Permission, `PushSubscription`, show notification, handle click |
| Backend | Store subscriptions; sign payloads with **VAPID**; call push services |
| Product logic | Decide *when* and *who* (user id, role, tenant, branch, etc.) |

```
[Enable]
  gesture → Notification.requestPermission()
        → pushManager.subscribe(applicationServerKey = VAPID public)
        → POST { endpoint, p256dh, auth, userId, … } → DB

[Business event]
  after durable write succeeds
        → resolve matching subscriptions
        → web-push (VAPID) → FCM / Mozilla / Apple
        → SW `push` → showNotification({ title, body, data.url, tag })
        → `notificationclick` → focus/open data.url
```

**Hard constraints**

| Rule | Why |
|------|-----|
| HTTPS (or `localhost`) | Browsers require secure context |
| User gesture for permission | Silent auto-prompt is blocked / poor UX |
| VAPID private key server-only | Anyone with it can send as your app |
| iOS: Add to Home Screen | Safari push is unreliable in a normal tab |
| Best-effort delivery | Never fail checkout/order because push failed |

**Not the same as**

- In-app toast / inbox only (useful companion, not a substitute for Web Push).
- Native FCM/APNs SDKs (mobile apps) — different stack; this playbook is **browser PWA**.
- Email/SMS — parallel channels; do not conflate.

---

## 2. Architecture blueprint (minimum viable)

```
┌──────────────┐     subscribe      ┌─────────────────┐
│  Web app UI  │ ─────────────────► │  API / Edge Fn  │
│  + SW        │ ◄──── push JSON ── │  + web-push     │
└──────────────┘                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ subscriptions   │
                                    │ (+ optional     │
                                    │  inbox table)   │
                                    └─────────────────┘
```

**Recommended modules (names are suggestions)**

| Module | Job |
|--------|-----|
| `lib/push.ts` (client) | Feature detect, subscribe, unsubscribe, status |
| `hooks/usePushToggle.ts` | UI state: unsupported / denied / idle / subscribed |
| `repos/push.ts` | Upsert/delete subscription; invoke send API |
| `lib/notify.ts` | Pure builders: event → `{ targets, title, body, url, tag }` |
| `public/push-sw.js` | `push` + `notificationclick` (no secrets) |
| `functions/send-push` | Auth → resolve → inbox → web-push → prune |

Keep **copy + targeting** in one module so agents do not sprinkle strings across stores.

---

## 3. VAPID keys

```bash
npx web-push generate-vapid-keys
```

| Key | Where | Public? |
|-----|--------|---------|
| Public | Frontend env e.g. `VITE_VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes |
| Private | Server secrets only `VAPID_PRIVATE_KEY` | **No** |
| Subject | `mailto:you@domain` or `https://your-domain` → `VAPID_SUBJECT` | Yes |

**Invariant:** client public key and server public key are the **same pair**. Mismatch → subscribe works, send fails silently or with 403 from push services.

Document all three in `.env.example` with empty values.

---

## 4. Database schema (portable)

Minimal table (adapt names):

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  user_id uuid not null references profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  -- optional targeting columns for your product:
  role text,
  tenant_id text,
  branch_id text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on push_subscriptions (user_id);
create index on push_subscriptions (branch_id);
create index on push_subscriptions (role);
```

**Why `endpoint` unique:** re-subscribe upserts; avoid duplicates.  
**Prune:** when send returns HTTP **404** or **410**, delete that endpoint.

**RLS / authZ (if Postgres + RLS):** users may upsert/delete **only their own** rows. Admin send paths use a **service role** that bypasses RLS.

**Optional inbox table** (in-app list even if push fails):

```sql
create table user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,          -- order | payment | system | …
  title text not null,
  body text not null,
  url text,
  tag text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

Write inbox rows in the **send** function for every `userId` target.

---

## 5. Service worker

Keep handlers in a **static, dependency-free** file (e.g. `public/push-sw.js`).

**Vite + vite-plugin-pwa**

```ts
VitePWA({
  workbox: {
    importScripts: ['/push-sw.js'],
  },
})
```

**Required events**

1. **`push`** — `event.data.json()` → `{ title, body, url, tag, icon? }` → `registration.showNotification(title, options)`.
2. **`notificationclick`** — `event.notification.close()`; focus a client or `clients.openWindow(url)`.

**Payload options that matter**

| Field | Purpose |
|-------|---------|
| `tag` | Collapse updates for the same entity (`order-123`) |
| `renotify: true` | Re-alert when same tag updates |
| `data.url` | Deep link on click (must be path your router allows) |
| `requireInteraction` | Optional for urgent ops alerts |

**Never** put VAPID private keys in the SW.

---

## 6. Client subscribe / unsubscribe

### Feature detection

```ts
'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
```

### Status machine (UI)

| Status | Meaning |
|--------|---------|
| `unsupported` | Browser cannot do Web Push |
| `denied` | Permission blocked in site settings |
| `idle` | Supported, not subscribed |
| `subscribed` | Has PushSubscription |
| `loading` | Checking SW / permission |

### Subscribe steps (idempotent)

1. Require signed-in user if rows are keyed by `user_id` (recommended).
2. On button tap: `Notification.requestPermission()`.
3. Await `navigator.serviceWorker.ready`.
4. `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`  
   - Convert VAPID public key from URL-safe base64 → `Uint8Array`.
5. Persist `subscription.toJSON()` → `{ endpoint, keys.p256dh, keys.auth }` + user metadata (`role`, `tenant_id`, …).
6. On disable: delete DB row by `endpoint`, then `subscription.unsubscribe()`.

### UX surfaces

- Settings / profile toggle.
- Post-install / “Add to Home Screen” help page.
- Contextual prompt after an action that benefits from alerts (e.g. after placing an order) — still require a gesture to enable.

---

## 7. Send API contract

### Request body (stable contract for agents)

```json
{
  "targets": [
    { "userId": "uuid" },
    { "branchId": "branch_a", "roles": ["staff"] },
    { "roles": ["admin"] }
  ],
  "title": "Ready for pickup",
  "body": "Order ABC-123 is ready.",
  "url": "/account/orders",
  "tag": "order-abc-123",
  "kind": "order"
}
```

**Target resolution (OR across targets, AND within a target)**

| Target | SQL idea |
|--------|----------|
| `{ userId }` | `user_id = $1` |
| `{ branchId, roles }` | `branch_id = $1 AND role = ANY($2)` |
| `{ roles }` | `role = ANY($1)` (e.g. global admins) |

Dedupe by **endpoint** before send.

### Auth matrix (copy this; do not weaken)

| Caller | Allowed |
|--------|---------|
| Authenticated user session | Product-defined; usually “send on behalf of system events” from trusted client paths, or prefer server-only |
| **Anon / public key** | **Only** staff/ops fan-out: targets must **not** include `userId` |
| **Service role / server secret** | Any targets (webhooks, payment reconcile, cron) |

If your platform gateway validates JWT before your code (`verify_jwt: true`), guest anon calls die with 401. For guest→staff alerts, disable gateway JWT and enforce the matrix **inside** the function.

### Server steps

1. Authenticate caller (matrix above).
2. Validate `title`, `body`, `targets[]`.
3. Optional: insert inbox rows for each distinct `userId`.
4. Load subscriptions; dedupe endpoints.
5. `webpush.setVapidDetails(subject, publicKey, privateKey)`.
6. Parallel `sendNotification`; collect 404/410 → delete rows.
7. Return `{ sent, pruned }` — treat client invoke as fire-and-forget.

**Library:** `web-push` (Node) or `npm:web-push` on Deno/Supabase Edge.

---

## 8. Product wiring rules

1. **Notify after durable success** — place order / patch status / webhook marks paid, then notify.
2. **One builder module** — `buildXPayload()` returns null when skip (no user id, wrong payment method, etc.).
3. **Deep links must be RoleGate-safe** — do not send staff to `/admin/...` if staff cannot open it.
4. **Server owns payment webhooks** — client poll/hydrate often **does not** call your notify helpers; paid events must notify from webhook/verify.
5. **Guests without accounts** — no customer push; staff fan-out only (anon-safe targets).
6. **Copy families** — if one product has multiple SKU types (e.g. merchandise vs food), branch copy by type; avoid one industry metaphor for all.
7. **Tags** — stable per entity: `order-{id}`, `booking-{id}-{status}`; avoid `Date.now()` in tags unless you want every send to stack.

### Example event table (fill for your product)

| Event | Targets | URL | Tag prefix |
|-------|---------|-----|------------|
| Resource created | ops roles ± tenant | `/ops/...` | `new-` |
| Status changed | owner `userId` | `/account/...` | `status-` |
| Payment due | owner | `/checkout/...` | `pay-` |
| Payment received | owner (server) | `/account/...` | `status-` |
| Proof / attachment | ops | `/ops/...` | `proof-` |

---

## 9. Implementation order (for agents)

Execute top to bottom; do not skip:

1. Generate VAPID; wire env (client public + server private).
2. Migration: subscriptions (+ optional inbox) + RLS + indexes.
3. `push-sw.js` + PWA `importScripts` (or framework SW equivalent).
4. Client subscribe/unsubscribe + toggle UI.
5. Send edge/API with auth matrix + prune.
6. `notify` builders + call sites after writes.
7. Webhook/cron paths that change state without the SPA.
8. Unit tests on builders (pure payloads).
9. Live probe: staff fan-out 200; anon+userId 403; service role user target 200.
10. Device smoke: enable → trigger event → click deep link.

---

## 10. Framework notes (short)

| Stack | Notes |
|-------|--------|
| Vite + React + vite-plugin-pwa | `importScripts: ['/push-sw.js']`; env `VITE_*` |
| Next.js | SW via `next-pwa` / Serwist; public key `NEXT_PUBLIC_*`; send from Route Handler or Edge |
| Supabase Edge | `npm:web-push`; often `verify_jwt: false` + custom auth; service role for webhooks |
| Plain Node | Express/Fastify route; same contract |

Always prefer **one** send endpoint shared by client and server.

---

## 11. Testing strategy

### Unit (required for agents)

Test **pure payload builders** at the notify seam:

- Skips when no `userId`.
- Correct targets / url / tag / kind.
- Auth-sensitive copy variants (if any).

Do **not** mock the entire browser PushManager in unit tests unless the project already does; prefer integration/manual for subscribe.

### Live probes (server)

```text
POST /send-push  Authorization: anon
  targets: [{ roles: ["admin"] }]     → expect 200 (sent ≥ 0)

POST /send-push  Authorization: anon
  targets: [{ userId: "…" }]          → expect 403

POST /send-push  Authorization: service
  targets: [{ userId: "…" }]          → expect 200
```

### Device smoke

- Desktop Chrome: enable → background tab → receive → click.
- Android Chrome **installed** PWA: same.
- iOS: only after Home Screen install; document if unsupported.

### Regression gate

Before claiming “push works”:

```bash
# adapt to project
npm test -- notify   # or vitest/jest path
npm run lint && npm run build
```

---

## 12. Porting checklist (print / tick)

### Infra

- [ ] VAPID keypair generated; public in frontend env; private in server secrets only
- [ ] `.env.example` documents keys (empty)
- [ ] Subscriptions table + unique endpoint + indexes
- [ ] RLS or equivalent: users write only own rows
- [ ] Optional inbox table + read UI

### Client

- [ ] SW push + notificationclick handlers shipped
- [ ] PWA registers SW; `importScripts` includes push handlers
- [ ] Toggle UI: unsupported / denied / idle / subscribed / busy
- [ ] Subscribe stores role/tenant/branch metadata used for targeting
- [ ] Unsubscribe deletes DB row + browser subscription

### Server

- [ ] Send endpoint deployed
- [ ] Auth matrix enforced (anon cannot target userId)
- [ ] Dedupe endpoints; prune 404/410
- [ ] Inbox insert for userId targets (if using inbox)
- [ ] Service role path for webhooks/cron

### Product

- [ ] Event → notify mapping documented in one module
- [ ] All notify calls after successful persistence
- [ ] Deep links pass auth/role gates for the recipient
- [ ] Payment/status webhooks notify without relying on the SPA
- [ ] Guest flows: staff fan-out only (if applicable)

### Verify

- [ ] Builder unit tests green
- [ ] Anon staff fan-out probe 200; anon userId 403
- [ ] Real device: enable → event → notification → click URL
- [ ] Push failure does not break primary business transaction

---

## 13. Failure modes (debug tree)

| Symptom | Check |
|---------|--------|
| Enable does nothing | Public VAPID missing; SW not registered; not secure context |
| Immediate `denied` | Site settings / OS notification permission |
| Subscribe OK, never receives | Private key mismatch; send not called; no matching subscription rows |
| `sent: 0` | Wrong `user_id` / `role` / `branch_id`; staff never re-enabled after branch change |
| 401 on send | Gateway JWT vs function auth; missing Authorization |
| 403 on send | Anon tried `userId` target (correct if locked down) |
| Click opens `/` or 404 | Missing `url` in payload; SW not reading `data.url`; bad route |
| Click → forbidden page | Deep link not RoleGate-safe for that role |
| Works on Android, not iPhone | Not installed to Home Screen |
| Paid but silent | Webhook path never calls send; only client notify helpers exist |

---

## 14. Security non-negotiables

1. VAPID **private** key never in git, never in the client bundle.
2. Subscription writes scoped to the signed-in user.
3. Send API authenticated; anon limited to ops fan-out without `userId`.
4. Service role only from trusted server runtimes (webhook, cron, admin jobs).
5. Rate-limit public send entrypoints if exposed beyond your app.
6. Prune dead endpoints; do not log full auth/p256dh secrets.

---

## 15. What to tell the user (agent communication)

After implementing, report:

1. Where to set env vars (client + server).
2. How to enable in the UI.
3. Which business events fire pushes (table).
4. How you verified (commands + probe status codes).
5. Platform limits (iOS Home Screen).

Do **not** claim “push works for everyone” without device smoke or at least live send probes + builder tests.

---

## 16. Minimal code sketches (illustrative)

### URL-safe base64 → Uint8Array (client)

```ts
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
```

### SW click (pattern)

```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
```

### Send response shape

```json
{ "sent": 2, "pruned": 1 }
```

or when nobody matched:

```json
{ "sent": 0, "message": "No subscriptions" }
```

Prefer HTTP 200 for “no subscribers” so clients treating push as best-effort do not error-toast.

---

## 17. Related docs in this repo

| Doc | Use when |
|-----|----------|
| **This playbook** | Any project / agent with no context |
| [`PWA_WEB_PUSH.md`](./PWA_WEB_PUSH.md) | Kado Kohi file map, event matrix, café QA checklist |

Copy **this playbook** into other repos as `docs/WEB_PUSH_AGENT_PLAYBOOK.md` and link it from that repo’s `AGENTS.md`.
