#!/usr/bin/env python3
"""Generate owner-facing tabbed HTML (stories only, no flowcharts)."""
from __future__ import annotations

import html
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT_HTML = ROOT / "docs" / "user-stories" / "USER-STORIES-OWNER.html"


def e(s: str) -> str:
    return html.escape(str(s), quote=True)


def story(as_: str, want: str, so: str, done: list[str] | None = None) -> str:
    checks = ""
    if done:
        items = "".join(
            f'<li class="done"><span class="box">✓</span><span>{e(d)}</span></li>'
            for d in done
        )
        checks = f'<ul class="ac">{items}</ul>'
    return f"""<article class="story">
  <p class="as"><strong>As</strong> {e(as_)}</p>
  <p class="want"><strong>I want</strong> {e(want)}</p>
  <p class="so"><strong>So that</strong> {e(so)}</p>
  {checks}
</article>"""


def section(title: str, lead: str | None, body: str) -> str:
    lead_html = f'<p class="lead">{e(lead)}</p>' if lead else ""
    return f"""<section class="block">
  <h2>{e(title)}</h2>
  {lead_html}
  {body}
</section>"""


def role_card(opens: str, pages: list[str], never: list[str]) -> str:
    pages_li = "".join(f"<li>{e(p)}</li>" for p in pages)
    never_li = "".join(f"<li>{e(p)}</li>" for p in never)
    return f"""<div class="role-card">
  <div><h3>Opens first</h3><p>{e(opens)}</p></div>
  <div><h3>Main pages</h3><ul>{pages_li}</ul></div>
  <div><h3>Usually does not</h3><ul>{never_li}</ul></div>
</div>"""


def join_stories(*stories: str) -> str:
    return "".join(stories)


TABS: list[dict] = []


def add_tab(id_: str, label: str, body: str) -> None:
    TABS.append({"id": id_, "label": label, "body": body})


# --- Start here ---
add_tab(
    "start",
    "Start here",
    f"""
<p class="tab-intro">A short owner brief — how Hakum Ops handles money and who is responsible. No technical diagrams — only stories.</p>
{section(
    "What this document is",
    "Everything your team needs to understand the shop day, payroll honesty, and who can open which tools — written for owners, not developers.",
    """<ul>
    <li><strong>Shop day</strong> — morning to night stories</li>
    <li><strong>Pay rules</strong> — wash pool, late, absent, detailing, cash advances</li>
    <li><strong>Night close</strong> — end of shift → finance → payroll → books</li>
    <li><strong>One tab per role</strong> — Owner through Customer</li>
    <li><strong>All pages</strong> — every major screen and what it is for</li>
  </ul>""",
)}
{section(
    "The one money rule",
    None,
    """<p><strong>Paid checkout tickets are the only source of day sales.</strong>
  Ending the shift is a cash-drawer story — it does not invent employee pay.
  Finance accepts the close. Then you (or your assistant) confirm floor payroll from real sales plus who clocked in.</p>""",
)}
{section(
    "Same-night loop (target)",
    None,
    """<ol>
    <li>Branch Admin submits end of shift</li>
    <li>You or your assistant accept it in Finance</li>
    <li>Pending floor pay shows “what they attested” next to “what POS actually sold”</li>
    <li>You confirm floor payroll (blocked until the close is accepted, when the hard gate is on)</li>
    <li>Books / profit &amp; loss follow paid sales — not typed overrides</li>
  </ol>""",
)}
{section(
    "Example pesos (one day, two branches)",
    "Use this as a sanity check when reading reports.",
    """<div class="table-wrap"><table>
    <tr><th>What happened</th><th>About ₱</th></tr>
    <tr><td>Bacoor wash sales</td><td>2,000</td></tr>
    <tr><td>Wash pool (35%)</td><td>700 split — on-time earns more than someone 1 hour late</td></tr>
    <tr><td>Imus wash pool (crew only)</td><td>350</td></tr>
    <tr><td>Coating 10,000 minus 500 shirt → 10% + 10%</td><td>950 to crew + 950 to assigned detailer</td></tr>
    <tr><td>Approved cash advance 200 off a 700 wash share</td><td>That person nets 500</td></tr>
  </table></div>
  <p>Carwash salary on the close report = <strong>wash pool only</strong>. Detailing shares are separate — they do not inflate the carwash salary line.</p>
  <p>Each branch settles on its own sales. Bacoor wash never funds Imus pay.</p>""",
)}
{section(
    "How to read a story",
    None,
    """<p>Every card says <strong>As</strong> (who), <strong>I want</strong> (the job), <strong>So that</strong> (why it matters), and green checks for what “done” looks like on the floor.</p>""",
)}
""",
)

