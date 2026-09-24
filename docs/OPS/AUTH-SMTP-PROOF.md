# Auth SMTP — proof checklist (Gate 10.1)

**Product:** Hakum Auto Care customer Auth emails (recovery / invite / set-password).  
**Project ref (from local env):** `lybxhpzzqqyqswvuwpxv`  
**Dashboard:** https://supabase.com/dashboard/project/lybxhpzzqqyqswvuwpxv/auth/smtp

This CLI / Supabase MCP account only sees OffGrid + KadoKohi — **not** Hakum. SMTP must be configured and proved in the Hakum project dashboard (or after linking the Hakum org to MCP).

## Why it matters

Without custom SMTP (or a verified sender), password recovery and invite emails fail or land in spam. Soft-launch floor ops can run without it; **production customer account** email cannot.

## Configure (dashboard)

1. Open Authentication → SMTP Settings on project `lybxhpzzqqyqswvuwpxv`.
2. Enable custom SMTP (Resend / SendGrid / SES / etc.).
3. Set From to a domain you control (match SPF/DKIM).
4. Save. Confirm Auth email templates still use Hakum copy (recovery + invite).

## Proof (required to close Gate 10.1)

| Step | Action | Evidence |
|------|--------|----------|
| 1 | Trigger “Forgot password” for a real inbox you own | Screenshot of Auth logs or SMTP provider delivery |
| 2 | Open the link → land on `/account/set-password` | Screenshot of set-password success |
| 3 | Paste proof paths below | Fill this table |

**Status (2026-09-24):** **OPEN** — no dashboard proof in this session (Hakum project not on linked Supabase MCP org).

| Field | Value |
|-------|-------|
| SMTP provider | _pending_ |
| From address | _pending_ |
| Test inbox | _pending_ |
| Recovery delivered | _pending_ |
| `/account/set-password` OK | _pending_ |
| Evidence paths | _pending_ |

## Go criteria

Gate 10.1 closes only when recovery email is delivered and set-password completes for a real inbox — not when SMTP fields are merely filled.
