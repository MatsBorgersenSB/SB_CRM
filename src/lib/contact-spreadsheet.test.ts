import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {
  contactImportNote,
  contactsFromGrid,
  matchCompanyId,
  parseDelimited,
  readXlsxGrid,
  splitPersonName,
} from "./contact-spreadsheet";

test("parseDelimited reads semicolon Excel exports and quoted commas", () => {
  const grid = parseDelimited(
    'First name;Last name;Email;Company\n"Ada";"Lovelace";"ada@analytical.example";"Ecopro AS"\n',
  );
  const parsed = contactsFromGrid(grid);
  assert.equal(parsed.error, null);
  assert.equal(parsed.contacts.length, 1);
  assert.equal(parsed.contacts[0]?.firstName, "Ada");
  assert.equal(parsed.contacts[0]?.lastName, "Lovelace");
  assert.equal(parsed.contacts[0]?.companyName, "Ecopro AS");
});

test("contactsFromGrid splits a full name and ignores a blank row", () => {
  const parsed = contactsFromGrid([
    ["Name", "E-mail", "Firma"],
    ["Sondre Ørbog", "sondre@ecopro.no", "Ecopro"],
    ["", "", ""],
  ]);
  assert.deepEqual(splitPersonName("Sondre Ørbog"), {
    firstName: "Sondre",
    lastName: "Ørbog",
  });
  assert.equal(parsed.contacts.length, 1);
  assert.equal(parsed.contacts[0]?.lastName, "Ørbog");
  assert.equal(parsed.contacts[0]?.email, "sondre@ecopro.no");
});

test("contactsFromGrid asks for a name column", () => {
  const parsed = contactsFromGrid([["Phone"], ["900"]]);
  assert.match(parsed.error ?? "", /Name column/);
});

test("matchCompanyId ignores legal suffixes and refuses two hits", () => {
  const companies = [
    { CompanyID: "CO-1", Title: "Ecopro AS" },
    { CompanyID: "CO-2", Title: "Ecopro ASA" },
    { CompanyID: "CO-3", Title: "Rise PFI" },
  ];
  assert.equal(matchCompanyId("Ecopro", companies).ambiguous, true);
  assert.equal(matchCompanyId("Rise PFI AS", companies).id, "CO-3");
  assert.equal(matchCompanyId("", companies).id, null);
});

test("contactImportNote blocks colleagues, duplicates, and a missing company", () => {
  const row = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@standard.bio",
    phone: "",
    mobile: "",
    companyPhone: "",
    companyEmail: "",
    jobTitle: "",
    honorific: "",
    department: "",
    role: "",
    companyName: "Ecopro",
    companyAlternativeName: "",
    linkedIn: "",
    streetAddress: "",
    postalCode: "",
    city: "",
    country: "",
    website: "",
    notes: "",
    sourceFile: "",
    companyId: "CO-1",
  };
  assert.match(contactImportNote(row, new Set(), false) ?? "", /colleague/);
  assert.match(
    contactImportNote({ ...row, email: "ada@analytical.example" }, new Set(["ada@analytical.example"]), false) ?? "",
    /Already/,
  );
  assert.equal(
    contactImportNote({ ...row, email: "ada@analytical.example", companyId: null }, new Set(), false),
    null,
  );
  assert.match(
    contactImportNote(
      { ...row, email: "ada@analytical.example", companyId: null, companyName: "" },
      new Set(),
      false,
    ) ?? "",
    /No company/,
  );
});

test("business card export keeps company, mobile, and address", () => {
  const parsed = contactsFromGrid([
    [
      "First Name",
      "Last Name",
      "Full Name",
      "Job Title",
      "Academic / Honorific Title",
      "Company",
      "Department / Division",
      "Email",
      "Mobile Phone",
      "Direct Phone",
      "Company Phone",
      "Fax",
      "Street Address",
      "Postal Code",
      "City",
      "Country",
      "Website",
      "Notes",
    ],
    [
      "Marianne",
      "Tikkanen",
      "Marianne Tikkanen",
      "Co-founder, Supply Development",
      "",
      "Puro.earth",
      "Supply Development",
      "marianne@puro.earth",
      "+358 504 397 779",
      "",
      "",
      "",
      "",
      "",
      "",
      "Finland",
      "www.puro.earth",
      "World's first marketplace for carbon removal",
    ],
  ]);
  const row = parsed.contacts[0];
  assert.equal(row?.companyName, "Puro.earth");
  assert.equal(row?.mobile, "+358 504 397 779");
  assert.equal(row?.jobTitle, "Co-founder, Supply Development");
  assert.equal(row?.department, "Supply Development");
  assert.equal(row?.country, "Finland");
  assert.equal(row?.website, "www.puro.earth");
});

test("phones are read from the cell, including fax and an unfamiliar heading", () => {
  const parsed = contactsFromGrid([
    ["Name", "GSM", "Tlf", "Company phone", "Fax", "Postnr", "Comment"],
    [
      "Ragnar Tronstad",
      "Mob: 90 63 51 91",
      "+47 38 01 76 59",
      "+47 38 01 70 00",
      "+47 38 01 74 94",
      "NO-4675",
      "Solar",
    ],
    ["Paul Stuart", "", "+33 3 84 86 89 31", "+33 3 84 86 89 31", "+33 9 74 76 05 59", "69009", "Events"],
  ]);
  const ragnar = parsed.contacts[0];
  assert.equal(ragnar?.mobile, "90 63 51 91");
  assert.equal(ragnar?.phone, "+47 38 01 76 59");
  assert.equal(ragnar?.companyPhone, "+47 38 01 70 00");
  assert.equal(ragnar?.postalCode, "NO-4675");
  assert.match(ragnar?.notes ?? "", /Fax: \+47 38 01 74 94/);
  assert.match(ragnar?.notes ?? "", /Comment: Solar/);
  const paul = parsed.contacts[1];
  assert.equal(paul?.phone, "+33 3 84 86 89 31");
  assert.equal(paul?.companyPhone, "");
  assert.match(paul?.notes ?? "", /Fax: \+33 9 74 76 05 59/);
  assert.equal((paul?.notes ?? "").includes("69009"), false);
});

