# 10 — Flowcharts (interactions, functions, dataflow)

**Visual viewer (open in browser):** [10-FLOWCHARTS.html](./10-FLOWCHARTS.html) — all diagrams rendered with navigation.

**PDF (print / share):** [10-FLOWCHARTS.pdf](./10-FLOWCHARTS.pdf) — regenerate with `npm run generate:flowcharts-pdf`.

Markdown below is the source of truth for edits; sync changes into the HTML file when diagrams change.

---

## F1 — System context

```mermaid
flowchart TB
  subgraph POS
    Sale[Paid sales]
    Cer[Ceramic expense drafts]
    EoS[End of shift]
  end
  subgraph Finance
    Rev[Accept reject lock]
  end
  subgraph Payroll
    Pend[Pending floor reminder]
    Floor[Floor preview]
    Fixed[Fixed preview]
    CA[CA approve]
    RPC[run_payroll]
  end
  Sale --> Floor
  Cer --> Floor
  EoS --> Rev
  Rev --> Pend
  Pend -.-> Floor
  Floor --> RPC
  Fixed --> RPC
  CA --> EoS
  CA -.->|broken auto deduct| Floor
  RPC --> Posted[(payroll_runs confirmed)]
```

---

## F2 — Floor confirm sequence

```mermaid
sequenceDiagram
  participant SA as SA or ASA
  participant UI as PayrollPage
  participant Eng as buildPayrollPreview
  participant RPC as run_payroll
  participant DB as Postgres

  SA->>UI: Period + Run floor
  UI->>UI: loadProof sales attendance ceramic
  UI->>Eng: buildPayrollPreview floor
  Eng-->>UI: proof + lines
  SA->>UI: Confirm
  UI->>RPC: buildRunPayrollPayload
  RPC->>DB: payroll_runs + lines + sales claims
  RPC->>DB: expenses paid or insert
  RPC->>DB: audit_logs
```

---

## F3 — Fixed confirm

```mermaid
flowchart TD
  Pkg[(staff_pay_packages)] --> Prorate[prorateMonthlyPackageMinor]
  Prorate --> Lines[package lines]
  Adj[Manual commission deduct] --> Lines
  Lines --> Payload[buildRunPayrollPayload run_kind fixed]
  Payload --> RPC[run_payroll]
  RPC --> Runs[(payroll_runs fixed)]
```

---

## F4 — Wash pool day

```mermaid
flowchart LR
  Sales[Paid sales that day] --> Wash[washPoolAmountMinor]
  Wash --> Pool[times wash_pool_pct]
  Att[Attendance present late] --> W[attendanceWeight]
  Pool --> Split[splitWashPool]
  W --> Split
  Split --> Lines[wash_pool lines]
```

---

## F5 — Pending vs pay truth

```mermaid
flowchart TB
  subgraph Attestation[Does NOT pay]
    Close[shift_close submitted PHP]
    Close --> Pend[Pending queue display]
  end
  subgraph Proof[Pays people]
    PS[Paid POS wash lines]
    ATT[Attendance]
    CER[Ceramic keys]
    PS --> Prev[buildPayrollPreview]
    ATT --> Prev
    CER --> Prev
    Prev --> Run[run_payroll]
  end
  Pend -.->|nudge only| Prev
```

---

## F6 — Cash advance paths

```mermaid
flowchart TD
  Form[ops form cash_advance] --> Sub[ops_form_submissions]
  Sub --> Panel[Payroll CA panel]
  Panel -->|resolved| Close[POS End of shift expenses]
  Panel -->|auto deduct setting| Broken[Broken load approved + no staff_id]
  Broken -.->|should| Deduct[adjustment_deduct on preview]
  Manual[Manual wizard deduct] --> Preview[Floor or fixed lines]
```

---

## F7 — Coverage claimed sales

```mermaid
flowchart TD
  Run[Confirmed floor run] --> Sales{payroll_run_sales length?}
  Sales -->|yes| Days[Cover only sale business_dates]
  Sales -->|no| Period[Cover full period_start to end]
  Days --> Pend[Pending drops matching close days]
  Period --> Pend
```

---

## F8 — Role access

```mermaid
flowchart LR
  SA[Super Admin] --> Reg[Payroll register]
  ASA[ASA finance_view] --> Reg
  ASAW[ASA finance_write] --> Confirm[Confirm and CA]
  BA[Branch Admin] --> MyPay[My Pay only]
  TL[Team Lead] --> MyPay
  Crew[Crew] --> MyPay
```

---

## F9 — Function map (preview)

```mermaid
flowchart TD
  load[loadProof] --> prev[buildPayrollPreview]
  prev --> wash[washPoolAmountMinor + splitWashPool]
  prev --> cer[parseCeramicKey + splitAmount]
  prev --> pkg[prorateMonthlyPackageMinor]
  prev --> ca[CA deduct if flag]
  prev --> block[payrollBlocksConfirm]
  block --> payload[buildRunPayrollPayload]
  payload --> rpc[run_payroll]
```

---

## How to re-audit

1. Run a floor window with known paid sales + attendance; confirm claimed sales.
2. Accept a close; verify pending; confirm coverage after claim.
3. Approve a CA; verify close math; verify payroll does **not** auto-deduct until fixed.
4. Post a fixed package; check My Pay label.
5. Log in [AUDIT-LOG.md](./AUDIT-LOG.md).
