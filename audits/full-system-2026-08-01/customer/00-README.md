# Customer — full-system pack

**Role:** `customer`  
**Home:** `/account`  
**Scope:** Own profile / bookings / vehicles / loyalty via `/api/customer-portal`  
**Date:** 2026-08-01

## Routes in this pack

`/signin` · `/signup` · `/account` · `/account/set-password`

Public site surfaces live under [`../public/`](../public/).

## Prior deep audit

[`../../customer-deep/`](../../customer-deep/) — CRITICAL Fixed. Open: **CUST-H2** (phone-only reset), related **CUST-H9** on public forms.

UI dead: [`../../ui-dead-controls/`](../../ui-dead-controls/)

## Contents

| File | Purpose |
|------|---------|
| [`01-page-checklist.md`](./01-page-checklist.md) | Per-route |
| [`02-open-defects.md`](./02-open-defects.md) | OPEN |
| [`flows.html`](./flows.html) | Mermaid |
