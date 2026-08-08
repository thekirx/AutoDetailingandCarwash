# 05 — Mobile Responsiveness

Source: `tailwind.config.js`, `Layout.tsx`, `QueueItem.tsx`, `QueueList.tsx`, `QueueManager.tsx`, `CustomerView.tsx`, `MobileView.tsx`, `index.html`, `ServicesPage.tsx`, `CrewManager.tsx`.

## Breakpoints

| Token | Width | Notes |
|-------|-------|--------|
| `xs` | **475px** | Custom — must be recreated in the new Tailwind config |
| `sm` | 640px | Default |
| `md` | 768px | Nav hamburger cutoff |
| `lg` | 1024px | Wider grids / padding |
| `xl` | 1280px | Occasional typography/padding |

No `2xl` usage in `src/`.

## Viewport

`index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

**No PWA:** no service worker, no shipped `manifest.json` (Vercel routes mention it, file not present). Do not assume installable app behavior unless you add it in the new project.

## Layout (staff chrome) — port this pattern

File: `Layout.tsx`

| Behavior | Classes / logic |
|----------|-----------------|
| Sticky header | `sticky top-0 z-40` |
| Content width | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |
| Desktop nav | `hidden md:flex` |
| Mobile hamburger | `md:hidden` Menu/X toggle |
| Mobile drawer | Full-width panel under header when open; closes on link click |
| Theme toggle | Shown on desktop nav and mobile header |

Routes **with** Layout: `/`, `/crew`, `/services` (+ motorcycle routes — skip).  
Routes **without** Layout: `/customer`, `/mobile` (kiosk full-bleed).

### Touch targets (legacy weakness)

Menu and icon buttons often use `p-2` / `p-1` — below 44×44px. **Improve** in the new app (min 44px touch targets) while keeping the hamburger-at-`md` pattern.

---

## Queue (primary team-lead mobile UX)

### QueueManager

- Header stacks: `flex-col sm:flex-row sm:items-center sm:justify-between`
- Forms and list stack naturally on small screens

### QueueItem (main responsive surface)

| Element | Responsive behavior |
|---------|---------------------|
| Card padding | `p-3 sm:p-4` / `p-4 sm:p-6` |
| Header | Column until `xs:flex-row` |
| Status badge | Desktop `hidden sm:block`; mobile shows under header |
| Expand chevron | `sm:hidden` |
| Detail grid | `grid-cols-2 md:grid-cols-4 lg:grid-cols-5` |
| Crew picker grid | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| Action buttons | `flex-col sm:flex-row`; `active:scale-95` for press feedback |

**Port priority:** QueueItem’s stacking patterns are what make the team-lead phone experience usable.

### QueueList

- Status/stat tiles: `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` — dense on narrow phones
- Filters wrap; calendar popover used for custom dates
- Consider collapsing stats into a horizontal scroll or 2-row layout in the new app

### Services / Crew pages

Use `xs` / `sm` for button rows and padding (`ServicesPage`, `CrewManager`). Recreate `xs: 475px` or replace with `sm` consistently.

---

## Customer View (`/customer`) — desktop TV, not mobile

Purpose: lobby / TV board.

| Trait | Detail |
|-------|--------|
| Layout | Always `grid-cols-3` — Waiting / In Progress / Ready for Payment |
| Scroll | `100vh` + `overflow: hidden` (“non-scrollable”) |
| Font scaling | Based on **vehicle count**, not viewport |
| Layout chrome | None |
| Clock | Updates every 1s (display only) |
| Data | Active = not completed/cancelled (any day) |

**Do not treat as a phone layout.** On small screens it becomes three skinny clipped columns.

Port options:

1. Keep as **landscape/TV-only** route, or  
2. Rebuild with stacked columns / horizontal swipe for phones.

---

## Mobile View (`/mobile`) — phone glance board

Purpose: large **counts only** (not a plate list).

| Trait | Detail |
|-------|--------|
| Counts | `waiting` + `in-progress` only (not payment-pending) |
| Layout | Full-viewport stacked cards; already phone-oriented |
| Breakpoints | Almost none — fixed stacked design |
| Layout chrome | None |
| Clock | 1s interval |
| Body style | Forces dark bg `#030712`, `overflow: auto` |

Legacy also mixed motorcycle counts — **cars only** in the new app.

---

## Gaps to fix when porting

1. CustomerView is not mobile-adaptive.
2. QueueList six-up stats are cramped on small phones.
3. Brand text beside logo in Layout can crowd narrow widths — allow logo-only on `xs`.
4. No realtime: opening `/mobile` on a second phone will go stale until reload.
5. Touch targets often &lt; 44px.
6. Custom `xs` breakpoint is easy to forget — document in new Tailwind config.

## Recommended new-app responsive matrix

| Surface | Phone | Tablet | Desktop / TV |
|---------|-------|--------|--------------|
| Team Lead Queue | Stacked cards (QueueItem patterns) | Same + wider grids | Full nav + multi-column details |
| Crew / Services | Single column forms | 2-col where useful | Wide tables/forms |
| Customer board | Stacked or swipe (new) | 3-col ok | 3-col kiosk |
| Mobile counts | Keep big-number design | Same | Optional |

## Copy checklist (responsive)

- [ ] Add `screens.xs = 475px` (or consciously drop `xs`)
- [ ] Layout hamburger at `md`
- [ ] QueueItem header/actions stack on small screens
- [ ] Separate kiosk routes without staff nav
- [ ] Do not ship CustomerView’s fixed `grid-cols-3` as “mobile responsive”
- [ ] Raise touch targets to ≥ 44px
- [ ] Add polling/realtime for display routes
