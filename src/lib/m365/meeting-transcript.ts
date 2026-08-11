/**
 * FS-014 — Parse Teams meeting transcripts (VTT or plain text).
 * Reality First: only normalize what is present; never invent speakers or content.
 */

export type TranscriptCue = {
  start?: string;
  end?: string;
  speaker?: string;
  text: string;
};

export type ParsedMeetingTranscript = {
  format: "vtt" | "plain";
  cues: TranscriptCue[];
  /** Flattened readable notes for extractors. */
  plainText: string;
  speakers: string[];
};

const VTT_TIMESTAMP =
  /(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s*-->\s*(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)/;

const SPEAKER_PREFIX = /^(?:<v\s+([^>]+)>|([A-Za-z][A-Za-z0-9 .'-]{1,60})\s*[:：])\s*(.*)$/;

function stripVttTags(value: string): string {
  return value
    .replace(/<\/?c[^>]*>/gi, "")
    .replace(/<\/?v[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeVtt(raw: string): boolean {
  const head = raw.slice(0, 200).toUpperCase();
  return head.includes("WEBVTT") || VTT_TIMESTAMP.test(raw);
}

function parseSpeakerLine(line: string): { speaker?: string; text: string } {
  const cleaned = stripVttTags(line);
  if (!cleaned) return { text: "" };
  const match = cleaned.match(SPEAKER_PREFIX);
  if (!match) return { text: cleaned };
  const speaker = (match[1] ?? match[2] ?? "").trim() || undefined;
  const text = (match[3] ?? "").trim() || cleaned;
  return { speaker, text };
}

function parseVtt(raw: string): ParsedMeetingTranscript {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  const cues: TranscriptCue[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!.trim();
    i += 1;
    if (!line || line.toUpperCase().startsWith("WEBVTT") || line.startsWith("NOTE")) {
      continue;
    }

    const timeMatch = line.match(VTT_TIMESTAMP);
    if (!timeMatch) continue;

    const start = timeMatch[1];
    const end = timeMatch[2];
    const textLines: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "") {
      textLines.push(lines[i]!);
      i += 1;
    }

    const joined = textLines.map((item) => stripVttTags(item)).filter(Boolean).join(" ");
    if (!joined) continue;
    const { speaker, text } = parseSpeakerLine(joined);
    if (!text) continue;
    cues.push({ start, end, speaker, text });
  }

  return finalize("vtt", cues);
}

function parsePlain(raw: string): ParsedMeetingTranscript {
  const cues: TranscriptCue[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const { speaker, text } = parseSpeakerLine(trimmed);
    if (!text) continue;
    cues.push({ speaker, text });
  }
  return finalize("plain", cues);
}

function finalize(
  format: ParsedMeetingTranscript["format"],
  cues: TranscriptCue[],
): ParsedMeetingTranscript {
  const speakers = [
    ...new Set(
      cues
        .map((cue) => cue.speaker?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const plainText = cues
    .map((cue) => (cue.speaker ? `${cue.speaker}: ${cue.text}` : cue.text))
    .join("\n");

  return { format, cues, plainText, speakers };
}

/** Normalize Teams VTT or plain transcript into extractor-ready text. */
export function parseMeetingTranscript(raw: string): ParsedMeetingTranscript {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { format: "plain", cues: [], plainText: "", speakers: [] };
  }
  return looksLikeVtt(trimmed) ? parseVtt(trimmed) : parsePlain(trimmed);
}
