# Foundations

Live tokens: `src/design-tokens.css`. Semantic aliases feed shadcn `@theme` in `src/styles.css`.

## Color

### Brand

| Token | Hex | Use |
|-------|-----|-----|
| `--color-brand-primary` | `#052699` | Primary CTA, active nav, links |
| `--color-brand-primary-hover` | `#0a32b8` | Hover |
| `--color-brand-primary-active` | `#031d78` | Pressed |
| `--color-brand-primary-soft` | `#e8edff` | Soft fills, selected rows |
| `--color-surface-page` | `#f1f1ed` | App page background |
| `--color-surface-subtle` | `#e7e7e3` | Nested surfaces |
| `--color-surface-dark` | `#101219` | Floor dark canvas |
| `--color-surface-cinematic` | `#020a31` | Marketing / auth cinematic |

### Semantic (light `:root` / dark `.dark`)

Map to shadcn: `--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`, `--border`, `--primary`, `--primary-foreground`, `--destructive`, `--ring`.

`--primary` always resolves to brand navy.

### Status (ops)

| Token | Meaning |
|-------|---------|
| `--status-queued` | Waiting |
| `--status-washing` | Wash in progress |
| `--status-detailing` | Detail in progress |
| `--status-ready` | Ready for pickup / handoff |
| `--status-paid` | Paid / closed |
| `--status-void` | Cancelled / void |
| `--status-late` | Late attendance / overdue |
| `--status-absent` | Absent / no-show |

Use `StatusBadge` only. Never invent ad-hoc colored pills.

## Typography

| Role | Family | Weight | Use |
|------|--------|--------|-----|
| Display | Benzin | 600–800 | Brand wordmark, customer H1, hero stat numbers |
| UI / body | Gilmer | 400–700 | All ops UI, tables, forms, dock labels |
| Mono nums | Gilmer + `tabular-nums` | 600 | Money, counts, queue numbers |

`--font-sans` = Gilmer. Do not load Geist.

### Scale (ops density 7)

| Step | Size | Use |
|------|------|-----|
| `xs` | 10–11px | Eyebrow, uppercase labels |
| `sm` | 12–13px | Meta, helper |
| `base` | 14–16px | Body, inputs |
| `lg` | 18–20px | Section titles |
| `xl` | 24–30px | Page H1 |
| `stat` | 28–36px | StatCard value |

Body ≥ 16px on customer mobile (iOS zoom rule).

## Spacing

4px grid. Ops uses tight density; customer uses roomier gaps.

| Token | Rem | Use |
|-------|-----|-----|
| `--space-1` | 0.25 | Inline icon gaps |
| `--space-2` | 0.5 | Compact stacks |
| `--space-3` | 0.75 | Form field gaps |
| `--space-4` | 1 | Card padding (dense) |
| `--space-5` | 1.5 | Section gaps |
| `--space-6` | 2 | Page section |

Content max: Command `max-w-7xl`, Floor tablet `max-w-5xl`, Customer stage ~430px.

## Shape lock

| Surface | Radius |
|---------|--------|
| Interactive (button, input) | 10px (`--radius`) |
| Cards / panels | 14px (`--shape-card`) |
| Sheets / dialogs | 18px (`--shape-sheet`) |
| Status badges + floor dock | pill (`999px`) |

Brand legacy `--shape-*` (formerly `--radius-sm/md/lg/xl` in design-tokens) avoids collision with shadcn `@theme` radius.

## Elevation

| Token | Use |
|-------|-----|
| `--shadow-card` | Elevated panels |
| `--shadow-card-hover` | Hover lift (customer) |
| flat + border | Default ops density |

No neon glows. Tint shadows toward navy, not pure black.

## Motion

| Kind | Duration | Easing |
|------|----------|--------|
| Micro (hover, press) | 150–200ms | ease |
| Panel open | 200–250ms | ease-out |
| Page enter | 200ms opacity | ease |

`prefers-reduced-motion: reduce` → instant / opacity only. GSAP reserved for marketing scroll stories.

## Iconography

- Library: `lucide-react`
- Stroke: 1.75
- Size: 20px in UI chrome, 24px in floor dock, 16px inline in tables
- Never emoji as icons