# --- Shop day ---
add_tab(
    "shop",
    "Shop day",
    f"""
<p class="tab-intro">Stories for a normal bay day — clock in, wash queue, detailing, checkout, close.</p>
{section(
    "Morning — who is here",
    "Pay and car assignment only count people who really showed up.",
    join_stories(
        story(
            "a crew member or Team Lead",
            "to clock in at my branch (with location rules when turned on)",
            "the wash pool only includes people who are actually here",
            [
                "Clock can be blocked when attendance is turned off for that person",
                "Geofence can require being near the shop",
                "Owner account does not use the floor clock",
                "Present and late can be given a car; absent cannot",
            ],
        )
    ),
)}
{section(
    "Wash queue (Team Lead)",
    "Same-day carwash only. Detailing stays on the bookings board.",
    join_stories(
        story(
            "Team Lead",
            "to add and move wash tickets toward payment",
            "customers flow from waiting to checkout without mixing multi-day detailing",
            [
                "Team Lead can open the wash queue and create tickets",
                "Queue is wash-only; detailing stays with Sales / Detailer",
                "Handoff to checkout keeps the queue number and visit group",
                "Adding merch keeps the handoff; adding a walk-in service starts a new ticket",
            ],
        )
    ),
)}
{section(
    "Detailing bookings (Sales)",
    None,
    join_stories(
        story(
            "Sales",
            "to run the detailing pipeline and assign a detailer",
            "coating and other detailing jobs are tracked separately from same-day wash",
            [
                "Pipeline statuses from assigned through completed",
                "Sales can work all branches with the right status permissions",
                "Paid detailing lands in the right sales bucket",
            ],
        )
    ),
)}
{section(
    "Checkout (Branch Admin)",
    None,
    join_stories(
        story(
            "Branch Admin",
            "to take payment for queue tickets and walk-ins",
            "paid checkout is the single truth for that day’s revenue",
            [
                "Cannot finish pay if a service line is missing its catalog link",
                "Payment methods: cash, GCash, card",
                "Detailing jobs create draft commission notes (not automatic posted pay)",
                "Approved cash advances show on close — not as a fake POS sales tab",
            ],
        )
    ),
)}
{section(
    "End of shift",
    None,
    join_stories(
        story(
            "Branch Admin",
            "to submit end of shift when the day had activity",
            "cash / GCash / card are attested against what POS sold",
            [
                "Close only offered when there were sales, expenses, or cash advances",
                "Total sales = paid POS (wash + detailing + merch), never cash-advance repayments",
                "Carwash salary preview = wash pool only",
                "If numbers differ from the baseline, a reason is required",
                "Only one open close per branch per day",
            ],
        ),
        story(
            "Owner or assistant",
            "to accept or reject submitted closes",
            "accepted days unlock pending floor pay",
            [
                "Review happens in Finance shift close",
                "Accept notifies the people who confirm payroll",
                "Profit & loss still follows paid sales, not typed overrides",
            ],
        ),
    ),
)}
""",
)

