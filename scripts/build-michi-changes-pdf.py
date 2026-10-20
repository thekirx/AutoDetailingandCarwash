"""One-shot: Sir Michi changes + live routes PDF. Run: python scripts/build-michi-changes-pdf.py"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BASE = "https://auto-detailingand-carwash.vercel.app"
OUT = Path(__file__).resolve().parents[1] / "docs" / "plans" / "2026-10-19-michi-changes-routes-report.pdf"


def main():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            spaceAfter=6,
            textColor=colors.HexColor("#0f172a"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            spaceBefore=12,
            spaceAfter=7,
            textColor=colors.HexColor("#0f172a"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            spaceAfter=4,
            textColor=colors.HexColor("#334155"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Cell",
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0f172a"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="CellBold",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0f172a"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Link",
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor("#052699"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Warn",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#9f1239"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Footer",
            fontName="Helvetica",
            fontSize=7,
            textColor=colors.HexColor("#94a3b8"),
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Hdr",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
        )
    )

    def link_p(path: str):
        full = f"{BASE}{path}"
        return Paragraph(f'<link href="{full}"><font color="#052699">{path}</font></link>', styles["Link"])

    def cell(text: str, bold: bool = False):
        return Paragraph(str(text), styles["CellBold"] if bold else styles["Cell"])

    def make_table(headers, rows, col_widths):
        data = [[Paragraph(h, styles["Hdr"]) for h in headers]]
        data.extend(rows)
        t = Table(data, colWidths=col_widths, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ]
            )
        )
        return t

    W = A4[0] - 36 * mm
    story = []

    story.append(Spacer(1, 22 * mm))
    story.append(Paragraph("Hakum Auto Care", styles["CoverTitle"]))
    story.append(Paragraph("Sir Michi notes — changes &amp; live routes", styles["CoverTitle"]))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Report date: 19 October 2026", styles["CoverSub"]))
    story.append(
        Paragraph(
            f'Live app: <link href="{BASE}/"><font color="#052699">{BASE}/</font></link>',
            styles["CoverSub"],
        )
    )
    story.append(
        Paragraph("Source: docs/plans/2026-10-18-michi-notes-checklist.md", styles["CoverSub"])
    )
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#052699")))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("STRICT READINESS", styles["Warn"]))
    story.append(
        Paragraph(
            "Checklist sections B and C are wired in the frontend and backend for trained staff. "
            "This is <b>not</b> soft-launch closed: BusyBee / BrandTxt IP allowlist and Auth SMTP "
            "still need host proof, and a full staff role FLOPS / money-path click-through was not "
            "re-run this pass. Section E stays Sir-gated (friend discount number, per-branch point "
            "prices, owner daily SMS — policy: no).",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Open any route link below. /operations/* needs the matching staff login. "
            "Public and /account routes work from the live site for customers.",
            styles["Body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("1. Public &amp; customer routes", styles["H1"]))
    story.append(Paragraph(f"Base: {BASE}", styles["Small"]))
    public_rows = [
        [cell("Home"), link_p("/"), cell("Public landing")],
        [cell("Tint Finder (C25)"), link_p("/tint-finder"), cell("Title from Settings → Tint Finder")],
        [cell("Book"), link_p("/book"), cell("Public booking")],
        [cell("Live queue"), link_p("/queue"), cell("Customer count board")],
        [cell("Customer sign-in"), link_p("/signin"), cell("Customer portal entry")],
        [cell("Account home"), link_p("/account"), cell("Thumbs up → Google; rate card 15 min (C20)")],
        [cell("My vouchers (C17)"), link_p("/account/vouchers"), cell("Active rules + history")],
        [cell("Loyalty / stamps"), link_p("/account/loyalty"), cell("Memberships numbers Sir sets")],
        [cell("Friend referral"), link_p("/account/referral"), cell("Friend code; % from Settings (C21)")],
        [cell("Visit progress"), link_p("/account/visit"), cell("Active visit steps")],
    ]
    story.append(make_table(["Screen", "Route", "What changed / note"], public_rows, [W * 0.22, W * 0.28, W * 0.50]))

    story.append(Paragraph("2. Operations — floor &amp; money (sign-in required)", styles["H1"]))
    story.append(Paragraph("Prefix paths with the live base URL above.", styles["Small"]))
    ops_floor = [
        [cell("Carwash queue (B12)"), link_p("/operations/queue"), cell("Birthday cue after TL starts car — code not on card")],
        [cell("Detailing board (C4)"), link_p("/operations/bookings"), cell("List tab removed; Board / Table / Calendar / Maintenance")],
        [cell("Team Planner"), link_p("/operations/planning"), cell("Forms, CA approve, form-linked tasks, role categories (B5–B9, C9, C13)")],
        [cell("Planner → Forms"), link_p("/operations/planning?tab=forms"), cell("Feedback / complaints, cash advance, equipment repair")],
        [cell("Point of Sales"), link_p("/operations/pos"), cell("Birthday code; S/M/L/XL; merch size prices (B14, C5, C24)")],
        [cell("Daily Sheet"), link_p("/operations/pos?tab=sheet"), cell("CA code release; Paid from Cash|GCash; expected cash = cash-paid only (B8, C2)")],
        [cell("Vouchers (B16)"), link_p("/operations/vouchers"), cell("SA/ASA promo vouchers board")],
        [cell("Financials"), link_p("/operations/finance"), cell("Categories; GCash expenses still in P&amp;L")],
        [cell("Monthly payroll (C6)"), link_p("/operations/monthly-payroll"), cell("SA/ASA salary_monthly; day pay on Daily Sheet")],
        [cell("Inventory"), link_p("/operations/inventory"), cell("Branch on-hand; SA lock; sellable sizes (C7, C8, C24)")],
        [cell("My advances (C1)"), link_p("/operations/my-advances"), cell("Own cash-advance status list")],
    ]
    story.append(make_table(["Screen", "Route", "What changed / note"], ops_floor, [W * 0.24, W * 0.30, W * 0.46]))

    story.append(PageBreak())
    story.append(Paragraph("3. People, HR, CRM, settings", styles["H1"]))
    ops_admin = [
        [cell("People (C23)"), link_p("/operations/people"), cell("Sheet names: Owner/Super Admin, General Admin, Branch Admin, Customer Rep")],
        [cell("Attendance"), link_p("/operations/attendance"), cell("Day card salaries / car / failed QA; staff birthdays (B1–B4, B10–B11)")],
        [cell("CRM / customers"), link_p("/operations/crm"), cell("Profile: points, vouchers, notes, birthday; author · date (C14, C19)")],
        [cell("Month KPI (B17)"), link_p("/operations/kpi"), cell("Ops Lead nav; SA deep-link only")],
        [cell("Audit (B19)"), link_p("/operations/audit"), cell("Under Operations Insight")],
        [cell("Settings hub"), link_p("/operations/settings"), cell("Account: staff birthday + phone (B10, C12)")],
        [cell("Tint Finder settings"), link_p("/operations/settings/tint-finder"), cell("Page title field (C25)")],
        [cell("Daily sheet rules"), link_p("/operations/settings/daily-sheet"), cell("Wash pool % + detailing splits (C3)")],
        [cell("POS / referral"), link_p("/operations/settings/pos"), cell("Friend referral card (C21)")],
        [cell("Memberships"), link_p("/operations/memberships"), cell("Points / free rewards / visit rules — Sir types numbers")],
        [cell("Ops login"), link_p("/operations/login"), cell("Staff sign-in")],
    ]
    story.append(make_table(["Screen", "Route", "What changed / note"], ops_admin, [W * 0.26, W * 0.32, W * 0.42]))

    story.append(Paragraph("4. Checklist B — 18 Oct evening (all Done)", styles["H1"]))
    b_items = [
        ("B1–B4", "Crew Attendance day card: sheet salaries, clock, current car, failed QA", "/operations/attendance"),
        ("B5–B6", "Thumbs down → Feedback form → Planner Forms; Reviews menu removed", "/operations/planning?tab=forms"),
        ("B7–B8", "Cash advance approve → CA code → Daily Sheet Given out", "/operations/pos?tab=sheet"),
        ("B9", "Equipment repair: staff submit; results on Planner Forms", "/operations/planning?tab=forms"),
        ("B10–B11", "Staff birthday save + Attendance birthdays this month", "/operations/attendance"),
        ("B12–B15", "Birthday queue cue + BD code; POS claims once/year", "/operations/queue"),
        ("B16", "Promo voucher board SA/ASA; TL applies; POS consumes", "/operations/vouchers"),
        ("B17–B20", "Nav groups; Month KPI; Vouchers under Floor Insight", "/operations/kpi"),
    ]
    story.append(
        make_table(
            ["ID", "Change", "Primary route"],
            [[cell(a), cell(b), link_p(c)] for a, b, c in b_items],
            [W * 0.12, W * 0.55, W * 0.33],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("5. Checklist C — earlier notes (all Done)", styles["H1"]))
    c_items = [
        ("C1", "My advances list", "/operations/my-advances"),
        ("C2", "Expense Paid from Cash|GCash; expected drawer cash = cash-paid only", "/operations/pos?tab=sheet"),
        ("C4", "Detailing List tab removed", "/operations/bookings"),
        ("C5", "POS service sizes S/M/L/XL", "/operations/pos"),
        ("C6", "Monthly payroll page", "/operations/monthly-payroll"),
        ("C7–C8", "Inventory branch on-hand + SA lock", "/operations/inventory"),
        ("C9", "Planner task ↔ form link", "/operations/planning"),
        ("C11", "Crew planner = Forms + Tasks only", "/operations/planning"),
        ("C13", "Planner category visible_roles", "/operations/planning?tab=configure"),
        ("C16–C18", "Promo vouchers rules + TL apply", "/operations/vouchers"),
        ("C17", "Customer vouchers portal", "/account/vouchers"),
        ("C19", "CRM customer file (vouchers tab)", "/operations/crm"),
        ("C20", "Rate visit delay 15m + SMS reminder", "/account"),
        ("C21", "Friend referral % &amp; points editable", "/operations/settings/pos"),
        ("C23", "RBAC sheet + People labels + write locks", "/operations/people"),
        ("C24", "Sellable product sizes (named + priced)", "/operations/inventory"),
        ("C25", "Tint Finder page title setting", "/operations/settings/tint-finder"),
    ]
    story.append(
        make_table(
            ["ID", "Change", "Primary route"],
            [[cell(a), cell(b), link_p(c)] for a, b, c in c_items],
            [W * 0.10, W * 0.55, W * 0.35],
        )
    )

    story.append(Paragraph("6. Who can open what (short)", styles["H1"]))
    story.append(
        Paragraph(
            "Owner / Super Admin (BossMich): full, including Floor Board. "
            "General Admin (Assistant Super Admin): no Floor Board. "
            "Team Lead / Branch Admin / Marketing / Customer Rep: planner without Cash Advance board. "
            "Branch Admin: queue + detailing read-only; POS / finance / HR / customers on. "
            "Marketing: all-branches, read-only queue/detailing/customers, no HR. "
            "Customer Rep (sales): all-branches, detailing read-only, CRM create/modify — not Finance reports. "
            "Investor: read-only queue, detailing, POS, vouchers, finance. "
            "Crew: crew dock (Attendance, Planner Forms+Tasks, My advances).",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            f'People UI: <link href="{BASE}/operations/people"><font color="#052699">/operations/people</font></link> '
            "· Full matrix in repo docs/OPS/RBAC-MATRIX.md",
            styles["Body"],
        )
    )

    story.append(Paragraph("7. Still open / intentional limits (honest)", styles["H1"]))
    gaps = [
        ["Soft-launch ready", "No — BusyBee IP + Auth SMTP + full FLOPS click still open"],
        ["Sellable stock per size", "Shipped — product_branch_stock.size_key; apply migration 20261019220000 on live"],
        ["Cash Advance board hide", "Shipped — plan_boards.visible_roles + Configure allowlist; migration 20261019221000"],
        ["Staff birthday push/inbox", "Shipped — inbox + web push on birthday cron; no SMS"],
        ["Owner daily SMS", "Out of scope (policy: no)"],
        ["Friend discount / per-branch points", "Sir-gated — Settings only; catalog-wide points"],
    ]
    story.append(
        make_table(
            ["Topic", "Status"],
            [[cell(a, bold=True), cell(b)] for a, b in gaps],
            [W * 0.32, W * 0.68],
        )
    )

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#cbd5e1")))
    story.append(
        Paragraph(
            f"Hakum Auto Care · Sir Michi changes report · {BASE}/ · Generated 19 Oct 2026",
            styles["Footer"],
        )
    )

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#94a3b8"))
        canvas.drawCentredString(A4[0] / 2, 12 * mm, f"Page {doc.page} · Hakum · Michi notes report · {BASE}")
        canvas.restoreState()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="Hakum — Sir Michi changes & live routes",
        author="Hakum Auto Care",
        subject="Checklist B/C changes with production routes",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUT)
    print(f"bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
