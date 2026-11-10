# run_payroll

> 12 nodes · cohesion 0.20

## Key Concepts

- **run_payroll** (8 connections) — `docs/PAYROLL/00-VERDICT.md`
- **Floor Pay from Paid POS and Attendance** (7 connections) — `docs/PAYROLL/00-VERDICT.md`
- **buildPayrollPreview** (5 connections) — `docs/PAYROLL/00-VERDICT.md`
- **buildRunPayrollPayload** (2 connections) — `docs/PAYROLL/02-DATAFLOW.md`
- **payroll_run_sales** (2 connections) — `docs/PAYROLL/02-DATAFLOW.md`
- **Floor Payroll Pays from Paid POS Sales plus Attendance** (2 connections) — `docs/POS/05-PAYROLL-CONNECTION.md`
- **Keep the POS-Proof Contract** (1 connections) — `docs/PAYROLL/00-VERDICT.md`
- **Payroll RPC Trust Boundary** (1 connections) — `docs/PAYROLL/00-VERDICT.md`
- **pg_advisory_xact_lock Payroll Confirm** (1 connections) — `docs/PAYROLL/02-DATAFLOW.md`
- **payroll_runs** (1 connections) — `docs/PAYROLL/02-DATAFLOW.md`
- **F7 Coverage Claimed Sales** (1 connections) — `docs/PAYROLL/10-FLOWCHARTS.md`
- **F9 Preview Function Map** (1 connections) — `docs/PAYROLL/10-FLOWCHARTS.md`

## Relationships

- [run_kind fixed](run_kind_fixed.md) (1 shared connections)
- [End of Shift Does Not Pay Crew](End_of_Shift_Does_Not_Pay_Crew.md) (1 shared connections)
- [EoS Attestation Does Not Calculate Employee Lines](EoS_Attestation_Does_Not_Calculate_Employee_Lines.md) (1 shared connections)
- [run_kind floor](run_kind_floor.md) (1 shared connections)
- [Package Kinds Collapse to Adjustment](Package_Kinds_Collapse_to_Adjustment.md) (1 shared connections)
- [Hakum Payroll Documentation Index](Hakum_Payroll_Documentation_Index.md) (1 shared connections)

## Source Files

- `docs/PAYROLL/00-VERDICT.md`
- `docs/PAYROLL/02-DATAFLOW.md`
- `docs/PAYROLL/10-FLOWCHARTS.md`
- `docs/POS/05-PAYROLL-CONNECTION.md`

## Audit Trail

- EXTRACTED: 13 (68%)
- INFERRED: 6 (32%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*