# --- Pay rules ---
add_tab(
    "pay",
    "Pay rules",
    f"""
<p class="tab-intro">How people get paid fairly — late, absent, detailing commission, cash advances, and books.</p>
{section(
    "Floor payroll",
    "Official pay is confirmed on Payroll — not guessed from the close report.",
    join_stories(
        story(
            "Owner or assistant with finance rights",
            "to confirm floor payroll from paid sales and attendance",
            "wash pool and detailing lines post once with proof",
            [
                "Payload keeps sale proof for the wash pool",
                "Wash pool = wash sales × pool % × present bay washers",
                "Missing detailer assignee blocks confirm",
                "Double-pay / overlap is rejected by the system",
            ],
        ),
        story(
            "Owner",
            "a separate wizard for monthly salaries",
            "bay floor pay and company salaries stay on separate tracks",
            [
                "Fixed run = packages only; floor run excludes packages",
                "Company packages can book under HQ when no branch is set",
            ],
        ),
        story(
            "Branch Admin or Team Lead",
            "to see today’s compensation estimate on Crew",
            "I can plan shifts without confusing estimate for posted pay",
            [
                "Crew does not insert wash-pool expenses as if they were paid",
                "Banner says estimate only — confirm on Payroll",
            ],
        ),
        story(
            "crew",
            "to see my posted payout",
            "I trust My Pay over any estimate",
            [
                "My Pay totals the latest posted run for me",
                "Owner account does not use My Pay (uses Payroll instead)",
            ],
        ),
    ),
)}
{section(
    "Late, absent, cash advance, detailer",
    None,
    join_stories(
        story(
            "Owner",
            "late crew paid for the remaining shift",
            "a 9:00 clock-in on an 8:00–16:00 shift earns about 7/8, not a flat penalty that ignores the clock",
            [
                "On-time present = full share",
                "60 minutes late on an 8-hour shift → 0.875 weight",
                "Late without a clock still falls back to a flat late weight",
                "Pesos split cleanly with no leftover centavos drifting",
            ],
        ),
        story(
            "Team Lead",
            "absent crew off the board and off the pool",
            "they get no wash share, no car, and no detailing commission",
            [
                "Absent cannot be assigned a car",
                "Absent weight is zero",
                "Assigned but absent detailer holds commission until fixed",
            ],
        ),
        story(
            "Owner",
            "approved cash advances deducted in the payroll wizard",
            "advances never inflate sales and never auto-strip pay",
            [
                "Only approved / accepted / paid advances deduct",
                "Pending drafts are ignored",
                "Preview does not auto-apply cash advances",
            ],
        ),
        story(
            "a detailer",
            "commission on every job I am assigned",
            "booking pipeline and walk-in checkout pay me the same way",
            [
                "Assigned person is paid on booking and walk-in",
                "Commission stays on that job’s branch",
                "Detailers are not in the wash pool",
            ],
        ),
        story(
            "Owner",
            "each branch-day settled on its own sales",
            "Bacoor wash never funds Imus coating books",
            [
                "Wash pool keyed by branch and day",
                "Pending floor is one row per accepted branch-day",
                "Posted floor covers only that branch-day",
                "Books roll up per branch — not a merged fiction",
            ],
        ),
    ),
)}
{section(
    "Finance books",
    None,
    join_stories(
        story(
            "Owner, assistant, or Investor",
            "branch- and date-scoped books",
            "net profit reflects paid sales and posted expenses",
            [
                "Loads sales summary, profit & loss, and expenses",
                "No profile → no accidental all-branch data",
                "Load failure shows a clear retry message",
                "Reports live under Finance (old reports link redirects)",
            ],
        ),
        story(
            "Investor",
            "Finance only",
            "I see performance without floor or people tools",
            [
                "Home opens Finance",
                "Navigation is Finance only",
                "Queue, checkout, and people are denied",
            ],
        ),
    ),
)}
""",
)

# --- Night close ---
add_tab(
    "close",
    "Night close",
    f"""
<p class="tab-intro">How the night handoff works — Branch Admin closes, leadership accepts, then floor pay.</p>
{section(
    "Branch Admin submits",
    None,
    join_stories(
        story(
            "Branch Admin",
            "to submit end of shift when the day had activity",
            "cash / GCash / card are attested against what POS sold",
            [
                "Close only when sales, expenses, or cash advances exist",
                "Total sales = paid POS only",
                "Carwash salary preview = wash pool only",
                "Override reason required when numbers differ from baseline",
            ],
        )
    ),
)}
{section(
    "Finance accepts",
    None,
    join_stories(
        story(
            "Owner or assistant",
            "to accept or reject the night report",
            "only trusted days unlock pending floor pay",
            [
                "Accept notifies payroll confirmers",
                "Reject sends the branch back to fix and resubmit",
                "Books still follow paid sales",
            ],
        )
    ),
)}
{section(
    "Confirm floor pay",
    None,
    join_stories(
        story(
            "Owner or assistant with finance rights",
            "to confirm floor payroll from the accepted day",
            "staff are paid from the same numbers Finance trusted",
            [
                "Hard gate can block confirm until Finance accepts",
                "Pending list shows attested vs POS sold",
                "Day marked paid after confirm",
            ],
        )
    ),
)}
""",
)


def role_tab(
    id_: str,
    label: str,
    intro: str,
    opens: str,
    pages: list[str],
    never: list[str],
    stories_html: str,
) -> None:
    add_tab(
        id_,
        label,
        f"""
<p class="tab-intro">{e(intro)}</p>
{role_card(opens, pages, never)}
{section("Stories", None, stories_html)}
""",
    )