test("readXlsxGrid reads the first sheet", async () => {
  const zip = new JSZip();
  zip.file(
    "xl/sharedStrings.xml",
    `<?xml version="1.0"?><sst><si><t>Name</t></si><si><t>Email</t></si><si><t>Åge Kulsli</t></si><si><t>age@rise.no</t></si></sst>`,
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0"?><worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
    </sheetData></worksheet>`,
  );
  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  const grid = await readXlsxGrid(buffer);
  const parsed = contactsFromGrid(grid);
  assert.equal(parsed.contacts[0]?.firstName, "Åge");
  assert.equal(parsed.contacts[0]?.email, "age@rise.no");
});

test("scanned business card CSV picks out labeled phones, addresses, aliases, and honorifics", () => {
  const grid = parseDelimited(
    [
      "File,Name,Title,Company,Email,Phone,Website,Address,Notes",
      '2026-10-21 08-27 1.pdf,Ragnar Tronstad,CTO,Elkem Solar AS,ragnar.tronstad@elkem.no,"Tel: +47 38 01 70 00, Dir: +47 38 01 76 59, Mob: +47 90 63 51 91, Fax: +47 38 01 74 94",www.elkem.com,"P.O. Box 8040 Vaagsbygd, NO-4675 Kristiansand, Norway",',
      '2026-10-21 08-28.pdf,Jean-François Ferrando,Président / Directeur Développement Commercial,Agence Externalisation Commerciale SAS (DIRCOMEXT),agent@dircomext.com,"Mob: +33 (0)6 37 06 02 97, Tél: +33 (0)1 83 64 90 56, Fax: +33 (0)8 26 38 12 58",www.dircomext.com / www.commercial-externalisation.com,"10, rue de Penthièvre, 75008 Paris, France",',
      '2026-10-27 13-55 3.pdf,Dr. P. Iyngaran,"Senior Lecturer in Chemistry (B.Sc (Hons), PhD (Cambridge), MRSC, MIChem.C)",University of Jaffna,piyngaran@univ.jfn.ac.lk / piyngs7@gmail.com,+94 77 7760 255 / +94 21 2218 193,www.jfn.ac.lk,"Department of Chemistry, Faculty of Science, University of Jaffna, Jaffna, Sri Lanka",',
      '2026-10-21 08-28 2.pdf,Aleksander Lindh,Engineering Manager,Mjørud AS,aleksander.lindh@mjorud.no,"Tel: +47 69 22 88 00, Dir: +47 69 22 88 34, Mob: +47 97 73 23 97",www.mjorud.no,"Rakkestad, Norway",General email: mail@mjorud.no',
    ].join("\n"),
  );
  const parsed = contactsFromGrid(grid);
  assert.equal(parsed.error, null);
  assert.equal(parsed.contacts.length, 4);

  const ragnar = parsed.contacts[0]!;
  assert.equal(ragnar.sourceFile, "2026-10-21 08-27 1.pdf");
  assert.equal(ragnar.companyPhone, "+47 38 01 70 00");
  assert.equal(ragnar.phone, "+47 38 01 76 59");
  assert.equal(ragnar.mobile, "+47 90 63 51 91");
  assert.match(ragnar.notes, /Fax: \+47 38 01 74 94/);
  assert.equal(ragnar.streetAddress, "P.O. Box 8040 Vaagsbygd");
  assert.equal(ragnar.postalCode, "NO-4675");
  assert.equal(ragnar.city, "Kristiansand");
  assert.equal(ragnar.country, "Norway");
  assert.equal(ragnar.role, "Technical Lead");

  const jf = parsed.contacts[1]!;
  assert.equal(jf.companyName, "Agence Externalisation Commerciale SAS");
  assert.equal(jf.companyAlternativeName, "DIRCOMEXT");
  assert.equal(jf.website, "www.dircomext.com");
  assert.match(jf.notes, /Alternative website: www\.commercial-externalisation\.com/);
  assert.equal(jf.streetAddress, "10, rue de Penthièvre");
  assert.equal(jf.postalCode, "75008");
  assert.equal(jf.city, "Paris");
  assert.equal(jf.country, "France");

  const iyngaran = parsed.contacts[2]!;
  assert.equal(iyngaran.firstName, "P.");
  assert.equal(iyngaran.lastName, "Iyngaran");
  assert.match(iyngaran.honorific, /Dr\./);
  assert.match(iyngaran.honorific, /PhD \(Cambridge\)/);
  assert.equal(iyngaran.jobTitle, "Senior Lecturer in Chemistry");
  assert.equal(iyngaran.email, "piyngaran@univ.jfn.ac.lk");
  assert.match(iyngaran.notes, /Secondary email: piyngs7@gmail\.com/);
  assert.equal(iyngaran.city, "Jaffna");
  assert.equal(iyngaran.country, "Sri Lanka");

  const aleksander = parsed.contacts[3]!;
  assert.equal(aleksander.companyEmail, "mail@mjorud.no");
  assert.equal(aleksander.city, "Rakkestad");
  assert.equal(aleksander.country, "Norway");

  // Domain fallback matching for variants like USN or Elkem
  const existing = [{ CompanyID: "CO-ELKEM", Title: "Elkem ASA", Domain: "elkem.com" }];
  assert.equal(matchCompanyId("Elkem Solar AS", existing, "www.elkem.com").id, "CO-ELKEM");
});
