# Workflows index (role QA)

Master map of critical paths exercised or documented in this campaign.

## Floor money path (Wave B)

| ID | Flow | Personas | Happy | Failure |
|----|------|----------|-------|---------|
| WF-TL-01 | Queue scan → advance lane | TL | Ticket moves | Access denied on POS |
| WF-TL-02 | New wash ticket | TL | Ticket on board | Validation blocks empty plate |
| WF-BA-01 | POS sale | BA | Sale completes / draft | TL deep-link denied |
| WF-BA-02 | Inventory adjust | BA | Stock updates | Staff denied |
| WF-ST-01 | Clock in/out | Staff | Attendance row | Outside geo soft-fail UI |
| WF-ST-02 | My tasks / my pay | Staff | Lists load | Finance denied |

## Leadership & books (Wave C)

| ID | Flow | Personas | Happy | Failure |
|----|------|----------|-------|---------|
| WF-SA-01 | Console → finance EoS tab | BossMich | Shift-close wizard opens | Non-SA cannot open payroll write |
| WF-SA-02 | Payroll confirm after EoS | BossMich | Register visible | Incomplete EoS blocks confirm (product rule) |
| WF-ASA-01 | Grant matrix honesty | ASA | Grant off → route deny | Empty grants keep console/queue |
| WF-OL-01 | Ops Lab / roadmap | OL | Roadmap home | No personal clock in nav |
| WF-INV-01 | Finance read-only hub | Investor | Finance loads | People/POS denied |

## Specialty (Wave D)

| ID | Flow | Personas | Happy | Failure |
|----|------|----------|-------|---------|
| WF-SAL-01 | Bookings board | Sales | Board loads | Queue/POS denied |
| WF-DET-01 | Detailing on Bookings | Detailer | Bookings home | Wash Queue deep-link denied |
| WF-MKT-01 | CRM + planner | Marketing | CRM home | Finance denied |
| WF-VID-01 | Calendar + tasks | Video | Planning calendar | Queue denied |

## Customer + public utilities (Wave E)

| ID | Flow | Personas | Happy | Failure |
|----|------|----------|-------|---------|
| WF-CUS-01 | Customer sign-in → account | Customer | `/account` | Bad phone soft error |
| WF-CUS-02 | Book / queue / loyalty | Customer | Pages load | Ops routes denied |
| WF-PUB-01 | Public book / forms / contact | Anon | Forms submit path | Landing `/home` not audited |

## Evidence packs

- `npm run e2e:ui-p0` → `e2e-evidence/ui-p0/`
- `npm run e2e:ui-money` → `e2e-evidence/ui-money/`
- Role-specific shots → `e2e-evidence/role-qa/`
