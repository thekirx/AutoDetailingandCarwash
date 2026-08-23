# 09 — Flowcharts (interactions, functions, dataflow)

**Visual viewer (open in browser):** [09-FLOWCHARTS.html](./09-FLOWCHARTS.html) — all diagrams rendered with navigation.

**PDF (print / share):** [09-FLOWCHARTS.pdf](./09-FLOWCHARTS.pdf) — regenerate with `npm run generate:flowcharts-pdf`.

Markdown below is the source of truth for edits; sync changes into the HTML file when diagrams change.

---

## F1 — System context (POS in Hakum)

```mermaid
flowchart TB
  subgraph Floor
    TL[Team Lead Queue]
    BK[Bookings detailing]
  end
  subgraph POS[POS Counter]
    Sell[Sell catalog]
    PayQ[Pay queue]
    Exp[Expenses]
    EoS[End of shift]
  end
  subgraph Finance
    Rev[Accept reject lock close]
    PL[P and L from paid sales]
  end
  subgraph Payroll
    Pend[Pending floor reminder]
    Floor[Floor run POS proof]
    Fixed[Fixed salary run]
  end
  TL -->|for_payment handoff| PayQ
  BK -->|detailing for_payment| PayQ
  Sell --> Sale[complete_pos_sale]
  PayQ --> Sale
  Sale --> Exp
  Sale --> EoS
  Exp --> EoS
  EoS --> Rev
  Rev --> Pend
  Sale -.->|paid sales proof| Floor
  Pend --> Floor
  Floor --> Posted[payroll_runs confirmed]
  Fixed --> Posted
  Sale --> PL
```

---

## F2 — BA day loop (straightforward path)

```mermaid
flowchart TD
  Start([BA opens POS]) --> Merch[Sell merch tab]
  Start --> PQ{Pay queue tickets?}
  PQ -->|yes| Load[loadHandoff]
  Load --> Cart[Cart plus optional merch]
  Merch --> Cart2[Cart merch only]
  Cart --> Pay[Complete payment]
  Cart2 --> Pay
  Pay --> RPC[RPC complete_pos_sale]
  RPC --> Done[Ticket completed stock loyalty]
  Start --> Exp[Record day expenses]
  Exp --> Draft[expenses status draft]
  Start --> Close[End of shift wizard]
  Close --> Base[Baseline from paid sales]
  Base --> Attest[BA attest or override with reason]
  Attest --> Sub[submit_shift_close]
  Sub --> Fin[Finance reviews later]
```

---

## F3 — SA / ASA walk-in catalog checkout

```mermaid
flowchart TD
  Open[Open Sell] --> Tab{Catalog tab}
  Tab -->|bay| Bay[Services and packages]
  Tab -->|detailing| Det[Detailing SKUs]
  Tab -->|merch| Merch[Products]
  Bay --> Line[Cart line item_type service]
  Det --> Line
  Merch --> Prod[Cart line item_type product]
  Line --> Norm[normalizePosLineItemType]
  Prod --> Norm
  Norm --> Payload[buildPosSalePayload]
  Payload --> RPC[complete_pos_sale]
  RPC --> Sales[(sales + sale_line_items)]
  RPC --> Stock[(product stock if product)]
  RPC --> Cer{detailingAmountMinor and finance write?}
  Cer -->|yes| CerExp[(ceramic expense drafts)]
  Cer -->|no| End([Done])
  CerExp --> End
```

---

## F4 — Queue / booking → Pay queue → paid

```mermaid
sequenceDiagram
  participant TL as Team Lead
  participant Q as Queue or Bookings
  participant RPC1 as send_queue_ticket_to_payment
  participant H as pos_handoffs
  participant BA as BA or SA POS
  participant RPC2 as complete_pos_sale
  participant S as sales
  participant B as bookings

  TL->>Q: Final check / ready for payment
  Note over Q,RPC1: Admin sends to payment
  Q->>RPC1: for_payment
  RPC1->>H: insert pending handoff
  BA->>H: load pending
  BA->>BA: buildHandoffCartLine
  BA->>RPC2: payload with pos_handoff_id
  RPC2->>S: insert paid sale + lines
  RPC2->>H: status completed
  RPC2->>B: status completed
```

