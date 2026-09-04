# Accessibility checklist

Run before shipping any shell or module change.

## Contrast (WCAG AA)

| Pair | Requirement |
|------|-------------|
| Body text on page / card | ≥ 4.5:1 |
| Large text / bold ≥ 18px | ≥ 3:1 |
| Primary button text on navy | White / inverse ≥ 4.5:1 |
| Muted text on page | ≥ 4.5:1 (avoid gray-on-gray) |
| Status badge text on soft fill | ≥ 4.5:1 |

Pre-check brand: `#052699` on `#ffffff` and white on `#052699` pass for UI text. Soft navy `#e8edff` needs dark ink (`#0f172a` / foreground), not white.

## Focus

- Visible focus ring on all interactive elements (`--ring`)
- Never `outline: none` without replacement
- Dialog / Sheet trap focus; restore on close

## Keyboard

| Surface | Path |
|---------|------|
| Command sidebar | Tab through items; Enter activates |
| CommandMenu | Cmd/Ctrl+K, arrows, Enter, Esc |
| Floor dock | Tab order left→right; Enter navigates |
| DataTable | Tab cells/actions; sortable headers keyboard activatable |
| Forms | Tab order matches visual order |

## Touch / mobile

- 44×44 min targets
- No hover-only actions (always provide tap equivalent)
- Safe-area insets respected (top + bottom)

## Semantics

- Page has one `h1`
- Icon-only buttons have `aria-label`
- Live queue updates: polite live region where status changes matter
- Images: meaningful `alt` or empty alt if decorative

## Motion

Honor `prefers-reduced-motion`. No essential info only in animation.

## Theme

Light and dark both keep hierarchy. Do not rely on `text-white` + CSS rewrite hacks.