role_tab(
    "role-owner",
    "Owner",
    "Super Admin — full company control.",
    "Console",
    [
        "Console",
        "People",
        "Payroll",
        "Finance",
        "Data Center",
        "Settings",
        "Audit",
        "Memberships",
        "KPI",
        "History",
    ],
    ["Floor clock", "My Pay (use Payroll instead)"],
    join_stories(
        story(
            "Owner",
            "Console home and full company tools",
            "People, Payroll, Finance, and Data Center stay under one owner",
            [
                "Opens Console first",
                "Can run Payroll and Finance",
                "Does not use the floor clock or My Pay",
            ],
        ),
        story(
            "Owner",
            "to hire and edit staff",
            "roles, branches, and clock toggles match the floor",
            [
                "Directory and edit form",
                "Temporary password support",
                "Assistant grants editor",
            ],
        ),
        story(
            "Owner",
            "memberships, settings, and audit",
            "loyalty, POS rules, and checkout actions stay controlled",
            [
                "Memberships kill-switch",
                "Separate POS and Payroll settings modules",
                "Audit trail",
            ],
        ),
    ),
)

role_tab(
    "role-asa",
    "Assistant",
    "Assistant Super Admin — same tools, limited by grants you set.",
    "Console",
    ["Console", "Granted Finance / CRM / Content / People tools", "My Pay"],
    ["Tools you turned off in grants"],
    join_stories(
        story(
            "Assistant Super Admin",
            "Console home with grant-scoped tools",
            "the owner can turn Finance write, CRM, or Content on or off",
            [
                "Opens Console first",
                "Denied grants actually block those tools",
                "Can use My Pay (unlike Owner)",
            ],
        ),
        story(
            "Assistant Super Admin",
            "to help accept closes and confirm floor pay when granted",
            "the owner is not the only person who can finish the night",
            [
                "Finance write grant required for accept / confirm",
                "No grant → those actions stay blocked",
            ],
        ),
    ),
)

role_tab(
    "role-ba",
    "Branch Admin",
    "One bay’s money day — checkout, close, attendance, planner.",
    "Checkout / POS",
    [
        "POS / Checkout",
        "Queue",
        "Attendance",
        "Planner",
        "Ops Lab (view)",
        "History",
        "My Pay",
        "Audit",
        "Reviews",
    ],
    [
        "Finance books",
        "CRM",
        "People",
        "Console",
        "Payroll register",
        "Inventory",
        "Bookings board",
    ],
    join_stories(
        story(
            "Branch Admin",
            "only the bay tools I need",
            "Command never links a page I cannot open",
            [
                "Opens checkout first",
                "Allowed: floor, queue, attendance, POS, reviews, planner, Ops Lab, history, My Pay, audit",
                "Denied: finance, CRM, people, console, payroll register, inventory, bookings board",
            ],
        ),
        story(
            "Branch Admin",
            "to take payment for queue tickets and walk-ins",
            "paid checkout is the single truth for that day’s revenue",
            [
                "Cash, GCash, card",
                "Catalog link required on service lines",
                "Cash advances show on close, not as fake sales",
            ],
        ),
        story(
            "Branch Admin",
            "to submit end of shift when the day had activity",
            "cash / GCash / card are attested against what POS sold",
            [
                "One open close per branch per day",
                "Override reason when numbers differ",
            ],
        ),
    ),
)

role_tab(
    "role-tl",
    "Team Lead",
    "Bay leadership — wash queue, attendance honesty, KPI glance.",
    "Wash queue",
    [
        "Wash queue",
        "Attendance",
        "KPI (glance)",
        "My Tasks",
        "My Pay",
        "History",
        "Reviews",
    ],
    ["POS checkout as primary", "Finance", "People", "Payroll register"],
    join_stories(
        story(
            "Team Lead",
            "wash queue control without finance pay tools",
            "same-day wash moves cleanly",
            [
                "Opens wash queue first",
                "Can create tickets; detailing stays elsewhere",
                "Absent crew off the assign list",
                "Can mark Failed QA; Sales cannot",
                "No POS / Finance / People",
            ],
        ),
        story(
            "Team Lead",
            "absent crew off the board and off the pool",
            "they get no wash share, no car, and no detailing commission",
            ["Absent cannot be assigned a car", "Absent weight is zero"],
        ),
    ),
)

