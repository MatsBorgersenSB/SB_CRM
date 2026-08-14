import type { M365MeetingBriefingPayload } from "@/types/m365";

/** Reply languages for Meeting Briefing Prepare reply — English first. */
export const MEETING_REPLY_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "nb", label: "Norwegian" },
  { code: "sv", label: "Swedish" },
  { code: "de", label: "German" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
] as const;

export type MeetingReplyLanguageCode = (typeof MEETING_REPLY_LANGUAGES)[number]["code"];

export type MeetingBriefingReplyDraft = {
  subject: string;
  bodyPlain: string;
  bodyHtml: string;
  language: MeetingReplyLanguageCode;
};

function firstName(fullName: string | null | undefined): string {
  const part = fullName?.trim().split(/\s+/)[0];
  return part || "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainToHtml(body: string): string {
  return body
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line)).join("<br/>");
      return `<p>${lines}</p>`;
    })
    .join("");
}

type DraftCopy = {
  subjectPrefix: string;
  greeting: (name: string) => string;
  open: (company: string, opportunity: string | null) => string;
  objectiveLead: string;
  askLead: string;
  close: string;
  regards: string;
};

const COPY: Record<MeetingReplyLanguageCode, DraftCopy> = {
  en: {
    subjectPrefix: "Re:",
    greeting: (name) => (name ? `Hi ${name},` : "Hi,"),
    open: (company, opportunity) =>
      opportunity
        ? `I hope you are well. I wanted to reconnect on ${opportunity} with ${company}.`
        : `I hope you are well. I wanted to reconnect with you and the team at ${company}.`,
    objectiveLead: "Our aim for a short sync would be to:",
    askLead: "It would help to clarify:",
    close:
      "Would you be open to a brief call this week or next — or a short reply here with your preferred next step?",
    regards: "Best regards,",
  },
  nb: {
    subjectPrefix: "Sv:",
    greeting: (name) => (name ? `Hei ${name},` : "Hei,"),
    open: (company, opportunity) =>
      opportunity
        ? `Håper det står bra til. Jeg ønsket å ta opp tråden rundt ${opportunity} med ${company}.`
        : `Håper det står bra til. Jeg ønsket å ta kontakt igjen med deg og teamet hos ${company}.`,
    objectiveLead: "Målet med en kort sync ville være å:",
    askLead: "Det ville hjelpe å avklare:",
    close:
      "Har du anledning til en kort samtale denne eller neste uke — eller et kort svar her med ønsket neste steg?",
    regards: "Med vennlig hilsen,",
  },
  sv: {
    subjectPrefix: "Sv:",
    greeting: (name) => (name ? `Hej ${name},` : "Hej,"),
    open: (company, opportunity) =>
      opportunity
        ? `Hoppas allt är bra. Jag ville återknyta kontakten kring ${opportunity} med ${company}.`
        : `Hoppas allt är bra. Jag ville återknyta kontakten med dig och teamet på ${company}.`,
    objectiveLead: "Syftet med en kort sync skulle vara att:",
    askLead: "Det skulle hjälpa att klargöra:",
    close:
      "Har du möjlighet till ett kort samtal den här eller nästa vecka — eller ett kort svar här med önskat nästa steg?",
    regards: "Vänliga hälsningar,",
  },
  de: {
    subjectPrefix: "AW:",
    greeting: (name) => (name ? `Hallo ${name},` : "Hallo,"),
    open: (company, opportunity) =>
      opportunity
        ? `ich hoffe, es geht Ihnen gut. Ich wollte bezüglich ${opportunity} mit ${company} wieder anknüpfen.`
        : `ich hoffe, es geht Ihnen gut. Ich wollte wieder Kontakt mit Ihnen und dem Team bei ${company} aufnehmen.`,
    objectiveLead: "Ziel eines kurzen Syncs wäre:",
    askLead: "Hilfreich wäre, Folgendes zu klären:",
    close:
      "Hätten Sie diese oder nächste Woche Zeit für ein kurzes Gespräch — oder eine kurze Antwort hier mit dem gewünschten nächsten Schritt?",
    regards: "Freundliche Grüße,",
  },
  da: {
    subjectPrefix: "Sv:",
    greeting: (name) => (name ? `Hej ${name},` : "Hej,"),
    open: (company, opportunity) =>
      opportunity
        ? `Håber du har det godt. Jeg ville gerne genoptage dialogen om ${opportunity} med ${company}.`
        : `Håber du har det godt. Jeg ville gerne genoptage dialogen med dig og teamet hos ${company}.`,
    objectiveLead: "Målet med en kort sync ville være at:",
    askLead: "Det ville hjælpe at afklare:",
    close:
      "Har du mulighed for en kort samtale i denne eller næste uge — eller et kort svar her med ønsket næste skridt?",
    regards: "Med venlig hilsen,",
  },
  fi: {
    subjectPrefix: "VS:",
    greeting: (name) => (name ? `Hei ${name},` : "Hei,"),
    open: (company, opportunity) =>
      opportunity
        ? `Toivottavasti kaikki on hyvin. Halusin palata asiaan ${opportunity} / ${company} -hankkeen osalta.`
        : `Toivottavasti kaikki on hyvin. Halusin ottaa uudelleen yhteyttä teihin ja ${company}-tiimiin.`,
    objectiveLead: "Lyhyen synkronoinnin tavoitteena olisi:",
    askLead: "Olisi hyödyllistä selventää:",
    close:
      "Sopisiko lyhyt puhelu tällä tai ensi viikolla — tai lyhyt vastaus tähän toivotusta seuraavasta askeleesta?",
    regards: "Ystävällisin terveisin,",
  },
};

/**
 * SmartAssist drafts a re-engagement reply from Meeting Briefing context.
 * Deterministic templates — Reality First, no invented facts.
 */
export function buildMeetingBriefingReplyDraft(
  payload: M365MeetingBriefingPayload,
  language: MeetingReplyLanguageCode = "en",
): MeetingBriefingReplyDraft {
  const copy = COPY[language] ?? COPY.en;
  const name = firstName(payload.counterpartyName);
  const company = payload.companyName;
  const opportunity = payload.openOpportunities[0]?.label ?? null;
  const topic = opportunity ?? company;

  const subjectBase = opportunity ?? company;
  const subject = `${copy.subjectPrefix} ${subjectBase}`.replace(/\s+/g, " ").trim();

  const objectiveLine = payload.meetingObjective.trim();
  const questions = payload.discussionTopics.slice(0, 3);

  const lines: string[] = [
    copy.greeting(name),
    "",
    copy.open(company, opportunity),
    "",
    copy.objectiveLead,
    `• ${objectiveLine}`,
  ];

  if (payload.nextBestAction.action.trim()) {
    lines.push(`• ${payload.nextBestAction.action.trim()}`);
  }

  if (questions.length > 0) {
    lines.push("", copy.askLead);
    for (const question of questions) {
      lines.push(`• ${question}`);
    }
  }

  lines.push("", copy.close, "", copy.regards);

  const bodyPlain = lines.join("\n");

  return {
    subject,
    bodyPlain,
    bodyHtml: plainToHtml(bodyPlain),
    language,
  };
}
