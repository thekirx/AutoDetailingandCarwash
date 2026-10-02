/** Shared workflow copy for ops guide cards — plain language for floor staff. */

export const SETTINGS_HUB_COPY = Object.freeze({
  eyebrow: 'Settings',
  title: 'Company settings',
  description:
    'POS and daily sheet rules. People, branches, content, and audit stay in the main Command menu.',
})

export const FINANCE_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'sales',
    title: 'Sales income',
    body: 'Paid POS tickets land in Sales and roll into P&L. Filter by branch and date window at the top.',
  },
  {
    id: 'sheets',
    title: 'Daily sheets',
    body: 'Branch Admins submit the day from POS › Daily sheet: crew pay, cash advances, expenses, and the drawer count. Approve each sheet here to post it to the books.',
    href: '/operations/finance?tab=sheets',
    linkLabel: 'Open Daily sheets',
  },
  {
    id: 'bills',
    title: 'Bills and expenses',
    body: 'Record supplier bills with reference and due date. Each line picks an account that feeds P&L. Rows posted from a Daily Sheet stay locked here.',
  },
  {
    id: 'pl',
    title: 'Profit and loss',
    body: 'Approved sheets and paid bills land in P&L. Switch between the statement, fiscal year, period compare, and branch columns, then export.',
  },
])

export const INVENTORY_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'bay',
    title: 'Services and packages',
    body: 'Bay wash tiers and combo packages feed POS Sell and the queue. Size pricing and included services live here.',
  },
  {
    id: 'detailing',
    title: 'Detailing catalog',
    body: 'Multi-day ceramic, PPF, and interior jobs use detailing pay categories. Bookings board reads these rows.',
  },
  {
    id: 'merch',
    title: 'Merch and sellables',
    body: 'Coffee, shirts, and add-ons that POS sells under Merch. Family tags control which tile group they appear in.',
  },
  {
    id: 'stock',
    title: 'Branch stock',
    body: 'Restock arrivals and Sunday leftover recon per branch. Low stock blocks POS merch sales for that branch.',
  },
])

export const QUEUE_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'stay-until-pos',
    title: 'Stays until POS completes',
    body: 'Wash, package, and detailing jobs stay on this board through waiting, on the bay, final check, and payment. Nothing is removed or reset until POS completes the sale.',
  },
  {
    id: 'assign',
    title: 'Assign and advance',
    body: 'Open a ticket to assign present crew, start work, and move lanes as the job progresses. Same-day wash and packages belong here — not Bookings.',
  },
  {
    id: 'payment',
    title: 'Payment lane',
    body: 'After final check passes, send the ticket to payment. Floor staff collect at POS; completing the sale there clears the job from the queue.',
  },
  {
    id: 'redo',
    title: 'Redo lane',
    body: 'Owner QC failures land in Redo. Fix the work and advance again — the ticket stays on the board until POS release.',
  },
])

export const BOOKING_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'detailing-only',
    title: 'Detailing pipeline',
    body: 'Ceramic, tint, and PPF jobs live here. Same-day wash and packages stay on Queue — not this board.',
  },
  {
    id: 'open-until-done',
    title: 'Open until released',
    body: 'Scheduled jobs stay on the board and calendar until successful release or cancellation. Date filters only narrow finished history.',
  },
  {
    id: 'advance',
    title: 'Advance stages',
    body: 'Move bookings through pending, confirmed, waiting, in progress, final check, and release. Tap a stage chip to jump columns on the board.',
  },
  {
    id: 'pos-handoff',
    title: 'POS handoff',
    body: 'Payment and completion happen at POS after release. Until then, the job stays visible here for sales and floor coordination.',
  },
  {
    id: 'maintenance',
    title: 'Maintenance schedules',
    body: 'Use the Maintenance tab to set Ceramic/PPF/Paint Maintenance reminder intervals, adjust due dates per plate, and notify clients when maintenance is due. Stage moves already SMS the customer.',
  },
])

export const CRM_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'directory',
    title: 'Customer directory',
    body: 'Search by name, phone, or plate. Open a profile for vehicles, visit history, loyalty stamps, and membership tier.',
  },
  {
    id: 'groups',
    title: 'Smart groups',
    body: 'Preset and saved visit filters — recent visitors, lapsed customers, never visited. Use for SMS campaigns and follow-ups.',
  },
  {
    id: 'insights',
    title: 'Behavior insights',
    body: 'Sales by hour, branch, service family, and best sellers. Date range and branch scope match Finance KPIs.',
  },
  {
    id: 'sms',
    title: 'SMS outreach',
    body: 'Send titled messages to selected customers. Opt-in numbers only; delivery status returns in the SMS tab.',
  },
])

