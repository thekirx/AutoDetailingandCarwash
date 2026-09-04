# Patterns

## Page anatomy

```
[ PageHeader: eyebrow | title | breadcrumbs | actions ]
[ Summary strip: StatCards 2–5 ]
[ FilterBar ]
[ Primary content: table | board | form | split ]
[ Drawer / Sheet for detail ]
```

One job per section. Do not stack unrelated cards for decoration.

## CRUD flow

1. List (DataTable or board)
2. Open → ResponsiveSheet / Dialog
3. Save → toast success; refresh list
4. Destructive → ConfirmDialog → toast

## Money

- Currency: PHP, `tabular-nums`, format via existing money helpers.
- Never color alone for paid/void — use StatusBadge + text.
- POS sticky pay bar always visible above safe-area.

## Date / time

Asia/Manila. Date-only fields as `YYYY-MM-DD` in UI when editing; human labels for display.

## Search + filters

Debounce search 200–300ms. Filters are additive. Show active chip count. Clear resets all.

## Bulk actions

Toolbar appears when selection > 0. Confirm before bulk destructive.

## Forms

- Label above, error below, helper when needed.
- Progressive disclosure for advanced fields.
- Disable submit while pending; keep field values on error.

## States matrix

| State | UI |
|-------|-----|
| Loading | Skeleton matching layout |
| Empty | OpsEmptyState + CTA if user can create |
| Error | OpsErrorState + Retry |
| Success | Toast or inline confirmation |
| Confirm | ConfirmDialog |

## Copy

Active voice, sentence case. Name by what the user controls ("Send reminder", not "Trigger webhook"). Empty screens invite action. Errors state what went wrong and how to fix.
