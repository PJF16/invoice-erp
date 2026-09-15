from decimal import Decimal
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)


OUT = Path("output/pdf/Angebot_20250039_Puchas_Hotel_Kukmirn_GmbH.pdf")

NAVY = colors.HexColor("#142438")
TEAL = colors.HexColor("#1D7B76")
PALE = colors.HexColor("#EAF4F3")
LIGHT = colors.HexColor("#EEF1F4")
MID = colors.HexColor("#66717E")
TEXT = colors.HexColor("#18202A")
WHITE = colors.white


pdfmetrics.registerFont(TTFont("Arial", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Italic", "/System/Library/Fonts/Supplemental/Arial Italic.ttf"))


def eur(value: Decimal) -> str:
    raw = f"{value:,.2f}"
    return raw.replace(",", "X").replace(".", ",").replace("X", ".") + " EUR"


class OfferDoc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=32 * mm,
            bottomMargin=24 * mm,
            title="Angebot 20250039",
            author="Philipp Fritz IT Consulting",
            subject="Medien- und TV-Informationssystem fuer Puchas Hotel Kukmirn GmbH",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(PageTemplate(id="offer", frames=[frame], onPage=draw_page))


def draw_logo(c, x, y):
    c.saveState()
    c.setStrokeColor(NAVY)
    c.setLineWidth(4)
    c.rect(x, y, 17 * mm, 17 * mm, stroke=1, fill=0)
    c.setFillColor(TEAL)
    c.rect(x + 5.5 * mm, y + 7.1 * mm, 6 * mm, 2.8 * mm, stroke=0, fill=1)
    c.rect(x + 7.1 * mm, y + 5.5 * mm, 2.8 * mm, 6 * mm, stroke=0, fill=1)
    c.restoreState()


def draw_page(c, doc):
    w, h = A4
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, h - 5 * mm, w, 5 * mm, stroke=0, fill=1)
    draw_logo(c, 18 * mm, h - 25 * mm)
    c.setFont("Arial-Bold", 10.5)
    c.setFillColor(NAVY)
    c.drawRightString(w - 18 * mm, h - 14 * mm, "Philipp Fritz IT Consulting")
    c.setFont("Arial", 7.8)
    c.setFillColor(MID)
    c.drawRightString(w - 18 * mm, h - 19 * mm, "Gartenstrasse 49 | 7552 Stinatz | UID ATU74080978")
    c.drawRightString(w - 18 * mm, h - 23.5 * mm, "mail@philipp.consulting | +43 664 240 64 14 | www.philipp.consulting")

    c.setStrokeColor(colors.HexColor("#C9D1D9"))
    c.setLineWidth(0.5)
    c.line(18 * mm, 17 * mm, w - 18 * mm, 17 * mm)
    c.setFont("Arial", 7.5)
    c.setFillColor(MID)
    c.drawString(18 * mm, 11.5 * mm, "Angebot 20250039 | Puchas Hotel Kukmirn GmbH")
    c.drawRightString(w - 18 * mm, 11.5 * mm, f"Seite {doc.page}")
    c.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleCustom", fontName="Arial-Bold", fontSize=25, leading=29, textColor=NAVY, spaceAfter=5 * mm))
styles.add(ParagraphStyle(name="Kicker", fontName="Arial-Bold", fontSize=8, leading=10, textColor=TEAL, spaceAfter=2 * mm, tracking=1.1))
styles.add(ParagraphStyle(name="H1Custom", fontName="Arial-Bold", fontSize=15, leading=19, textColor=NAVY, spaceBefore=3 * mm, spaceAfter=3 * mm))
styles.add(ParagraphStyle(name="H2Custom", fontName="Arial-Bold", fontSize=10.5, leading=14, textColor=NAVY, spaceBefore=2 * mm, spaceAfter=1.5 * mm))
styles.add(ParagraphStyle(name="BodyCustom", fontName="Arial", fontSize=9.2, leading=13.4, textColor=TEXT, spaceAfter=2.3 * mm))
styles.add(ParagraphStyle(name="Small", fontName="Arial", fontSize=7.7, leading=10.7, textColor=MID))
styles.add(ParagraphStyle(name="SmallDark", fontName="Arial", fontSize=8.2, leading=11.5, textColor=TEXT))
styles.add(ParagraphStyle(name="SmallBold", fontName="Arial-Bold", fontSize=8.2, leading=11.5, textColor=NAVY))
styles.add(ParagraphStyle(name="Cell", fontName="Arial", fontSize=8.2, leading=11.5, textColor=TEXT))
styles.add(ParagraphStyle(name="CellTitle", fontName="Arial-Bold", fontSize=9, leading=12, textColor=NAVY, spaceAfter=1.5 * mm))
styles.add(ParagraphStyle(name="CellRight", fontName="Arial", fontSize=8.2, leading=11.5, textColor=TEXT, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="CellRightBold", fontName="Arial-Bold", fontSize=8.6, leading=11.5, textColor=NAVY, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="WhiteHead", fontName="Arial-Bold", fontSize=8.2, leading=10, textColor=WHITE))
styles.add(ParagraphStyle(name="WhiteHeadRight", fontName="Arial-Bold", fontSize=8.2, leading=10, textColor=WHITE, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="OptionTitle", fontName="Arial-Bold", fontSize=11.5, leading=14, textColor=TEAL))
styles.add(ParagraphStyle(name="Fine", fontName="Arial", fontSize=7.3, leading=10, textColor=MID))


def p(text, style="BodyCustom"):
    return Paragraph(text, styles[style])


positions = [
    ("01", "Projektierung &amp; Planung", "Technische Abstimmung mit der Haustechnik, Bedarfserhebung, Systemkonzept inklusive Netzplan und Signalfluss sowie Auswahl der geeigneten Hardware- und Kommunikationswege.", Decimal("4200.00")),
    ("02", "Serverhardware &amp; Systembereitstellung", "Leistungsstarker Medienserver in Industriequalitaet mit SSD-Speicher, redundanter Stromversorgung und Kuehlung; Betriebssystem, automatisierte Playlists, Zeitsteuerung, Spot-Wiederholung und zentrales Administrations-Backend.", Decimal("10800.00")),
    ("03", "Netzwerkinfrastruktur &amp; Signalverteilung", "Segmentiertes Mediennetzwerk; Managed Switches, Firewall/Router und erforderliche WLAN-Komponenten; Signalverteiler, HDMI-over-IP/IPTV-Komponenten sowie Integration in die vorhandene TV-Infrastruktur.", Decimal("12500.00")),
    ("04", "Technische Umsetzung", "Aufbau und Verkabelung der Komponenten, zentrale Inhalteverwaltung, automatische Neustartmechanismen, Fehlerprotokollierung, Remote-Updates und redundante Medienwiedergabe.", Decimal("7400.00")),
    ("05", "Test &amp; Inbetriebnahme", "Vollstaendige System- und Signalueberpruefung, Test der Ausspielung auf den angebundenen Endgeraeten sowie Uebernahme in den produktiven Betrieb.", Decimal("2200.00")),
    ("06", "Dokumentation &amp; Uebergabe", "Technische Gesamtdokumentation, Schulung des Hotelpersonals zur Inhalteverwaltung sowie Einweisung in Stoerungsbehebung und Supportwege.", Decimal("1800.00")),
]

net = sum(row[3] for row in positions)
vat = net * Decimal("0.20")
gross = net + vat
assert net == Decimal("38900.00")


story = []
story += [
    p("ANGEBOT", "Kicker"),
    p("Zentrales Medien- und<br/>TV-Informationssystem", "TitleCustom"),
]

recipient = [
    [p("ANGEBOT AN", "SmallBold"), p("ANGEBOTSDETAILS", "SmallBold")],
    [p("<b>Puchas Hotel Kukmirn GmbH</b><br/>Hotelgasse 1<br/>7543 Kukmirn<br/>Oesterreich", "SmallDark"),
     p("<b>Angebotsnummer:</b> 20250039<br/><b>Angebotsdatum:</b> 10.02.2025<br/><b>Gueltig bis:</b> 12.03.2025<br/><b>Kundennummer:</b> 91", "SmallDark")],
]
t = Table(recipient, colWidths=[88 * mm, 83 * mm], hAlign="LEFT")
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), PALE),
    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#C6D8D7")),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D6E3E2")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
    ("TOPPADDING", (0, 0), (-1, 0), 2.3 * mm),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 2.3 * mm),
    ("TOPPADDING", (0, 1), (-1, 1), 3.5 * mm),
    ("BOTTOMPADDING", (0, 1), (-1, 1), 4 * mm),
]))
story += [t, Spacer(1, 6 * mm)]

