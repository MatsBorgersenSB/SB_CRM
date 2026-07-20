#!/usr/bin/env python3
"""Generate Norwegian PDF: SmartCRM Phase 1G — Azure Deployment Readiness."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "SmartCRM-Fase-1G-Azure-Deployment-Readiness-NO.pdf"
FONT_REG = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")


def register_fonts() -> tuple[str, str]:
    pdfmetrics.registerFont(TTFont("ArialNO", str(FONT_REG)))
    pdfmetrics.registerFont(TTFont("ArialNO-Bold", str(FONT_BOLD)))
    return "ArialNO", "ArialNO-Bold"


def build_styles(regular: str, bold: str):
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title",
            fontName=bold,
            fontSize=18,
            leading=22,
            spaceAfter=12,
            alignment=TA_CENTER,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            fontName=regular,
            fontSize=10,
            leading=13,
            spaceAfter=6,
            textColor=colors.HexColor("#444444"),
        ),
        "h1": ParagraphStyle(
            "h1",
            fontName=bold,
            fontSize=14,
            leading=18,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#1a365d"),
        ),
        "h2": ParagraphStyle(
            "h2",
            fontName=bold,
            fontSize=11,
            leading=14,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            fontName=regular,
            fontSize=9.5,
            leading=13,
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            fontName=regular,
            fontSize=9.5,
            leading=13,
            leftIndent=14,
            bulletIndent=6,
            spaceAfter=3,
        ),
        "small": ParagraphStyle(
            "small",
            fontName=regular,
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#555555"),
        ),
    }


def table(data: list[list[str]], col_widths: list[float] | None = None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "ArialNO-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "ArialNO"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1a365d")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def checklist(items: list[str], styles):
    return [Paragraph(f"☐ {item}", styles["bullet"]) for item in items]


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    reg, bold = register_fonts()
    styles = build_styles(reg, bold)

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="SmartCRM Fase 1G — Azure-distribusjonsberedskap",
        author="SmartCRM",
    )

    story: list = []

    story.append(Paragraph("SmartCRM — Fase 1G", styles["title"]))
    story.append(Paragraph("Azure-distribusjonsberedskap", styles["title"]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "<b>Mottaker:</b> IT-leverandør / Azure-administrator<br/>"
            "<b>Applikasjon:</b> SmartCRM (Next.js 16, React 19)<br/>"
            "<b>System of record:</b> SharePoint Online (via Microsoft Graph)<br/>"
            "<b>Vertsmiljø:</b> Azure App Service<br/>"
            "<b>Integrasjon:</b> Outlook Mail Add-in (oppgavepaneler)",
            styles["subtitle"],
        )
    )
    story.append(Spacer(1, 0.4 * cm))

    # 1. Executive summary
    story.append(Paragraph("Sammendrag", styles["h1"]))
    story.append(
        Paragraph(
            "SmartCRM er en <b>hybrid Next.js-applikasjon</b> som krever en <b>Node.js-kjøretid</b> "
            "(ikke statisk hosting). Den leverer et webbasert CRM-grensesnitt, REST API-ruter og "
            "Outlook-oppgavepaneler fra én App Service-distribusjon.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Kritisk forutsetning (applikasjonsteam):</b> I dagens kodebase leser server-renderte "
            "sider og M365-intelligensruter fra en lokal JSON-fil (<font face='Courier'>pipeline-db.json</font>), "
            "mens API-mutasjoner kan bruke Microsoft Graph når <font face='Courier'>SHAREPOINT_TRANSPORT=graph</font>. "
            "Før produksjonslansering med SharePoint som system of record må applikasjonsteamet forene alle "
            "server-side lesinger gjennom Graph-transportlaget. IT bør ikke aktivere <font face='Courier'>graph</font> "
            "i produksjon før dette er bekreftet ferdigstilt.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Autentisering:</b> Entra ID-innlogging for sluttbrukere er <b>ikke implementert ennå</b>. "
            "Applikasjonen bruker en utvikler-rolleveksler; API-rollesjekker baserer seg på headeren "
            "<font face='Courier'>x-sb-user-role</font> som standard faller tilbake til <font face='Courier'>superuser</font> "
            "når den mangler. IT må behandle perimetersikkerhet (App Service Authentication, privat nettverk "
            "eller IP-restriksjoner) som obligatorisk inntil enterprise-auth er levert.",
            styles["body"],
        )
    )

    # 2. App Service
    story.append(Paragraph("1. Krav til Azure App Service", styles["h1"]))
    story.append(Paragraph("1.1 Serviceplan", styles["h2"]))
    story.append(
        table(
            [
                ["Krav", "Spesifikasjon"],
                ["OS", "Linux"],
                ["Kjøretidsstakk", "Node.js 20 LTS"],
                ["Plan (pilot)", "B1 minimum; P1v2 anbefalt for Always On"],
                ["Instanser", "1 (pilot); skaler horisontalt først når datalaget er fullt Graph-basert"],
                ["Region", "Samme region som Microsoft 365-leietaker"],
                ["Always On", "Aktivert (påkrevd for next start)"],
                ["HTTPS", "Påkrevd — kun HTTPS; gyldig TLS-sertifikat på eget domene"],
            ],
            [5.5 * cm, 11.5 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("1.2 Bygg- og startkommandoer", styles["h2"]))
    story.append(
        table(
            [
                ["Fase", "Kommando"],
                ["Installasjon", "npm ci"],
                ["Bygg", "npm run build"],
                ["Start", "npm start (kjører next start på PORT)"],
            ],
            [4 * cm, 13 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "Sett <font face='Courier'>PORT</font> til 8080 (App Service-standard) eller "
            "<font face='Courier'>WEBSITES_PORT=3000</font>. Sett "
            "<font face='Courier'>WEBSITE_NODE_DEFAULT_VERSION</font> til ~20. Aktiver "
            "<font face='Courier'>SCM_DO_BUILD_DURING_DEPLOYMENT</font> ved Git-deploy, "
            "eller bygg i CI/CD og distribuer .next-artefakt.",
            styles["body"],
        )
    )
    story.append(Paragraph("1.3 Nettverk og sikkerhet", styles["h2"]))
    story.append(
        table(
            [
                ["Element", "Krav"],
                ["Offentlig endepunkt", "Påkrevd — Outlook laster SmartCRM i iframe"],
                ["Eget domene", "Påkrevd for produksjonsmanifest (f.eks. smartcrm.contoso.com)"],
                ["Utgående trafikk", "HTTPS til graph.microsoft.com og login.microsoftonline.com"],
                ["Innkommende", "Vurder App Service Authentication (Easy Auth) inntil app-auth er klar"],
                ["Hemmeligheter", "Azure Key Vault; referanser i App Service"],
                ["Filsystem", "Ikke bruk lokal disk for persistente data i produksjon"],
            ],
            [5 * cm, 12 * cm],
        )
    )
    story.append(Paragraph("1.4 Plattformer som IKKE skal brukes", styles["h2"]))
    story.append(
        Paragraph(
            "• <b>Azure Static Web Apps</b> — utilstrekkelig for Next.js SSR og 21+ dynamiske API-ruter<br/>"
            "• <b>Kun statisk eksport</b> — applikasjonen er ikke konfigurert for output: 'export'",
            styles["body"],
        )
    )

    story.append(PageBreak())

    # 3. Environment variables
    story.append(Paragraph("2. Miljøvariabler", styles["h1"]))
    story.append(
        Paragraph(
            "Konfigurer under <b>App Service → Configuration → Application settings</b>. "
            "Lagre hemmeligheter som Key Vault-referanser.",
            styles["body"],
        )
    )
    story.append(Paragraph("2.1 Påkrevde (produksjon)", styles["h2"]))
    story.append(
        table(
            [
                ["Variabel", "Eksempel", "Hemmelig", "Beskrivelse"],
                ["SHAREPOINT_TRANSPORT", "graph", "Nei", "Må være graph i produksjon"],
                ["NEXT_PUBLIC_APP_URL", "https://smartcrm.contoso.com", "Nei", "Offentlig base-URL for Outlook"],
                ["SHAREPOINT_SITE_ID", "{hostname},{siteId},{webId}", "Nei", "SharePoint site-ID for Graph"],
                ["AZURE_TENANT_ID", "GUID", "Nei", "Microsoft 365-leietaker-ID"],
                ["NODE_ENV", "production", "Nei", "Bekreft at verdien er production"],
            ],
            [4.2 * cm, 4.5 * cm, 1.5 * cm, 6.8 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("2.2 Påkrevde for Graph (midlertidig)", styles["h2"]))
    story.append(
        table(
            [
                ["Variabel", "Beskrivelse"],
                [
                    "MICROSOFT_GRAPH_ACCESS_TOKEN",
                    "Midlertidig løsning. Statisk token fra miljø. Erstatt med client credentials eller managed identity før go-live.",
                ],
            ],
            [5 * cm, 12 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("2.3 Valgfrie", styles["h2"]))
    story.append(
        Paragraph(
            "MICROSOFT_GRAPH_BASE_URL (standard: graph.microsoft.com/v1.0); "
            "SP_LIST_COMPANIES, SP_LIST_CONTACTS, SP_LIST_DEALS, SP_LIST_RAW_MATERIALS, SP_LIST_ACTIVITIES; "
            "OUTLOOK_IMPORT_DEBUG (kun feilsøking i pilot); PORT.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Ikke sett i produksjon:</b> SHAREPOINT_TRANSPORT=local (bruker pipeline-db.json på serverdisk).",
            styles["body"],
        )
    )

    # 4. Azure AD
    story.append(Paragraph("3. Krav til Azure AD (Entra ID)", styles["h1"]))
    story.append(Paragraph("3.1 App-registrering — SmartCRM backend (Graph-tilgang)", styles["h2"]))
    story.append(
        table(
            [
                ["Innstilling", "Verdi"],
                ["Kontotyper", "Enkelt leietaker (denne organisasjonen)"],
                ["Redirect URI", "Ikke påkrevd for client credentials"],
                ["Klienthemmelighet / sertifikat", "Påkrevd for app-only Graph-tilgang"],
                ["Admin-samtykke", "Påkrevd for application permissions"],
            ],
            [5.5 * cm, 11.5 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("3.2 Autentiseringsmodell", styles["h2"]))
    story.append(
        table(
            [
                ["Funksjon", "Nåværende status", "IT-tiltak"],
                ["Brukerinnlogging", "Kun dev-rolleveksler", "Aktiver App Service Authentication eller vent på MSAL"],
                ["API-autorisasjon", "x-sb-user-role; standard superuser", "Begrens nettverkstilgang"],
                ["Graph-token", "Statisk miljøvariabel", "Erstatt med client credentials + Key Vault"],
            ],
            [4 * cm, 5.5 * cm, 7.5 * cm],
        )
    )

    # 5. Graph permissions
    story.append(Paragraph("4. Microsoft Graph / SharePoint-tillatelser", styles["h1"]))
    story.append(
        Paragraph(
            "SmartCRM aksesserer SharePoint-<b>listeelementer</b> via Microsoft Graph "
            "(GET/POST/PATCH/DELETE på /sites/{site-id}/lists/{list-name}/items).",
            styles["body"],
        )
    )
    story.append(Paragraph("4.1 Application permissions (anbefalt)", styles["h2"]))
    story.append(
        table(
            [
                ["Tillatelse", "Type", "Formål"],
                ["Sites.ReadWrite.All", "Application", "Full list CRUD (bred)"],
                ["Sites.Selected", "Application", "Kun eksplisitt tildelte nettsteder (minst privilegium)"],
            ],
            [4.5 * cm, 3 * cm, 9.5 * cm],
        )
    )
    story.append(
        Paragraph(
            "Etter Sites.Selected: kjør engangstildeling via "
            "POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions",
            styles["body"],
        )
    )
    story.append(Paragraph("4.2 Tillatelser som IKKE kreves", styles["h2"]))
    story.append(
        Paragraph(
            "Mail.Read, User.Read.All, Files.ReadWrite.All — ikke brukt av nåværende kodebase.",
            styles["body"],
        )
    )
    story.append(Paragraph("4.3 SharePoint-lister (standardnavn)", styles["h2"]))
    story.append(
        table(
            [
                ["Liste", "Operasjoner"],
                ["Companies", "Les, opprett, oppdater, slett"],
                ["Contacts", "Les, opprett, oppdater, slett"],
                ["Deals", "Les, opprett, oppdater"],
                ["Activities", "Les, opprett, oppdater"],
                ["RawMaterials", "Les, opprett, oppdater"],
            ],
            [5 * cm, 12 * cm],
        )
    )

    story.append(PageBreak())

    # 6. Outlook
    story.append(Paragraph("5. Krav til Outlook Add-in", styles["h1"]))
    story.append(
        table(
            [
                ["Element", "Detalj"],
                ["Manifestfil", "outlook/relationship-card/manifest.xml"],
                ["Type", "Mail App (MailApp)"],
                ["Manifest-ID", "6f3c8b2a-9d4e-4a1c-b7e2-smartcrm-outlook-v1 (ikke endre etter deploy)"],
                ["Vert", "Mailbox (Outlook desktop og web)"],
                ["Mailbox API", "Minimum 1.5"],
                ["Manifesttillatelse", "ReadItem"],
            ],
            [5 * cm, 12 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("5.1 URL-er som må oppdateres", styles["h2"]))
    story.append(
        Paragraph(
            "Erstatt alle https://localhost:3000 med produksjonsvert:<br/>"
            "• /outlook/relationship-card — Relationship Card-oppgavepanel<br/>"
            "• /outlook/meeting-briefing — Meeting Briefing-oppgavepanel<br/>"
            "• AppDomains, IconUrl, SupportUrl",
            styles["body"],
        )
    )
    story.append(Paragraph("5.2 Påkrevde SmartCRM-ruter", styles["h2"]))
    story.append(
        table(
            [
                ["Rute", "Formål"],
                ["/outlook/relationship-card", "Relationship Card UI"],
                ["/outlook/meeting-briefing", "Meeting Briefing UI"],
                ["/api/m365/relationship-card", "Intelligens for åpen e-post"],
                ["/api/m365/meeting-briefing", "Møtebriefing"],
                ["/api/m365/outlook/sender-context", "Signaturberikelse"],
                ["/api/m365/outlook/add-contact", "Opprett kontakt fra Outlook"],
            ],
            [6.5 * cm, 10.5 * cm],
        )
    )
    story.append(Paragraph("5.3 Distribusjon", styles["h2"]))
    story.append(
        Paragraph(
            "<b>Sentralisert distribusjon</b> (produksjon) via Microsoft 365 Admin Center → Integrated apps. "
            "<b>Sidelasting</b> kun for pilot. Tildel til pilotsikkerhetsgruppe først.",
            styles["body"],
        )
    )

    # 7. Deployment checklist
    story.append(Paragraph("6. Distribusjonssjekkliste", styles["h1"]))
    story.append(Paragraph("Fase A — Azure-grunnlag", styles["h2"]))
    story.extend(
        checklist(
            [
                "Opprett Resource Group",
                "Opprett App Service Plan (Linux, Node 20)",
                "Opprett App Service web app",
                "Konfigurer eget domene og TLS-sertifikat",
                "Aktiver Always On og HTTPS Only",
                "Opprett Key Vault; gi App Service managed identity tilgang",
            ],
            styles,
        )
    )
    story.append(Paragraph("Fase B — Entra ID og Graph", styles["h2"]))
    story.extend(
        checklist(
            [
                "Opprett Entra app-registrering: SmartCRM Backend",
                "Tildel Sites.Selected eller Sites.ReadWrite.All",
                "Admin-samtykke gitt",
                "Lagre klienthemmelighet i Key Vault",
                "Tildel app-tilgang til SharePoint-nettsted",
                "Registrer SHAREPOINT_SITE_ID og AZURE_TENANT_ID",
            ],
            styles,
        )
    )
    story.append(Paragraph("Fase C — SharePoint", styles["h2"]))
    story.extend(
        checklist(
            [
                "Bekreft at SharePoint-nettsted finnes",
                "Bekreft lister: Companies, Contacts, Deals, Activities, RawMaterials",
                "Bekreft listeskjema mot applikasjonsmappere",
                "Migrer/seed pilotdata om nødvendig",
                "Bekreft Contribute-tilgang for app-identitet",
            ],
            styles,
        )
    )
    story.append(Paragraph("Fase D — Applikasjonsdistribusjon", styles["h2"]))
    story.extend(
        checklist(
            [
                "Bekreft at applikasjonsteam har forent server-lesing til Graph",
                "Sett miljøvariabler (se kapittel 2)",
                "Distribuer applikasjon (npm ci → build → start)",
                "Verifiser oppstart i Log stream",
                "Bekreft SHAREPOINT_TRANSPORT=graph",
            ],
            styles,
        )
    )
    story.append(Paragraph("Fase E — Outlook Add-in", styles["h2"]))
    story.extend(
        checklist(
            [
                "Oppdater manifest.xml med produksjons-URL-er",
                "Last opp manifest i M365 Admin Center",
                "Tildel add-in til pilotgruppe",
                "Bekreft NEXT_PUBLIC_APP_URL matcher manifestvert",
            ],
            styles,
        )
    )

    story.append(PageBreak())

    # 8. Post-deployment
    story.append(Paragraph("7. Verifisering etter utrulling", styles["h1"]))
    story.append(Paragraph("7.1 Infrastruktur", styles["h2"]))
    story.append(
        table(
            [
                ["#", "Test", "Forventet resultat"],
                ["1", "Åpne https://{host}", "CRM-dashboard lastes over HTTPS"],
                ["2", "App Service Log stream", "Ingen oppstartsfeil"],
                ["3", "TLS-inspeksjon", "Gyldig sertifikat; ingen mixed content"],
            ],
            [1 * cm, 6.5 * cm, 9.5 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("7.2 Graph / SharePoint", styles["h2"]))
    story.append(
        table(
            [
                ["#", "Test", "Forventet resultat"],
                ["4", "GET /api/companies", "JSON fra SharePoint"],
                ["5", "GET /api/contacts", "Kontakter fra SharePoint"],
                ["6", "Opprett selskap i UI", "Nytt element i Companies-listen"],
                ["7", "Rediger kontakt", "Endring i Contacts-listen"],
                ["8", "Slett kontakt (superuser)", "Element fjernet"],
                ["9", "Slett tomt selskap", "Element fjernet"],
            ],
            [1 * cm, 5.5 * cm, 10.5 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("7.3 Outlook Add-in", styles["h2"]))
    story.append(
        table(
            [
                ["#", "Test", "Forventet resultat"],
                ["15", "SmartCRM-bånd i Outlook", "Add-in distribuert"],
                ["16", "Åpne e-post → Relationship Card", "Oppgavepanel lastes"],
                ["17", "Kjent kontakt", "Relasjonsintelligens vises"],
                ["18", "Ukjent kontakt", "Legg til i SmartCRM vises"],
                ["19", "Godta → Opprett kontakt", "Opprettet i SharePoint"],
                ["20", "Møte → Meeting Briefing", "Briefing lastes"],
            ],
            [1 * cm, 5.5 * cm, 10.5 * cm],
        )
    )

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Ansvarsmatrise", styles["h1"]))
    story.append(
        table(
            [
                ["Område", "Eier"],
                ["App Service, TLS, Key Vault, nettverk", "IT-leverandør"],
                ["Entra app-registrering, admin-samtykke", "IT-leverandør"],
                ["SharePoint-nettsted, lister, tillatelser", "IT-leverandør"],
                ["Outlook sentralisert distribusjon", "IT-leverandør"],
                ["Forene server-lesing til Graph", "Applikasjonsteam (blokkerer go-live)"],
                ["Enterprise brukerautentisering", "Applikasjonsteam (fremtidig fase)"],
                ["Manifest-URL-er, funksjonstesting", "Felles"],
            ],
            [8 * cm, 9 * cm],
        )
    )

    story.append(Spacer(1, 0.5 * cm))
    story.append(
        Paragraph(
            f"Dokumentversjon: Fase 1G — Azure-distribusjonsberedskap | Applikasjonsversjon: 0.1.0 (Next.js 16.2.10) | "
            f"Generert: juli 2026",
            styles["small"],
        )
    )

    doc.build(story)
    print(f"PDF opprettet: {OUT}")


if __name__ == "__main__":
    main()
