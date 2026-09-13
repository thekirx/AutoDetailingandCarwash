# Video Editor

- **Wave:** D
- **Demo:** `video@hakumautocare.com`
- **Guide:** [docs/guides/roles/video-editor.md](../../../docs/guides/roles/video-editor.md)
- **Home:** `/operations/planning?tab=calendar`
- **Shell:** floor

## Allowed routes (must load)

`attendance`, `my-tasks`, `my-pay`, `planning`

## Denied routes (must wall / absent from nav)

Must-deny focus: `queue`, `pos`, `finance`, `crm`

Code-denied sample: `console`, `dashboard`, `queue`, `queue-new`, `bookings`, `crew`, `kpi`, `pos`, `inventory`, `crm`, `reviews`, `memberships` …

## Nav / dock

Calendar · My Tasks · My pay

Dock helper: getVideoEditorDock

## Primary buttons / modals / filters

Task complete

## Happy path

Planning calendar + my-tasks

## Failure path

Queue denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/video_editor/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened yet — update when found.