story += [
    p("PROJEKTZIEL", "Kicker"),
    p("Ein System, ein Backend, verlaessliche Ausspielung", "H1Custom"),
    p("Bereitstellung eines vollstaendigen Systems zur zentralen Verwaltung und Ausspielung von Werbeinhalten - etwa TV-Spots, Hotelinformationen und Events - ueber die TV-Anlage des Hotels. Die Loesung umfasst Hardware, Netzwerk, Software, Integration, technische Dokumentation und Inbetriebnahme."),
]

highlights = [
    [p("ZENTRAL", "SmallBold"), p("STABIL", "SmallBold"), p("UEBERGABEFERTIG", "SmallBold")],
    [p("Webbasierte Inhalteverwaltung und zeitgesteuerte Playlists", "SmallDark"), p("Segmentiertes Netzwerk, Monitoring und redundante Wiedergabe", "SmallDark"), p("Tests, Dokumentation und Schulung des Hotelpersonals", "SmallDark")],
]
ht = Table(highlights, colWidths=[57 * mm] * 3)
ht.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F6F8FA")),
    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9DEE4")),
    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9DEE4")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
    ("TOPPADDING", (0, 0), (-1, 0), 2.8 * mm),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 1 * mm),
    ("TOPPADDING", (0, 1), (-1, 1), 1 * mm),
    ("BOTTOMPADDING", (0, 1), (-1, 1), 3 * mm),
]))
story += [ht, Spacer(1, 6 * mm)]