role_tab(
    "role-crew",
    "Crew",
    "Floor washers — clock in, do bay work, see posted pay.",
    "Attendance",
    ["Attendance", "My Tasks", "My Pay", "Notifications"],
    ["POS admin", "Finance", "People", "Payroll register"],
    join_stories(
        story(
            "crew",
            "attendance as my home",
            "clock-in is the first action of the day",
            [
                "Opens Attendance",
                "My Tasks and My Pay for posted work",
                "Late or absent changes wash-pool share honestly",
            ],
        ),
        story(
            "crew",
            "to see my posted payout",
            "I trust My Pay over any estimate",
            ["My Pay totals the latest posted run for me"],
        ),
    ),
)

role_tab(
    "role-ops",
    "Ops Lead",
    "Operations Lead — network help across branches without owning payroll.",
    "Ops Lab roadmap",
    [
        "Ops Lab",
        "Queue (network)",
        "POS help",
        "Attendance register (view)",
        "Planner",
        "My Pay",
    ],
    ["Floor clock", "Payroll register", "People", "Data Center"],
    join_stories(
        story(
            "Operations Lead",
            "Ops Lab as home and network-wide floor help",
            "I cover Team Lead and Branch Admin work across branches without owning payroll",
            [
                "Opens Ops Lab roadmap",
                "Can use queue and POS across branches",
                "Can see the attendance register but cannot floor-clock",
                "Has My Pay; no payroll register",
                "No People or Data Center",
            ],
        )
    ),
)

role_tab(
    "role-sales",
    "Sales",
    "Detailing pipeline across branches.",
    "Detailing bookings",
    ["Bookings", "Planner", "History", "Notifications", "My Pay"],
    ["Wash queue as home", "Payroll register", "People"],
    join_stories(
        story(
            "Sales",
            "home on detailing bookings for all branches",
            "I do not land on the wash queue",
            ["Opens Bookings", "All-branch pipeline access"],
        ),
        story(
            "Sales",
            "to run the detailing pipeline and assign a detailer",
            "coating and other detailing jobs are tracked separately from same-day wash",
            [
                "Statuses from assigned through completed",
                "Paid detailing lands in the right sales bucket",
            ],
        ),
    ),
)

role_tab(
    "role-detailer",
    "Detailer",
    "Assigned detailing jobs and commission.",
    "Detailing bookings",
    ["Bookings (assigned)", "Attendance", "My Tasks", "My Pay"],
    ["Wash pool share", "Finance", "People", "Payroll register"],
    join_stories(
        story(
            "a detailer",
            "Bookings + Attendance + My Tasks + My Pay",
            "I work assigned jobs and see posted commission",
            [
                "Opens Bookings",
                "Assigned jobs pay on booking and walk-in",
                "Not in the wash pool",
            ],
        ),
        story(
            "a detailer",
            "commission on every job I am assigned",
            "booking pipeline and walk-in checkout pay me the same way",
            ["Commission stays on that job’s branch"],
        ),
    ),
)

role_tab(
    "role-mkt",
    "Marketing",
    "Demand and customers — not payroll.",
    "Customer list (CRM)",
    ["CRM", "Content", "Bookings (as allowed)", "Notifications", "History"],
    ["Payroll", "Finance accept", "People admin"],
    join_stories(
        story(
            "Marketing",
            "CRM, content, bookings, and alerts — not payroll",
            "I run demand without touching pay",
            ["Opens customer list", "Content and notifications when allowed"],
        ),
        story(
            "Marketing or Owner",
            "content and broadcast",
            "public site blocks and blasts stay role-gated",
            ["Content and broadcast under the right permissions"],
        ),
    ),
)

role_tab(
    "role-video",
    "Video Editor",
    "Shoot and edit work on the planner — no floor noise.",
    "Planner calendar",
    ["Planner calendar", "My Tasks", "My Pay"],
    ["Queue", "POS", "Finance", "CRM", "Bookings", "People"],
    join_stories(
        story(
            "a video editor",
            "Planner calendar and My Tasks as my dock",
            "shoot and edit work is scheduled without queue noise",
            [
                "Opens Planner calendar first",
                "Dock: Calendar + Tasks; Pay in overflow",
                "Denied: queue, POS, Finance, CRM, Bookings, People",
            ],
        )
    ),
)

role_tab(
    "role-inv",
    "Investor",
    "Read books only — performance without floor tools.",
    "Finance",
    ["Finance (sales, P&L, expenses)"],
    ["Queue", "Checkout", "People", "Payroll", "Attendance clock"],
    join_stories(
        story(
            "Investor",
            "Finance only",
            "I see performance without floor or people tools",
            [
                "Home opens Finance",
                "Navigation is Finance only",
                "Queue, checkout, and people are denied",
            ],
        ),
        story(
            "Owner, assistant, or Investor",
            "branch- and date-scoped books",
            "net profit reflects paid sales and posted expenses",
            [
                "Sales summary, profit & loss, and expenses",
                "Load failure shows a clear retry message",
            ],
        ),
    ),
)

