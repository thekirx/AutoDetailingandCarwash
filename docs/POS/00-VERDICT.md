# 00 — Strict POS verdict

**Date:** 2026-08-22  
**Question:** Is POS complete, correct, and ready as Hakum’s counter for final payment of services/packages/detailing, walk-in inventory sell, settings customization, and truthful End of shift → payroll?

## Scorecard (strict)

| Claim | Verdict | Notes |
|-------|---------|-------|
| Final payment for **queue / booking handoffs** (services on ticket) | **PASS** | Pay queue → `complete_pos_sale` settles handoff + booking |
| Walk-in sell **services & packages** (bay catalog) | **PASS for SA/ASA** · **FAIL for BA by design** | BA catalog forced to merch only |
| Walk-in sell **detailing** | **PASS for SA/ASA** · **FAIL for BA by design** | Same gate |
| Walk-in sell **inventory / merch** | **PASS** | BA filtered to sellable tags; SA sees all active products |
| Package/detailing cart → RPC safe | **PASS (after audit fix)** | Normalized to `item_type: service` + `service_id` |
| End of shift retrieves **real paid POS data** as baseline | **PASS** | From today’s paid `sales` + counted expenses |
| End of shift numbers **are** payroll | **FAIL (by design)** | Payroll recomputes from paid sales + attendance |
| Fully customizable Settings | **FAIL** (improved honesty) | Labels/lists + field flags; not tabs/buckets/BA gate |
| Payment method list honored at checkout | **PASS (client)** | Validated against `ops_pos_settings`; RPC still stores string |
| Ceramic drafts for detailing-tab coating | **PASS (improved)** | `isCeramicCompensationLine`; PPF excluded |
| EoS CA double-count hazard | **MITIGATED** | Label + approved CA list + field hints |
| Easy & straightforward for BA day job | **MOSTLY PASS** | Merch + Pay queue + expenses + EoS after training |
| Ready to sell as “settings for everything” | **FAIL** | Would be false advertising |

## One-paragraph honest summary

Hakum POS is a **purpose-built bay counter**, not Square. Branch Admin is deliberately a **merch + Pay queue + expenses + End of shift** tool. Super Admin / ASA with POS can sell bay packages, detailing, and merch walk-in. Paid sales are real ledger rows. End of shift is an **attestation** over a POS-computed baseline (overridable with reasons) — useful for Finance cash honesty, **not** the payroll calculator. Payroll floor pay ignores close ₱ and pays from **paid POS wash-eligible lines + attendance** (plus ceramic drafts / optional CA deduct). Calling POS “fully customizable” or “BA sells full services from catalog” is **incorrect** relative to the code.

## What “complete” would still require (if owner wants those claims)

1. Owner decision: BA may sell bay/detailing walk-in — **or** keep BA merch-only and document it as the standard.
2. Settings depth: add/remove payment methods & expense kinds; **server** allowlist on `complete_pos_sale` — or stop saying “fully customizable.”
3. Optional: hard-block Run payroll when `pending_floor_optional === false` (today: banner + copy only).
4. Optional: exclude unpaid expense drafts from cash-left math (today: counted; wizard warns).

## Recommendation

Treat current POS as **operable for Hakum’s designed BA job**. Audit fixes (2026-08-22) hardened cart locality, ceramic eligibility, EoS honesty, and pending policy visibility. Do **not** expand BA catalog or auto-payroll without owner questionnaire answers.