story += [
    p("KALKULATION", "Kicker"),
    p("Leistungspositionen", "H1Custom"),
    p("Alle Preise verstehen sich netto und zuzueglich 20 % Umsatzsteuer. Die nachfolgenden Hauptpositionen ergeben gemeinsam den vereinbarten Projektgesamtbetrag.", "SmallDark"),
    Spacer(1, 2 * mm),
]

def positions_table(rows):
    data = [[p("POS.", "WhiteHead"), p("BESCHREIBUNG", "WhiteHead"), p("MENGE", "WhiteHeadRight"), p("EINZELPREIS", "WhiteHeadRight"), p("BETRAG", "WhiteHeadRight")]]
    for no, title, desc, amount in rows:
        data.append([
            p(no, "CellTitle"),
            p(f"<b>{title}</b><br/><font color='#66717E'>{desc}</font>", "Cell"),
            p("1 Stk.", "CellRight"),
            p(eur(amount), "CellRight"),
            p(eur(amount), "CellRightBold"),
        ])
    table = Table(data, colWidths=[12 * mm, 91 * mm, 18 * mm, 25 * mm, 25 * mm], repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("TOPPADDING", (0, 0), (-1, 0), 2.6 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2.6 * mm),
        ("TOPPADDING", (0, 1), (-1, -1), 3.1 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3.1 * mm),
        ("LINEBELOW", (0, 1), (-1, -1), 0.45, colors.HexColor("#D7DDE3")),
    ]))
    return table

story += [positions_table(positions[:3]), PageBreak(), positions_table(positions[3:]), Spacer(1, 5 * mm)]

summary = [
    [p("Projektpreis netto", "SmallDark"), p(eur(net), "CellRight")],
    [p("20 % Umsatzsteuer", "SmallDark"), p(eur(vat), "CellRight")],
    [p("Angebotssumme brutto", "SmallBold"), p(eur(gross), "CellRightBold")],
]
st = Table(summary, colWidths=[49 * mm, 38 * mm], hAlign="RIGHT")
st.setStyle(TableStyle([
    ("TOPPADDING", (0, 0), (-1, -1), 2.1 * mm),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.1 * mm),
    ("LINEABOVE", (0, 0), (-1, 0), 0.7, colors.HexColor("#BFC8D1")),
    ("BACKGROUND", (0, 2), (-1, 2), PALE),
    ("BOX", (0, 2), (-1, 2), 0.8, TEAL),
    ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
]))
story += [st, Spacer(1, 7 * mm)]

option_net = Decimal("4680.00")
option_vat = option_net * Decimal("0.20")
option_gross = option_net + option_vat
option = Table([
    [p("OPTIONALE BETREUUNG", "Kicker"), ""],
    [p("Betreuungs- und Wartungspaket", "OptionTitle"), p("390,00 EUR / Monat", "CellRightBold")],
    [p("Fernwartung, monatlicher Systemcheck, Reaktionszeit innerhalb von 24 Stunden bei Stoerungen sowie laufende kleinere inhaltliche Aktualisierungen. Mindestlaufzeit 12 Monate.", "SmallDark"), p("12 Monate: 4.680,00 EUR netto<br/>5.616,00 EUR brutto", "CellRight")],
], colWidths=[118 * mm, 53 * mm], hAlign="LEFT")
option.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PALE),
    ("SPAN", (0, 0), (1, 0)),
    ("BOX", (0, 0), (-1, -1), 0.9, TEAL),
    ("LINEABOVE", (0, 1), (-1, 1), 0.4, colors.HexColor("#BFD7D5")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
    ("TOPPADDING", (0, 0), (-1, -1), 2.8 * mm),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8 * mm),
]))
story += [option, Spacer(1, 2.5 * mm), p("Die optionale Betreuung ist nicht in der Angebotssumme von 46.680,00 EUR brutto enthalten und wird nur bei gesonderter Beauftragung verrechnet.", "Fine")]