role_tab(
    "role-customer",
    "Customer",
    "Public account and lobby guest — never staff tools.",
    "My account",
    [
        "Account home",
        "Garage / cars",
        "Past visits",
        "Queue status",
        "Public queue board (guest)",
    ],
    ["Staff payroll", "People", "Finance", "POS"],
    join_stories(
        story(
            "a customer",
            "phone sign-in that keeps one account",
            "visit history stays together",
            [
                "Wizard: phone → name/plate → birthday → password",
                "Garage and past visits",
            ],
        ),
        story(
            "a guest in the lobby",
            "public queue status by branch",
            "I see progress without logging in",
            ["Public queue board shows only safe info"],
        ),
        story(
            "a customer",
            "My account as home",
            "I never open staff payroll or people tools",
            ["Account tabs only", "Staff tools denied"],
        ),
    ),
)

# --- All pages ---
add_tab(
    "pages",
    "All pages",
    f"""
<p class="tab-intro">Every major page — what it is for, in plain language.</p>
{section(
    "Money & leadership pages",
    None,
    join_stories(
        story(
            "Owner / Assistant / Investor",
            "Finance",
            "I can accept closes, read books, and see money health",
            ["Shift close review", "Sales / P&L / expenses", "Investor is Finance-only"],
        ),
        story(
            "Owner / Assistant",
            "Payroll",
            "I confirm floor pay and monthly salaries",
            ["Floor wizard and fixed wizard stay separate"],
        ),
        story(
            "Team Lead / leadership",
            "KPI glance",
            "bay volume is visible without full Finance P&L",
            ["KPI in Team Lead more menu"],
        ),
        story(
            "Sales, Marketing, Team Lead, or Branch Admin",
            "visit History",
            "I can look up past visits without opening the full CRM",
            ["History on the right docks"],
        ),
        story(
            "Branch Admin or Owner",
            "Audit",
            "checkout actions are reviewable",
            ["Audit on Branch Admin allow list"],
        ),
    ),
)}
{section(
    "Floor pages",
    None,
    join_stories(
        story(
            "Branch Admin",
            "POS / Checkout",
            "paid tickets are the day’s sales truth",
            ["Queue handoff + walk-ins", "Cash / GCash / card"],
        ),
        story(
            "Team Lead",
            "Wash queue",
            "same-day wash moves to checkout",
            ["Wash-only; detailing stays on Bookings"],
        ),
        story(
            "Sales / Detailer",
            "Bookings",
            "detailing jobs are assigned and completed",
            ["Pipeline statuses", "Assignee for commission"],
        ),
        story(
            "Branch Admin",
            "End of shift (inside POS / close flow)",
            "the night report can be accepted",
            ["Attest cash vs POS", "Wash pool preview only"],
        ),
    ),
)}
{section(
    "People & time",
    None,
    join_stories(
        story(
            "Owner or assistant with people rights",
            "People",
            "roles and branches match who can work",
            ["Directory, edit, temp password", "Assistant grants"],
        ),
        story(
            "crew / Team Lead / Branch Admin",
            "Attendance",
            "clock-in drives fair wash shares",
            [
                "Present / late / absent rules",
                "Ops Lead can view register but not floor-clock",
            ],
        ),
        story(
            "Branch Admin, Sales, Ops Lead, Video Editor",
            "Planner & My Tasks",
            "non-wash work is tracked with proof",
            ["Assign → proof → accept or send back"],
        ),
    ),
)}
{section(
    "Customers, stock, content, system",
    None,
    join_stories(
        story(
            "Owner, assistant, or Marketing",
            "CRM",
            "floor and sales share the same customers",
            ["Notes, history, retention filters"],
        ),
        story(
            "Owner or Team Lead",
            "Inventory / catalog",
            "bay services and detailing catalogs stay separate",
            ["Services & packages · Detailing · Merch"],
        ),
        story(
            "Owner",
            "Memberships",
            "stamps and tiers stay kill-switchable",
            ["Branch Admin denied by default"],
        ),
        story(
            "Sales, Marketing, or Owner / assistant",
            "Notifications / inquiries / reviews",
            "messages and public forms land in one hub",
            ["Route gated", "Failed QA is Team Lead / Owner — not Sales"],
        ),
        story(
            "Operations Lead / Owner",
            "Ops Lab, Console, Data Center",
            "ops coordination and imports stay in the right hands",
            ["Ops Lab for Ops Lead", "Data Center owner-only"],
        ),
        story(
            "Owner or assistant",
            "Settings",
            "POS and Payroll rules stay thin and clear",
            ["Separate modules under settings"],
        ),
        story(
            "Marketing or Owner",
            "Content",
            "public site blocks and blasts stay role-gated",
            ["Content and broadcast under the right permissions"],
        ),
        story(
            "any staff with My Pay",
            "My Pay",
            "I see posted payouts, not estimates",
            ["Owner uses Payroll instead of My Pay"],
        ),
    ),
)}
""",
)