export const MEMBERSHIPS_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'program',
    title: 'Program controls',
    body: 'Super Admin toggles stamps, spend points, and paid memberships. Stamp earn mode and card slots apply on the next POS checkout.',
  },
  {
    id: 'tiers',
    title: 'Premium plans',
    body: 'Create tiers with price, discount, loyalty multiplier, and included services. POS reads active tiers live.',
  },
  {
    id: 'loyalty',
    title: 'Stamp thresholds',
    body: 'Milestone rewards when customers fill stamp slots. Labels show on the customer app and CRM profile.',
  },
  {
    id: 'scoring',
    title: 'Service scoring',
    body: 'Per-service loyalty weight controls how many stamps or points a paid line earns. Heavier washes can score higher.',
  },
  {
    id: 'assign',
    title: 'Assign members',
    body: 'Attach a customer to a tier or revoke membership. Changes apply immediately on POS and CRM.',
  },
])

export const REVIEWS_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'after-visit',
    title: 'After visit ratings',
    body: 'Customers rate overall, app, service, and detailing axes after a completed visit. Scores land here for branch review.',
  },
  {
    id: 'branch-filter',
    title: 'Branch scope',
    body: 'Filter by branch or view all if you have multi-branch access. Averages update for the visible set only.',
  },
  {
    id: 'follow-up',
    title: 'Follow-up signal',
    body: 'Low scores and comments flag quality issues. Cross-check with Queue redo lanes and CRM notes for the same customer.',
  },
  {
    id: 'trends',
    title: 'Axis averages',
    body: 'Top stat cards show rolling averages per rating axis. Use alongside Finance sales for context, not as payroll proof.',
  },
])

export const KPI_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'crew',
    title: 'Crew performance',
    body: 'Cars handled, active jobs, and average minutes come from get_crew_kpi (or the summary view). Hover stats for sample size and share of the date range.',
  },
  {
    id: 'compare',
    title: 'Branch compare',
    body: 'Completed volume and cycle time by branch for the selected window. Use when you have multi-branch access.',
  },
  {
    id: 'service',
    title: 'By service',
    body: 'Volume and cycle by catalog service. Pair with Inventory SLA minutes to spot over-SLA work.',
  },
  {
    id: 'sales',
    title: 'Sales and complaints',
    body: 'Paid sales in range and open complaints (when your role allows). KPI is for floor coaching — not payroll proof.',
  },
])

export const PLANNING_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'board',
    title: 'Board and lists',
    body: 'Tasks live in lists on the board. Assign crew, set due dates, and require photo proof when needed.',
  },
  {
    id: 'review',
    title: 'Review proof',
    body: 'Submitted work lands in Review. Approve or send back — assignees see status on My Tasks.',
  },
  {
    id: 'calendar',
    title: 'Calendar and events',
    body: 'Overlay tasks, published events, bookings, and forms. Filters control which sources show.',
  },
  {
    id: 'configure',
    title: 'Configure',
    body: 'Editors manage lists, categories, checklist templates, and boards. Staff only see assigned work.',
  },
])

export const MY_TASKS_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'queue',
    title: 'Queue jobs',
    body: 'Floor tickets assigned to you stay here until the job advances. Open the ticket to update status on Queue.',
  },
  {
    id: 'planning',
    title: 'Planning cards',
    body: 'Planner tasks assigned to you. Submit photo proof when required, then wait for review.',
  },
  {
    id: 'attendance',
    title: 'Attendance first',
    body: 'Staff should clock in on Attendance before floor work. Present status unlocks some sellables and gates.',
  },
  {
    id: 'planner',
    title: 'Open Planner',
    body: 'Managers assign cards from Planner. If this list is empty, ask for an assignment or open Planner when you have access.',
  },
])

export const BRANCH_STOCK_WORKFLOW_STEPS = Object.freeze([
  {
    id: 'restock',
    title: 'Restock arrivals',
    body: 'When shipment arrives, add quantity per product. On-hand counts update immediately for your branch.',
  },
  {
    id: 'recon',
    title: 'Sunday recon',
    body: 'Count leftovers after the week, submit recon, and wait for SA/ASA approval before counts adjust.',
  },
  {
    id: 'pos',
    title: 'POS tie-in',
    body: 'Merch sold at POS deducts branch stock automatically. Restock here when the shelf runs low.',
  },
  {
    id: 'approve',
    title: 'Owner approval',
    body: 'Submitted recons stay pending until catalog managers approve or reject. Rejected rows keep prior counts.',
  },
])