story += [PageBreak(), p("RAHMENBEDINGUNGEN", "Kicker"), p("Projekt- und Vertragsbedingungen", "H1Custom")]

conditions = [
    ("1. Leistungsumfang", "Massgeblich sind die in diesem Angebot beschriebenen Positionen. Aenderungen oder Erweiterungen werden vor Umsetzung abgestimmt und gesondert angeboten."),
    ("2. Mitwirkung des Auftraggebers", "Der Auftraggeber stellt erforderliche Informationen, Zugaenge, Ansprechpartner sowie den Zugang zu Technikraeumen und der bestehenden TV-Infrastruktur rechtzeitig bereit. Bauliche Zusatzarbeiten ausserhalb des beschriebenen Umfangs sind nicht enthalten."),
    ("3. Projektablauf", "Die Detailplanung und der konkrete Umsetzungstermin werden nach Auftragserteilung gemeinsam festgelegt. Lieferzeiten von Hardware sowie notwendige Freigaben koennen den Terminplan beeinflussen."),
    ("4. Verguetung und Zahlung", "50 % des Projektpreises sind nach Auftragserteilung faellig, die restlichen 50 % nach erfolgreicher Uebergabe. Rechnungen sind innerhalb von 14 Tagen ohne Abzug zahlbar."),
    ("5. Abnahme", "Nach Fertigstellung wird das System zur Pruefung bereitgestellt. Die Abnahme ist innerhalb von 10 Werktagen zu bestaetigen oder es sind konkrete Maengel schriftlich anzuzeigen. Vom Leistungsumfang erfasste Maengel werden behoben."),
    ("6. Gewaehrleistung und Haftung", "Es gelten die gesetzlichen Gewaehrleistungsbestimmungen. Die Haftung richtet sich nach den zwingenden gesetzlichen Vorschriften; fuer unsachgemaesse Nutzung, Eingriffe Dritter oder nicht freigegebene Aenderungen wird keine Haftung uebernommen."),
    ("7. Betrieb und optionale Betreuung", "Der Projektpreis umfasst Einrichtung, Inbetriebnahme und Uebergabe, nicht jedoch den dauerhaften Betrieb. Laufende Betreuung, Systemchecks und Inhaltsanpassungen erfolgen nur bei gesonderter Beauftragung des optionalen Betreuungspakets."),
    ("8. Vertraulichkeit und Datenschutz", "Beide Parteien behandeln vertrauliche Informationen aus dem Projekt entsprechend vertraulich. Personenbezogene Daten werden nur verarbeitet, soweit dies fuer die vereinbarten Leistungen erforderlich ist."),
    ("9. Schlussbestimmungen", "Aenderungen und Ergaenzungen beduerfen der schriftlichen Vereinbarung. Es gilt das Recht der Republik Oesterreich. Erfuellungsort ist der Sitz des Auftragnehmers, soweit gesetzlich zulaessig."),
]

for heading, body in conditions:
    story += [KeepTogether([p(heading, "H2Custom"), p(body, "SmallDark")])]

story += [Spacer(1, 5 * mm)]
bank = Table([
    [p("BANKVERBINDUNG", "SmallBold"), p("KONTAKT", "SmallBold")],
    [p("Raiffeisenbezirksbank Guessing<br/>IBAN: AT58 3302 7000 0230 9003<br/>BIC: RLBBAT2E027", "SmallDark"), p("Philipp Johann Fritz<br/>mail@philipp.consulting<br/>+43 664 240 64 14", "SmallDark")],
], colWidths=[88 * mm, 83 * mm])
bank.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D4DAE0")),
    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D4DAE0")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
    ("TOPPADDING", (0, 0), (-1, -1), 2.7 * mm),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.7 * mm),
]))
story += [bank, Spacer(1, 7 * mm), p("AUFTRAGSERTEILUNG", "Kicker"), p("Mit Unterzeichnung wird dieses Angebot einschliesslich der beschriebenen Rahmenbedingungen angenommen.", "SmallDark"), Spacer(1, 10 * mm)]

sign = Table([
    ["", ""],
    [p("Ort, Datum", "Fine"), p("Name, Unterschrift Auftraggeber", "Fine")],
], colWidths=[80 * mm, 80 * mm], hAlign="LEFT", rowHeights=[10 * mm, 6 * mm])
sign.setStyle(TableStyle([
    ("LINEABOVE", (0, 1), (0, 1), 0.6, MID),
    ("LINEABOVE", (1, 1), (1, 1), 0.6, MID),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10 * mm),
]))
story += [sign]


OUT.parent.mkdir(parents=True, exist_ok=True)
doc = OfferDoc(str(OUT))
doc.build(story)
print(OUT.resolve())