---

## F5 — complete_pos_sale write set

```mermaid
flowchart LR
  In[JSON payload] --> RPC[complete_pos_sale]
  RPC --> S[(sales)]
  RPC --> L[(sale_line_items)]
  RPC --> P[(products + stock movements)]
  RPC --> Loy[(loyalty)]
  RPC --> H[(pos_handoffs completed)]
  RPC --> T[(transactions completed)]
  RPC --> B[(bookings completed)]
  RPC --> A[(audit_logs)]
```

---

## F6 — End of shift data truth

```mermaid
flowchart TD
  Sales[(Paid sales today)] --> Rows[paidSalesToBacoorRows]
  Exp[(Expenses filtered)] --> Rep
  CA[(Approved cash advances)] --> Rep
  Rows --> Rep[buildBacoorDailyReport]
  Rep --> Base[pos_baseline computed]
  Base --> Wiz[ShiftCloseWizard]
  Wiz --> Over{Override fields?}
  Over -->|yes| Reason[Reason required]
  Over -->|no| Sub
  Reason --> Sub[submitted snapshot]
  Sub --> RPC[submit_shift_close]
  RPC --> SCR[(shift_close_reports submitted)]
  SCR --> Fin[Finance review_shift_close]
  Fin --> Acc{accepted locked?}
  Acc -->|yes| Pend[Pending floor reminder]
  Acc -->|no| Stop([Rejected or waiting])
```

---

## F7 — Payroll: what money path is real

```mermaid
flowchart TB
  subgraph Attestation[Does NOT pay]
    EoS[shift_close submitted totals]
    EoS --> Pend[Pending floor queue display PHP]
  end
  subgraph Proof[Pays people]
    PS[(Paid sales wash-eligible)]
    ATT[(Attendance weights)]
    CER[(Ceramic expense keys)]
    PS --> Prev[buildPayrollPreview]
    ATT --> Prev
    CER --> Prev
    Prev --> Run[run_payroll confirm]
    Run --> PR[(payroll_runs + lines + claimed sales)]
  end
  Pend -.->|optional nudge| Prev
```

---

## F8 — Settings vs runtime

```mermaid
flowchart LR
  Hub[Settings hub] --> PosSet[POS settings page]
  PosSet --> OPS[(ops_pos_settings)]
  PosSet --> SCF[(shift_close_field_config)]
  OPS --> UI[PosPage dropdowns]
  SCF --> Wiz[EoS wizard + Finance]
  Hard[Hardcoded tabs buckets BA gate] -.->|not from settings| UI
```

---

## F9 — Function call map (checkout)

```mermaid
flowchart TD
  addToCart[addToCart / loadHandoff] --> price[priceCartForMembership]
  price --> blocks[posCartBlocksCheckout]
  blocks --> checkout[checkout]
  checkout --> build[buildPosSalePayload]
  build --> norm[normalizePosLineItemType per line]
  norm --> rpc[supabase.rpc complete_pos_sale]
  rpc --> ceramic[buildCeramicCompensationExpenses optional]
  rpc --> reload[load POS day]
```

---

## F10 — Function call map (End of shift)

```mermaid
flowchart TD
  day[todaySales + todayExpenses + CAs] --> bac[buildBacoorDailyReport]
  bac --> money[moneySnapshotFromReport]
  money --> wiz[ShiftCloseWizard state]
  wiz --> val[validateShiftCloseSubmit]
  val --> submit[submit_shift_close payload]
  submit --> scr[(shift_close_reports)]
```

---

## How to re-audit with these charts

1. Pick a customer journey (walk-in merch, queue wash, detailing booking).
2. Walk F2–F4 against a staging branch.
3. Confirm F7: after confirm payroll, claimed sales clear pending days without trusting close ₱.
4. Log findings in [AUDIT-LOG.md](./AUDIT-LOG.md).
