import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStructuredGeoAddress } from "./geo-address";
import { discoverContactLinks } from "./website-fetch";
import { analyzeWebsiteHtml, prepareDiscoveryForImport } from "./website-discovery";
import { normalizePhoneNumber } from "@/lib/m365/phone-normalization";

describe("website discovery — German & European company sites", () => {
  it("normalizes international phone numbers with trunk zero, slashes, and en-dashes", () => {
    assert.equal(normalizePhoneNumber("(+49) 0 52 77 / 95 393 – 0"), "+49 52 77 95 393 0");
    assert.equal(normalizePhoneNumber("(+49)05277/95393–0"), "+49 5277 95393 0");
    assert.equal(normalizePhoneNumber("+47 46 50 85 09"), "+47 46 50 85 09");
  });

  it("discovers imprint and contact-person links and ignores asset URLs", () => {
    const html = `
      <link rel="stylesheet" href="https://www.s-und-ue.de/wp-content/plugins/merona/contact-bar.css" />
      <a href="https://www.s-und-ue.de/unternehmen/">Unternehmen</a>
      <a href="https://www.s-und-ue.de/unternehmen/kontakt/">Kontakt</a>
      <a href="https://www.s-und-ue.de/unternehmen/ansprechpartner/">Ansprechpartner</a>
      <a href="https://www.s-und-ue.de/impressum/">Impressum</a>
    `;
    const links = discoverContactLinks(html, "https://www.s-und-ue.de/");
    assert.deepEqual(links, [
      "https://www.s-und-ue.de/impressum",
      "https://www.s-und-ue.de/unternehmen/ansprechpartner",
      "https://www.s-und-ue.de/unternehmen/kontakt",
      "https://www.s-und-ue.de/unternehmen",
    ]);
  });

  it("parses German 5-digit addresses with district separators and respects TLD for 4-digit postal codes", () => {
    const de = parseStructuredGeoAddress("Löwendorf 1 37696 Marienmünster | Löwendorf", "s-und-ue.de");
    assert.equal(de.streetAddress, "Löwendorf 1");
    assert.equal(de.postalCode, "37696");
    assert.equal(de.city, "Marienmünster");
    assert.equal(de.country, "Germany");
    assert.equal(de.countryCode, "DE");
    assert.equal(de.continent, "Europe");

    const ch = parseStructuredGeoAddress("Bahnhofstrasse 10, 8001 Zürich", "example.ch");
    assert.equal(ch.country, "Switzerland");
    assert.equal(ch.countryCode, "CH");
  });

  it("extracts full company details, legal identifiers, and isolated team contacts from German pages", () => {
    const homeHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@graph":[
              {"@type":"Organization","name":"S&Ü Hydraulik- und Maschinenbau GmbH","description":"Sondermaschinenbau & Hydraulik Hersteller","telephone":"+495277953930"}
            ]}
          </script>
        </head>
        <body>
          <footer>
            <p><strong>S&amp;Ü Hydraulik- und Maschinenbau GmbH<br></strong>Löwendorf 1<br>37696 Marienmünster | Löwendorf<br><strong>Telefon: </strong><a href="tel:(+49)05277/95393–0">(+49) 0 52 77 / 95 393 – 0</a><br><strong>Fax:</strong> (+49) 0 52 77 / 95 393 – 29<br><strong>Mail:</strong> <a href="mailto:info@s-und-ue.de">info@s-und-ue.de</a></p>
          </footer>
        </body>
      </html>
    `;

    const impressumHtml = `
      <main>
        <h1>Impressum</h1>
        <p>S&amp;Ü Hydraulik und Maschinenbau GmbH</p>
        <p>Löwendorf 1 37696 Marienmünster | Löwendorf</p>
        <p>Geschäftsführung: Thomas Scherer</p>
        <h2>Register\u00ADeintrag</h2>
        <p>Handelsregister: 7128</p>
        <p>Registergericht: Amtsgericht Paderborn</p>
        <h2>Umsatz\u00ADsteuer-ID</h2>
        <p>DE 811787816</p>
      </main>
    `;

    const teamHtml = `
      <main>
        <article class="person type-person">
          <div class="person__inner">
            <h3 class="person__title">Thomas Scherer</h3>
            <span class="person__position">Geschäftsführung</span>
            <span class="person__mail"><a href="mailto:ansprechpartner@s-und-ue.de">ansprechpartner@s-und-ue.de</a></span>
            <span class="person__phone">(+49) 0 52 77 / 95 393 &#8211; 0</span>
          </div>
        </article>
        <article class="person type-person">
          <div class="person__inner">
            <h3 class="person__title">Johanna Scherer</h3>
            <span class="person__position">Geschäftsführung</span>
            <span class="person__mail"><a href="mailto:ansprechpartner@s-und-ue.de">ansprechpartner@s-und-ue.de</a></span>
            <span class="person__phone">(+49) 0 52 77 / 95 393 &#8211; 24</span>
          </div>
        </article>
      </main>
    `;

    const result = analyzeWebsiteHtml("https://www.s-und-ue.de/", [
      { url: "https://www.s-und-ue.de", html: homeHtml },
      { url: "https://www.s-und-ue.de/impressum", html: impressumHtml },
      { url: "https://www.s-und-ue.de/unternehmen/ansprechpartner", html: teamHtml },
    ]);

    assert.equal(result.company.name, "S&Ü Hydraulik- und Maschinenbau GmbH");
    assert.equal(result.company.phone, "+49 5277 95393 0");
    assert.equal(result.company.email, "info@s-und-ue.de");
    assert.equal(result.company.streetAddress, "Löwendorf 1");
    assert.equal(result.company.postalCode, "37696");
    assert.equal(result.company.city, "Marienmünster");
    assert.equal(result.company.country, "Germany");
    assert.equal(result.company.countryCode, "DE");
    assert.equal(result.company.continent, "Europe");
    assert.equal(result.company.registrationNumber, "7128 (Amtsgericht Paderborn)");
    assert.equal(result.company.vatNumber, "DE811787816");
    assert.equal(result.company.industryDescription, "Sondermaschinenbau & Hydraulik Hersteller");

    assert.equal(result.contacts.length, 2);
    assert.equal(result.contacts[0]?.name, "Thomas Scherer");
    assert.equal(result.contacts[0]?.phone, "+49 52 77 95 393 0");
    assert.equal(result.contacts[1]?.name, "Johanna Scherer");
    assert.equal(result.contacts[1]?.phone, "+49 52 77 95 393 24");

    // Ensure prepareDiscoveryForImport preserves legal & industry metadata
    const prepared = prepareDiscoveryForImport(result);
    assert.equal(prepared.company.registrationNumber, "7128 (Amtsgericht Paderborn)");
    assert.equal(prepared.company.vatNumber, "DE811787816");
    assert.equal(prepared.company.industryDescription, "Sondermaschinenbau & Hydraulik Hersteller");
  });

  it("captures entity-encoded, obfuscated, and JSON-LD company emails while ignoring image assets", () => {
    const entityHtml = `
      <html>
        <body>
          <img src="/assets/logo@2x.png" />
          <a href="mailto:&#105;&#110;&#102;&#111;&#64;acme-bio.de">Email us</a>
        </body>
      </html>
    `;
    const r1 = analyzeWebsiteHtml("https://acme-bio.de", [
      { url: "https://acme-bio.de", html: entityHtml },
    ]);
    assert.equal(r1.company.email, "info@acme-bio.de");

    const obfuscatedHtml = `
      <html>
        <body>
          <p>Reach us at kontakt [at] nordic-heat.no for inquiries.</p>
        </body>
      </html>
    `;
    const r2 = analyzeWebsiteHtml("https://nordic-heat.no", [
      { url: "https://nordic-heat.no", html: obfuscatedHtml },
    ]);
    assert.equal(r2.company.email, "kontakt@nordic-heat.no");

    const jsonLdHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Organization","name":"BioTech AG","email":"mailto:office@biotech.ch"}
          </script>
        </head>
        <body></body>
      </html>
    `;
    const r3 = analyzeWebsiteHtml("https://biotech.ch", [
      { url: "https://biotech.ch", html: jsonLdHtml },
    ]);
    assert.equal(r3.company.email, "office@biotech.ch");
  });
});
