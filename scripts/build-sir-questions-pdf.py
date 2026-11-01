"""Plain-language questions for Sir Michi. Run: python scripts/build-sir-questions-pdf.py"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

OUT = Path(__file__).resolve().parents[1] / "docs" / "plans" / "2026-10-20-sir-michi-questions.pdf"


def main():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="H", fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=colors.HexColor("#14233a"), spaceAfter=4))
    styles.add(ParagraphStyle(name="Sub", fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#3d4d63"), spaceAfter=8))
    styles.add(ParagraphStyle(name="Sec", fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=colors.HexColor("#14233a"), spaceBefore=10, spaceAfter=4))
    styles.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#1c2430"), spaceAfter=6))
    styles.add(ParagraphStyle(name="Q", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=colors.HexColor("#14233a"), spaceBefore=8, spaceAfter=2))
    styles.add(ParagraphStyle(name="A", fontName="Helvetica", fontSize=10, leading=13.5, textColor=colors.HexColor("#1c2430"), leftIndent=8, spaceAfter=2))

    story = []
    story.append(Paragraph("Questions for Sir Michi", styles["H"]))
    story.append(Paragraph("Hakum daily sheet and what counts as detailing. 20 October 2026. Written in shop language.", styles["Sub"]))
    story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#d5dde8"), spaceAfter=8))

    story.append(Paragraph("How the shop already works", styles["Sec"]))
    story.append(Paragraph(
        "There are two kinds of jobs. Same-day work is a wash or a wash package. It lives on today's queue, and that queue starts over each morning. "
        "Detailing work takes longer than one bay visit. It lives on the detailing booking list: ceramic coating, nano ceramic tint, paint protection film (PPF), and paint maintenance.",
        styles["Body"]))
    story.append(Paragraph(
        "A package on the wash side is a bundle of same-day work, such as Express Wash or Full Care. Premium and Platinum under ceramic are not wash packages. They are levels of the ceramic job. "
        "The same idea applies to the PPF levels (Basic, High Impact, Platinum, Ultimate).",
        styles["Body"]))
    story.append(Paragraph(
        "Coffee, drinks, and accessories are extra things the branch can add at the counter. They are not car wash sales, and they are not ceramic, tint, or PPF sales.",
        styles["Body"]))

    story.append(Paragraph("Ceramic is already detailing", styles["Sec"]))
    story.append(Paragraph(
        "Yes. On the live catalog, Ceramic Coating is a detailing job. So are its Premium and Platinum levels, tint, PPF, and paint maintenance. "
        "They show on the detailing booking list and on the POS Detailing tab. They do not sit on the same-day wash queue.",
        styles["Body"]))
    story.append(Paragraph(
        "The daily sheet still prints Ceramic coating sales on its own line, and the same for tint and PPF. That matches your formula: those numbers must not be mixed with coffee or accessories, and they must not be one lump. "
        "We did not fold ceramic into a single Detailing total.",
        styles["Body"]))
    story.append(Paragraph(
        "Paint maintenance is the return visit after a ceramic coating or a PPF install. The reminder is about six months. Doing the maintenance visit resets that clock. "
        "Today the sheet puts paint maintenance inside the leftover row named Detailing, not on its own line.",
        styles["Body"]))
    story.append(Paragraph(
        "Crew pay for ceramic, tint, and paint maintenance follows the detailing pay rule. PPF was incorrectly included in that same pay because it is also marked detailing. "
        "That is corrected: PPF stays a detailing job on the board, and it is no longer treated as ceramic crew pay. Tell us if PPF installers should share that pay instead.",
        styles["Body"]))

    story.append(Paragraph("What feels off", styles["Sec"]))
    story.append(Paragraph(
        "Interior detailing, full exterior detailing, and glass detailing are same-day jobs. They are not on the multi-day detailing list. "
        "The daily sheet still calls them Detailing, only because the name contains the word detailing. Glass detailing is stored as a wash add-on.",
        styles["Body"]))
    story.append(Paragraph(
        "A draft expense can be saved before the category is chosen. The sheet will not submit, and the database will not accept the submit, until the category, the amount, and cash or GCash are filled in.",
        styles["Body"]))

    story.append(Paragraph("Please answer these", styles["Sec"]))
    questions = [
        ("1. Card, debit, and bank transfer",
         "These count in total sales. They do not go into Cash left or GCash left, because that money is not in the till or the GCash wallet. Is that what you want?"),
        ("2. Opening float",
         "Cash left is only today's movement. The float you put in the drawer in the morning is separate. Expected cash in the drawer is the float plus cash left. Do you want both numbers on the sheet?"),
        ("3. Cash advance given out",
         "Your sentence says a cash advance is deducted from the money left and is not an expense. Your written sum did not show that minus. The sheet deducts it. Please confirm."),
        ("4. Salary paid from GCash",
         "A salary marked GCash reduces GCash left. It does not reduce the cash drawer. Please confirm."),
        ("5. One way to pay per ticket",
         "A ticket is all cash, all GCash, all card, all debit, or all bank transfer. We cannot split one ticket into part cash and part GCash. Is one way enough?"),
        ("6. Keep ceramic, tint, and PPF as their own sales numbers",
         "They are detailing jobs, and the sheet still shows three separate totals. Please confirm we should keep them separate."),
        ("7. Paint maintenance",
         "Should paint maintenance have its own sales line, or stay inside the leftover Detailing number?"),
        ("8. Interior, exterior, and glass",
         "These are same-day jobs. Should their sales stay with car wash / same-day work, or stay under Detailing?"),
        ("9. PPF crew pay",
         "PPF is a detailing booking. Crew pay for it is no longer the ceramic split. Is PPF paid a different way? If yes, what is that way?"),
        ("10. Ceramic Premium and Platinum",
         "Those levels are counted as ceramic coating sales, not as a wash package and not as a separate service. Please confirm."),
    ]
    for title, body in questions:
        story.append(Paragraph(title, styles["Q"]))
        story.append(Paragraph(body, styles["A"]))

    story.append(Paragraph("Already decided. No need to answer again", styles["Sec"]))
    story.append(Paragraph(
        "The friend discount is whatever you save under Settings. Points stay one price for the whole company, not a different price per branch. "
        "There is no daily text message to the owner when the day closes. Finance approval uses the app notification.",
        styles["Body"]))
    story.append(Paragraph(
        "We have not stood at the register and taken a debit or bank-transfer sale yet. The buttons are on the live payment list. Old sales are only cash, GCash, and credit card.",
        styles["Body"]))

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="Questions for Sir Michi",
        author="Hakum Auto Care",
    )
    doc.build(story)
    print(OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
