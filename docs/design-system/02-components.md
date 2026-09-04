# Components

All primitives live under `src/components/ui/` (shadcn) and `src/components/ops/` (Hakum ops wrappers). Customize tokens; never ship stock shadcn look.

## Button

Variants: `default` (brand navy), `secondary`, `outline`, `ghost`, `destructive`.  
Sizes: `sm`, `default`, `lg`. Min height 44px on floor/capp touch surfaces (`min-h-11`).  
Label = exact action ("Save changes", "Clock in"). Same verb in toast.

## Input / Select / Textarea / Label

Label above field. Helper under label optional. Error under field. No placeholder-as-label. Focus ring uses `--ring` (brand).

## Tabs

Use `OpsTabList` / shadcn Tabs. Horizontal scroll on mobile. Active tab: brand underline or soft fill, not heavy card chrome.

## Badge / StatusBadge

`Badge` for counts and neutral tags.  
`StatusBadge` for workflow status only — maps status keys to `--status-*` tokens (queued, washing, detailing, ready, paid, void, late, absent).

## Card

Prefer spacing + dividers over nested cards. Cards allowed when they bound an interactive unit (stat, form section, ticket). Radius `--shape-card`.

## StatCard (`OpsStatTile` evolved)

Props: `label`, `value`, `delta?`, `icon?`, `hint?`, `loading?`, `mono?`, `highlight?`.  
Value uses `tabular-nums`. Loading = skeleton matching final shape.

## DataTable

Thin wrapper over shadcn Table: search, column sort, sticky header, optional column visibility, mobile card fallback (one row → stacked fields). Empty → `OpsEmptyState`.

## PageHeader (`OpsPageShell` evolved)

Eyebrow (optional), title + icon, description, breadcrumbs (from route), meta chip, actions. Sticky action row on mobile when primary CTA exists.

## FilterBar

Search, selects, date range, active chips, Clear. One row on desktop; collapse into sheet on phone.

## Dialog / Sheet / ConfirmDialog / ResponsiveSheet

- Dialog: desktop confirmations and short forms.
- Sheet `side="bottom"`: mobile floor/capp actions.
- ConfirmDialog: destructive or irreversible (void ticket, close shift). Title, body, Cancel + destructive primary.
- ResponsiveSheet: Dialog ≥ md, bottom Sheet < md.

## CommandMenu

Mounts existing `command.jsx` (cmdk). Items from `getOperationsNav(profile)`. Open: Ctrl/Cmd+K from CommandShell topbar. Floor/capp: optional via More, not required on phone.

## Empty / Error / Skeleton

- Empty: icon + title + one sentence + optional action.
- Error: what failed + retry.
- Skeleton: match layout shape; avoid lone spinners for page loads.

## Toast (sonner)

Success / error only for transient feedback. Prefer inline errors on forms. Verb agreement with buttons.
