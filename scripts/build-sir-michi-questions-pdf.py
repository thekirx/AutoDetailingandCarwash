"""Plain-language questions for Sir Michi. Run: python scripts/build-sir-michi-questions-pdf.py"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

OUT = Path(__file__).resolve().parents[1] / "docs" / "plans" / "2026-10-20-sir-michi-questions.pdf"


def main():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="CoverTitle", fontName="Helvetica-Bold", fontSize=18, leading=22,
        alignment=TA_CENTER, textColor=colors.HexColor("#0f172a"), spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="CoverSub", fontName="Helvetica", fontSize=10, leading=13,
        alignment=TA_CENTER, textColor=colors.HexColor("#475569"), spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        name="H", fontName="Helvetica-Bold", fontSize=12, leading=15,
        textColor=colors.HexColor("#0f172a"), spaceBefore=8, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="Body", fontName="Helvetica", fontSize=10, leading=14,
        textColor=colors.HexColor("#1e293b"), spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="Q", fontName="Helvetica-Bold", fontSize=11, leading=14,
        textColor=colors.HexColor("#0f172a"), spaceBefore=8, spaceAfter=3,
    ))

    story = []
    story.append(Paragraph("Questions for Sir Michi", styles["CoverTitle"]))
    story.append(Paragraph("Daily sheet money. 20 October 2026. Shop language.", styles["CoverSub"]))
    story.append(HRFlowable(width="100%", thickness=0.4, color=colors.HexColor("#cbd5e1"), spaceAfter=8))

    story.append(Paragraph("What this note is", styles["H"]))
    story.append(Paragraph(
        "The daily sheet is already counting the way your formula describes. "
        "Five points below can change the money if you want them counted differently. "
        "Please answer only those five. The job list after them is so you can see what we already set. "
        "It is not a question.",
        styles["Body"],
    ))

    questions = [
        (
            "1. Card, debit card, and bank transfer",
            "A sale paid by credit card, debit card, or bank transfer is still a sale. It is inside Total sales. "
            "It does not go into Cash left, because that money is not in the cash drawer. "
            "It does not go into GCash left, because it is not in the GCash wallet. "
            "Cash left is only cash. GCash left is only GCash. "
            "Is that what you want?",
        ),
        (
            "2. The morning float",
            "Cash left is only what moved today: cash sales, cash paid back on advances, minus cash expenses, cash salaries, and cash advances given out. "
            "The bills you put in the drawer at the start of the day are the opening float. They are not inside Cash left. "
            "The sheet also shows Expected cash. That is the float plus Cash left. That is the amount the count should match. "
            "Over or short is the counted cash minus Expected cash. "
            "Do you want both numbers: Cash left, and Expected cash?",
        ),
        (
            "3. Cash advance given out",
            "When the branch gives a staff member a cash advance, that money leaves the drawer. "
            "Your note says this is deducted from the money left, and it is not an expense. "
            "The written sum did not show the minus. The sheet does subtract it, and it does not treat it as an expense, so it does not reduce profit. "
            "When the staff member pays it back, that amount is added to Cash left or GCash left, matching how they paid. It is still not a sale and not an expense. "
            "Please confirm the sheet should keep deducting the advance that was given out.",
        ),
        (
            "4. Salary paid from GCash",
            "Crew pay is an expense. It reduces profit. It also reduces the wallet it was paid from. "
            "A salary marked Cash reduces the cash drawer. A salary marked GCash reduces GCash left and does not touch the cash drawer. "
            "The same rule is used for a normal expense: you choose Cash or GCash, and only that side goes down. "
            "Please confirm a GCash salary should reduce GCash left.",
        ),
        (
            "5. One way to pay on a ticket",
            "Each paid ticket is all cash, all GCash, all credit card, all debit card, or all bank transfer. "
            "The register cannot split one ticket into part cash and part GCash. "
            "If a customer pays both ways, the branch rings two tickets, or rings the whole ticket as one way. "
            "Is one way per ticket enough?",
        ),
    ]
    for title, body in questions:
        story.append(Paragraph(title, styles["Q"]))
        story.append(Paragraph(body, styles["Body"]))

    story.append(Paragraph("Already set. No answer needed.", styles["H"]))
    story.append(Paragraph(
        "Same-day work stays on today's wash queue: the car wash, Express Wash, Full Care, custom wash packages, "
        "and add-ons such as engine wash. Interior detailing, full exterior detailing, mobile detailing, and glass detailing "
        "are same-day jobs too. Their sales sit with car wash sales.",
        styles["Body"],
    ))
    story.append(Paragraph(
        "Longer jobs sit on the detailing list: ceramic coating (including Premium and Platinum), nano ceramic tint, "
        "paint protection film and its levels, and paint maintenance. "
        "Premium and Platinum are levels of the ceramic job. They are not wash packages. "
        "The sheet still prints ceramic, tint, film, and paint maintenance as separate sales numbers. "
        "Coffee, drinks, and accessories stay off those numbers.",
        styles["Body"],
    ))
    story.append(Paragraph(
        "Paint maintenance is the return visit after a ceramic coating or a film install. The reminder is about six months. "
        "Doing the visit starts the clock again.",
        styles["Body"],
    ))
    story.append(Paragraph(
        "Film installs are detailing jobs on that list. Crew pay for a film job is not the ceramic crew split. "
        "We did not invent a separate film pay number.",
        styles["Body"],
    ))
    story.append(Paragraph(
        "The friend discount is whatever you save in Settings. Points stay one price for the whole company. "
        "There is no daily text to the owner when the day closes. Finance approval uses the app notification.",
        styles["Body"],
    ))
    story.append(Paragraph(
        "A debit or bank-transfer sale has not been rung at the register yet. The buttons are on the live payment list. "
        "Older sales are only cash, GCash, and credit card.",
        styles["Body"],
    ))

    doc = SimpleDocTemplate(
        str(OUT), pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm, bottomMargin=14 * mm,
        title="Questions for Sir Michi", author="Hakum Auto Care",
    )
    doc.build(story)
    print(OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