today = datetime.now(ZoneInfo("Asia/Manila")).strftime("%B %d, %Y")
tab_buttons = "\n".join(
    f'<button type="button" class="tab-btn{" active" if i == 0 else ""}" data-tab="{t["id"]}" role="tab" aria-selected="{"true" if i == 0 else "false"}">{e(t["label"])}</button>'
    for i, t in enumerate(TABS)
)
tab_panels = "\n".join(
    f'<section class="tab-panel{" active" if i == 0 else ""}" id="panel-{t["id"]}" role="tabpanel" data-print-title="{e(t["label"])}">{t["body"]}</section>'
    for i, t in enumerate(TABS)
)

html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Hakum Ops — Owner user stories</title>
<style>
  :root {{
    --blue: #052699;
    --navy: #020a31;
    --ink: #0f172a;
    --muted: #64748b;
    --paper: #f7f8fb;
    --line: #e2e8f0;
    --ok: #15803d;
    --ok-bg: #f0fdf4;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font: 16px/1.6 "Segoe UI", system-ui, sans-serif;
    color: var(--ink);
    background:
      radial-gradient(900px 420px at 10% -10%, rgba(5,38,153,.12), transparent 60%),
      linear-gradient(180deg, #eef1f8 0%, var(--paper) 28%, #fff 100%);
  }}
  .wrap {{ max-width: 920px; margin: 0 auto; padding: 28px 20px 64px; }}
  header.hero {{
    padding: 28px 28px 24px;
    border-radius: 18px;
    color: #f1f1ed;
    background:
      radial-gradient(circle at 85% 15%, #2d59d3, transparent 42%),
      linear-gradient(145deg, #03156b 0%, var(--navy) 55%, #01061c 100%);
    box-shadow: 0 18px 40px rgba(2,10,49,.28);
  }}
  header.hero .eyebrow {{
    margin: 0 0 10px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .18em;
    text-transform: uppercase;
    opacity: .78;
  }}
  header.hero h1 {{
    margin: 0 0 8px;
    font-size: clamp(1.55rem, 3vw, 2.05rem);
    font-weight: 700;
    letter-spacing: -.02em;
  }}
  header.hero p {{ margin: 0; max-width: 58ch; opacity: .9; }}
  header.hero .meta {{
    display: flex; flex-wrap: wrap; gap: 10px 18px;
    margin-top: 18px; padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,.18);
    font-size: 12px; opacity: .82;
  }}
  .tabs {{
    display: flex; flex-wrap: wrap; gap: 8px;
    margin: 22px 0 0; padding: 10px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid var(--line);
    box-shadow: 0 8px 24px rgba(15,23,42,.04);
    position: sticky; top: 8px; z-index: 5;
  }}
  .tab-btn {{
    appearance: none; border: 0; cursor: pointer;
    padding: 10px 14px; border-radius: 999px;
    background: transparent; color: var(--muted);
    font: 700 12px/1 "Segoe UI", system-ui, sans-serif;
    letter-spacing: .04em; text-transform: uppercase;
  }}
  .tab-btn:hover {{ color: var(--blue); background: rgba(5,38,153,.06); }}
  .tab-btn.active {{ color: #fff; background: var(--blue); }}
  .tab-panel {{ display: none; margin-top: 22px; }}
  .tab-panel.active {{ display: block; }}
  .tab-intro {{
    margin: 0 0 18px; padding: 14px 16px;
    border-left: 3px solid var(--blue);
    background: #fff; border-radius: 0 10px 10px 0;
    color: var(--muted);
  }}
  .role-card {{
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin: 0 0 22px;
  }}
  .role-card > div {{
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px 16px;
  }}
  .role-card h3 {{
    margin: 0 0 8px;
    font-size: 11px;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--muted);
  }}
  .role-card p, .role-card li {{ margin: 0; font-size: 14px; }}
  .role-card ul {{ padding-left: 1.1rem; margin: 0; }}
  .block {{
    margin: 0 0 26px; padding: 22px 24px;
    background: #fff; border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 10px 28px rgba(15,23,42,.04);
  }}
  .block h2 {{ margin: 0 0 8px; font-size: 1.25rem; color: var(--navy); }}
  .lead {{ margin: 0 0 14px; color: var(--muted); }}
  .story {{
    margin: 14px 0 0; padding: 14px 16px;
    border-radius: 12px; background: var(--paper);
    border: 1px solid var(--line);
  }}
  .story .as, .story .want, .story .so {{ margin: 4px 0; }}
  ul.ac {{ list-style: none; padding: 8px 0 0; margin: 10px 0 0; }}
  ul.ac li {{
    display: flex; gap: 10px; align-items: flex-start;
    margin: 6px 0; padding: 8px 10px;
    border-radius: 8px; background: var(--ok-bg);
  }}
  ul.ac .box {{
    flex: 0 0 18px; height: 18px; margin-top: 2px;
    border-radius: 4px; border: 1.5px solid var(--ok);
    display: grid; place-items: center;
    font-size: 11px; font-weight: 800; color: var(--ok);
    background: #fff;
  }}
  .table-wrap {{ overflow: auto; margin: 12px 0 8px; border: 1px solid var(--line); border-radius: 10px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
  th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }}
  th {{ background: #f1f5f9; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }}
  footer {{
    margin-top: 36px; padding-top: 16px;
    border-top: 1px solid var(--line);
    font-size: 13px; color: var(--muted);
  }}
  ol, ul:not(.ac) {{ margin: .5em 0 .9em; padding-left: 1.25em; }}
  p {{ margin: .65em 0; }}
  @media (max-width: 800px) {{
    .role-card {{ grid-template-columns: 1fr; }}
  }}
  @media print {{
    body {{ background: #fff; }}
    .tabs {{ display: none !important; }}
    .tab-panel {{ display: block !important; break-before: page; }}
    .tab-panel:first-of-type {{ break-before: avoid; }}
    .tab-panel::before {{
      content: attr(data-print-title);
      display: block; margin: 0 0 16px;
      font-size: 20px; font-weight: 800; color: var(--navy);
    }}
    header.hero {{ box-shadow: none; }}
    .block, .story, .role-card > div {{ box-shadow: none; break-inside: avoid; }}
  }}
</style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="eyebrow">Hakum Auto Care · For the owner</p>
      <h1>How the shop runs — user stories</h1>
      <p>Plain-language stories for the full day: clock-in, wash, detailing, checkout, close, finance, payroll, every role, and every major page. No technical flowcharts.</p>
      <div class="meta">
        <span>{e(today)} · Asia/Manila</span>
        <span>{len(TABS)} tabs · stories only</span>
        <span>Share this PDF with leadership</span>
      </div>
    </header>

    <nav class="tabs" role="tablist" aria-label="Owner sections">
      {tab_buttons}
    </nav>

    {tab_panels}

    <footer>
      Hakum Ops owner pack · Stories only · Open the HTML for clickable tabs; the PDF prints every section in order.<br />
      Rebuild: <code>npm run generate:owner-stories</code>
    </footer>
  </div>
  <script>
    document.querySelectorAll('.tab-btn').forEach((btn) => {{
      btn.addEventListener('click', () => {{
        const id = btn.dataset.tab
        document.querySelectorAll('.tab-btn').forEach((b) => {{
          b.classList.toggle('active', b === btn)
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false')
        }})
        document.querySelectorAll('.tab-panel').forEach((p) => {{
          p.classList.toggle('active', p.id === 'panel-' + id)
        }})
        window.scrollTo({{ top: 0, behavior: 'smooth' }})
      }})
    }})
  </script>
</body>
</html>
"""

OUT_HTML.parent.mkdir(parents=True, exist_ok=True)
OUT_HTML.write_text(html_doc, encoding="utf-8")
print(f"Wrote {OUT_HTML} ({OUT_HTML.stat().st_size // 1024} KB)")
print(f"Tabs: {len(TABS)} -> {', '.join(t['label'] for t in TABS)}")
# Sanity: no mermaid / flowchart leftovers
assert "mermaid" not in html_doc.lower()
assert "flowchart TB" not in html_doc and "flowchart LR" not in html_doc
print("OK: no mermaid diagrams")
