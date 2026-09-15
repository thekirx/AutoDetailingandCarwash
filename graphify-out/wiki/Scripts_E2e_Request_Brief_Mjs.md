# Scripts E2e Request Brief Mjs

> 23 nodes · cohesion 0.18

## Key Concepts

- **provisionCustomer.mjs** (23 connections) — `server/provisionCustomer.mjs`
- **provisionCustomerAccount()** (13 connections) — `server/provisionCustomer.mjs`
- **queueCustomerName.js** (10 connections) — `src/lib/queueCustomerName.js`
- **customerScope.test.js** (10 connections) — `tests/customerScope.test.js`
- **resolveQueueCustomerDisplayName()** (8 connections) — `src/lib/queueCustomerName.js`
- **customerAuthPublic.mjs** (6 connections) — `server/customerAuthPublic.mjs`
- **publicAuthLookupPayload()** (6 connections) — `server/customerAuthPublic.mjs`
- **mergeCustomerDisplayName()** (5 connections) — `src/lib/queueCustomerName.js`
- **validateQueueTicketIdentity()** (5 connections) — `src/lib/queueCustomerName.js`
- **queueCustomerName.test.js** (5 connections) — `tests/queueCustomerName.test.js`
- **provisionSms.mjs** (4 connections) — `server/provisionSms.mjs`
- **authCreateUserIdForCrm()** (4 connections) — `server/provisionSms.mjs`
- **buildProvisionInviteMessage()** (4 connections) — `server/provisionSms.mjs`
- **customerPortalActive.js** (3 connections) — `src/lib/customerPortalActive.js`
- **CUSTOMER_ACTIVE_VISIT_STATUSES** (3 connections) — `src/lib/customerPortalActive.js`
- **isWalkInCustomerName()** (3 connections) — `src/lib/queueCustomerName.js`
- **adminClient()** (2 connections) — `server/provisionCustomer.mjs`
- **assertQueueEditor()** (2 connections) — `server/provisionCustomer.mjs`
- **notifyCustomer()** (2 connections) — `server/provisionCustomer.mjs`
- **randomTempPassword()** (2 connections) — `server/provisionCustomer.mjs`
- **remountCustomerOntoAuthUid()** (2 connections) — `server/provisionCustomer.mjs`
- **normalizeQueuePlate()** (2 connections) — `src/lib/queueCustomerName.js`
- **root** (1 connections) — `tests/customerScope.test.js`

## Relationships

- [Src Lib crmInsights](Src_Lib_crmInsights.md) (9 shared connections)
- [Src Lib notificationTemplates](Src_Lib_notificationTemplates.md) (7 shared connections)
- [Src Lib dataCenterLogic](Src_Lib_dataCenterLogic.md) (6 shared connections)
- [Src Lib cookieConsent](Src_Lib_cookieConsent.md) (3 shared connections)
- [Docs User Stories Pdf](Docs_User_Stories_Pdf.md) (2 shared connections)
- [Src Lib partnershipInquiry](Src_Lib_partnershipInquiry.md) (2 shared connections)
- [Docs Audits 2026 09 Money Path](Docs_Audits_2026_09_Money_Path.md) (2 shared connections)
- [Src Lib detailingBoardStatuses](Src_Lib_detailingBoardStatuses.md) (2 shared connections)
- [Src Auth Permissions](Src_Auth_Permissions.md) (1 shared connections)
- [Src Lib auditFixtures](Src_Lib_auditFixtures.md) (1 shared connections)

## Source Files

- `server/customerAuthPublic.mjs`
- `server/provisionCustomer.mjs`
- `server/provisionSms.mjs`
- `src/lib/customerPortalActive.js`
- `src/lib/queueCustomerName.js`
- `tests/customerScope.test.js`
- `tests/queueCustomerName.test.js`

## Audit Trail

- EXTRACTED: 80 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*