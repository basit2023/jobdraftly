from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures" / "ai-extraction"
PDF_OUTPUT = ROOT / "output" / "pdf"
FIXTURES.mkdir(parents=True, exist_ok=True)
PDF_OUTPUT.mkdir(parents=True, exist_ok=True)

FONT_PATH = Path("C:/Windows/Fonts/arial.ttf")
FONT_BOLD_PATH = Path("C:/Windows/Fonts/arialbd.ttf")
font = ImageFont.truetype(str(FONT_PATH), 42)
small = ImageFont.truetype(str(FONT_PATH), 28)
bold = ImageFont.truetype(str(FONT_BOLD_PATH), 52)


def canvas_image() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (1600, 1100), "white")
    return image, ImageDraw.Draw(image)


def heading(draw: ImageDraw.ImageDraw, title: str, subtitle: str = "DEVELOPMENT QA FIXTURE - NOT A REAL VACANCY") -> None:
    draw.rectangle((0, 0, 1600, 155), fill="#0b1f3a")
    draw.text((70, 38), title, font=bold, fill="white")
    draw.text((70, 112), subtitle, font=small, fill="#bfdbfe")


def save_advertisement(name: str, title: str, lines: list[str], *, rtl: bool = False) -> None:
    image, draw = canvas_image()
    heading(draw, title)
    y = 230
    for line in lines:
        if any("\u0600" <= character <= "\u06ff" for character in line):
            line = get_display(arabic_reshaper.reshape(line))
        anchor = "ra" if rtl else "la"
        x = 1510 if rtl else 90
        draw.text((x, y), line, font=font, fill="#172033", anchor=anchor)
        y += 95
    image.save(FIXTURES / name, optimize=True)


save_advertisement(
    "urdu-advertisement.png",
    "URDU OCR TEST",
    [
        "صرف جانچ کے لیے - یہ حقیقی ملازمت نہیں۔",
        "عہدہ: اسسٹنٹ | محکمہ: معیار",
        "آسامیوں کی تعداد: 3 | تعلیم: بی اے",
        "مقام: پشاور | آخری تاریخ: 5 دسمبر 2026",
    ],
    rtl=True,
)

save_advertisement(
    "mixed-advertisement.png",
    "MIXED LANGUAGE OCR TEST",
    [
        "QA TEST ONLY - حقیقی ملازمت نہیں۔",
        "Position: Data Analyst | محکمہ تحقیق",
        "Vacancies: 1 | Education: BS Statistics",
        "مقام Islamabad | Apply by 10 December 2026",
    ],
)

newspaper, draw = canvas_image()
newspaper = Image.new("L", newspaper.size, 238)
draw = ImageDraw.Draw(newspaper)
draw.rectangle((35, 35, 1565, 1065), outline=25, width=5)
draw.text((800, 75), "THE QA DAILY - TEST EDITION", font=bold, fill=20, anchor="ma")
draw.line((70, 155, 1530, 155), fill=40, width=3)
draw.text((90, 210), "VACANCIES - NOT A REAL ADVERTISEMENT", font=font, fill=30)
left = ["Accounts Officer", "Test Finance Department", "BPS-16", "Education: B.Com"]
right = ["Age: 21-30", "Location: Quetta", "Domicile: Balochistan", "Open merit", "Closing: 15 December 2026"]
for index, line in enumerate(left):
    draw.text((90, 330 + index * 95), line, font=font, fill=35)
for index, line in enumerate(right):
    draw.text((850, 330 + index * 95), line, font=font, fill=35)
newspaper = newspaper.filter(ImageFilter.GaussianBlur(radius=0.7))
newspaper.save(FIXTURES / "newspaper-scan.png", optimize=True)

low, draw = canvas_image()
heading(draw, "LOW QUALITY OCR TEST")
for index, line in enumerate([
    "Junior Clerk - Test Administration",
    "5 vacancies | Intermediate",
    "Location: Multan",
    "Age, BPS, quota, deadline and URL are not supplied.",
]):
    draw.text((90, 250 + index * 110), line, font=font, fill="#334155")
low = low.resize((800, 550)).filter(ImageFilter.GaussianBlur(radius=2.2))
low = ImageEnhance.Contrast(low).enhance(0.55)
low.save(FIXTURES / "low-quality-advertisement.png", quality=38)

save_advertisement(
    "multiple-vacancies.png",
    "MULTIPLE VACANCIES TEST",
    [
        "Vacancy 1: Lab Technician | 2 posts | BSc | Faisalabad",
        "Vacancy 2: Office Assistant | 1 post | BA | Faisalabad",
        "Deadline for both test records: 22 December 2026",
    ],
)

save_advertisement(
    "deadline-corrigendum.png",
    "CORRIGENDUM TEST",
    [
        "Test Project Officer",
        "Previous deadline: 1 December 2026",
        "Extended deadline: 18 December 2026",
        "All other conditions remain unchanged.",
    ],
)

pdfmetrics.registerFont(TTFont("Arial", str(FONT_PATH)))
pdfmetrics.registerFont(TTFont("ArialBold", str(FONT_BOLD_PATH)))
pdf_path = PDF_OUTPUT / "jobdraftly-ai-evaluation-multi-page.pdf"
pdf = Canvas(str(pdf_path), pagesize=A4)
width, height = A4
for page, lines in enumerate([
    ["Lecturer", "Test University Department", "Vacancies: 4", "QA TEST ONLY - NOT A REAL VACANCY"],
    ["Education: MS relevant subject", "Experience: 2 years", "Location: Karachi", "Deadline: 20 December 2026"],
], start=1):
    pdf.setFillColor(HexColor("#0b1f3a"))
    pdf.rect(0, height - 110, width, 110, fill=1, stroke=0)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("ArialBold", 22)
    pdf.drawString(48, height - 65, f"MULTI-PAGE OCR TEST - PAGE {page}")
    pdf.setFillColor(HexColor("#172033"))
    pdf.setFont("Arial", 16)
    y = height - 175
    for line in lines:
        pdf.drawString(56, y, line)
        y -= 55
    pdf.setFont("Arial", 10)
    pdf.setFillColor(HexColor("#64748b"))
    pdf.drawString(56, 45, "JobDraftly development-only AI evaluation fixture")
    pdf.showPage()
pdf.save()

print(f"Generated AI evaluation assets in {FIXTURES}")
print(f"Generated PDF: {pdf_path}")
