# Audits Full System 2026 08 01

> 15 nodes · cohesion 0.24

## Key Concepts

- **notifyShiftClose.mjs** (20 connections) — `server/notifyShiftClose.mjs`
- **notifyShiftCloseAccepted()** (11 connections) — `server/notifyShiftClose.mjs`
- **formatBacoorReportText()** (8 connections) — `src/lib/bacoorDailyReport.js`
- **buildOwnerDailySmsFromClose()** (6 connections) — `server/notifyShiftClose.mjs`
- **notifyShiftCloseOwnerSms.test.js** (6 connections) — `tests/notifyShiftCloseOwnerSms.test.js`
- **buildShiftCloseAcceptCopy()** (4 connections) — `server/notifyShiftClose.mjs`
- **listOwnerSmsPhones()** (4 connections) — `server/notifyShiftClose.mjs`
- **admin()** (3 connections) — `server/notifyShiftClose.mjs`
- **resolveOwnerSmsPhones()** (3 connections) — `server/notifyShiftClose.mjs`
- **formatMoneyMinor()** (2 connections) — `server/notifyShiftClose.mjs`
- **resolveFloorPayNotifyUserIds()** (2 connections) — `server/notifyShiftClose.mjs`
- **formatBacoorReportHeader()** (2 connections) — `src/lib/bacoorDailyReport.js`
- **copy** (1 connections) — `tests/notifyShiftCloseOwnerSms.test.js`
- **fin** (1 connections) — `tests/notifyShiftCloseOwnerSms.test.js`
- **sms** (1 connections) — `tests/notifyShiftCloseOwnerSms.test.js`

## Relationships

- [Src Lib Compensation](Src_Lib_Compensation.md) (5 shared connections)
- [Src Auth Permissions](Src_Auth_Permissions.md) (4 shared connections)
- [Src Lib opsRoadmap](Src_Lib_opsRoadmap.md) (3 shared connections)
- [Supabase Migrations 20260727020000 Smart Ops Forms](Supabase_Migrations_20260727020000_Smart_Ops_Forms.md) (3 shared connections)
- [Src Lib notificationTemplates](Src_Lib_notificationTemplates.md) (3 shared connections)
- [Docs User Stories Epic Daily Operations](Docs_User_Stories_Epic_Daily_Operations.md) (2 shared connections)
- [Audit Bugs Fixed](Audit_Bugs_Fixed.md) (2 shared connections)
- [Src Queue queueLogic](Src_Queue_queueLogic.md) (1 shared connections)
- [Supabase Migrations 20260915150000 Db Advisor Harden](Supabase_Migrations_20260915150000_Db_Advisor_Harden.md) (1 shared connections)

## Source Files

- `server/notifyShiftClose.mjs`
- `src/lib/bacoorDailyReport.js`
- `tests/notifyShiftCloseOwnerSms.test.js`

## Audit Trail

- EXTRACTED: 48 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*