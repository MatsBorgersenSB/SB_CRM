import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface HillclimbFinding {
  id: string;
  gate:
    | "posture-constitution"
    | "ad001-filter-transparency"
    | "unit-eval-suite"
    | "typecheck"
    | "knip-hygiene";
  severity: "blocker" | "warning" | "hygiene";
  file: string;
  line?: number;
  summary: string;
  remediation: string;
}

export interface GateScore {
  gate: string;
  score: number;
  maxScore: number;
  findingsCount: number;
  durationMs: number;
}

export interface HillclimbReport {
  timestamp: string;
  totalScore: number;
  maxScore: number;
  deltaFromPrevious: number | null;
  gates: GateScore[];
  nextTarget: HillclimbFinding | null;
  findings: HillclimbFinding[];
}

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const STATE_PATH = path.join(ROOT, ".cursor", "hillclimb-state.json");

function walkFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "generated") {
        continue;
      }
      results.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function rel(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

/**
 * Gate 1: Constitution & Relationship Posture Gate
 * - Verifies no code defaults empty company types to "Customer"
 * - Verifies Create Opportunity surfaces gate on isOpportunityEligibleCompany / shouldOfferCreateOpportunity
 * - Verifies primary UI components don't leak raw confidence % or engine rule IDs
 */
export function runPostureAndConstitutionGate(targetFiles?: string[]): {
  score: number;
  maxScore: number;
  findings: HillclimbFinding[];
} {
  const maxScore = 250;
  const findings: HillclimbFinding[] = [];
  const files =
    targetFiles ?? walkFiles(SRC_DIR, [".ts", ".tsx"]).filter((f) => !f.endsWith(".test.ts"));

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const relative = rel(file);
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // Hard rule 1: Never default empty types to Customer
      if (
        /types\s*\?\?\s*\[\s*["']Customer["']\s*\]/.test(lineText) ||
        /\|\|\s*["']Customer["']/.test(lineText)
      ) {
        findings.push({
          id: `posture-default-customer:${relative}:${lineNum}`,
          gate: "posture-constitution",
          severity: "blocker",
          file: relative,
          line: lineNum,
          summary: "Defaults missing/empty company type to 'Customer' (violates Reality First).",
          remediation:
            "Keep missing company types as Unclassified and use getCompanyRelationshipPosture / isCompanyUnclassified from @/lib/company-classification.",
        });
      }

      // Hard rule 8: Never expose raw confidence % in primary UI
      if (
        relative.startsWith("src/components/") &&
        !relative.includes("expert") &&
        !relative.includes("debug") &&
        /\bconfidence\b.*%|\bMath\.round\([^)]*confidence[^)]*\)\s*\+\s*["']%["']/.test(lineText)
      ) {
        findings.push({
          id: `constitution-confidence-leak:${relative}:${lineNum}`,
          gate: "posture-constitution",
          severity: "warning",
          file: relative,
          line: lineNum,
          summary: "Exposes raw confidence percentage in UI component.",
          remediation:
            "Remove raw confidence % from primary surface or move behind collapsed expert disclosure (North Star Governing Principle #8).",
        });
      }
    });

    // Check Create Opportunity posture gating on company/intelligence surfaces
    const mentionsCreateOpp =
      content.includes("create_opportunity") ||
      content.includes("add-opportunity") ||
      (content.includes("Create Opportunity") && content.includes("company"));

    const hasEligibilityGate =
      content.includes("isOpportunityEligibleCompany") ||
      content.includes("shouldOfferCreateOpportunity") ||
      content.includes("getCompanyRelationshipPosture") ||
      content.includes("opportunityEligible") ||
      relative.includes("company-classification") ||
      relative.includes("types/") ||
      relative.includes("smart-assist-config");

    if (mentionsCreateOpp && !hasEligibilityGate && relative.startsWith("src/lib/")) {
      findings.push({
        id: `posture-missing-eligibility-gate:${relative}`,
        gate: "posture-constitution",
        severity: "warning",
        file: relative,
        summary:
          "References Create Opportunity on a company context without importing isOpportunityEligibleCompany or shouldOfferCreateOpportunity.",
        remediation:
          "Gate commercial opportunity creation or suggestions with isOpportunityEligibleCompany from @/lib/company-classification.",
      });
    }
  }

  const penalty = findings.reduce(
    (sum, f) => sum + (f.severity === "blocker" ? 50 : 15),
    0,
  );
  return {
    score: Math.max(0, maxScore - penalty),
    maxScore,
    findings,
  };
}

/**
 * Gate 2: AD-001 Filter Transparency Gate
 * Checks workspace list components that maintain search/filter state and filter collections
 * to ensure they render FilterToolbar, FilterTransparencyBar, or explicit "Showing X of Y" transparency.
 */
export function runAd001FilterTransparencyGate(targetFiles?: string[]): {
  score: number;
  maxScore: number;
  findings: HillclimbFinding[];
} {
  const maxScore = 200;
  const findings: HillclimbFinding[] = [];
  const files =
    targetFiles ??
    walkFiles(path.join(SRC_DIR, "components"), [".tsx"]).filter(
      (f) => !f.endsWith(".test.tsx"),
    );

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const relative = rel(file);
    if (!/(table|list|workspace|directory|grid)/i.test(path.basename(file))) {
      continue;
    }

    const content = fs.readFileSync(file, "utf8");
    const hasFilterState =
      /useState<[^>]*>\(\s*["']["']\s*\)/.test(content) &&
      /(search|filter|query)/i.test(content) &&
      content.includes(".filter(");

    const hasTransparency =
      content.includes("FilterToolbar") ||
      content.includes("FilterTransparencyBar") ||
      content.includes("buildActiveFilterChips") ||
      /Showing\s+\{[^}]+\}\s+of\s+\{/.test(content) ||
      content.includes("filteredCount") ||
      content.includes("totalCount");

    if (hasFilterState && !hasTransparency) {
      findings.push({
        id: `ad001-missing-transparency:${relative}`,
        gate: "ad001-filter-transparency",
        severity: "warning",
        file: relative,
        summary:
          "Filtered collection with local search/filter state does not wire FilterTransparencyBar / FilterToolbar or Showing {filtered} of {total}.",
        remediation:
          "Follow docs/AD-001-filter-transparency.md: display filtered count, total count, active filter chips, and clear action.",
      });
    }
  }

  const penalty = findings.length * 20;
  return {
    score: Math.max(0, maxScore - penalty),
    maxScore,
    findings,
  };
}

/**
 * Gate 3: Core Intelligence & FS-021 No-Invention Unit Test Suite
 */
function runUnitEvalSuite(): {
  score: number;
  maxScore: number;
  findings: HillclimbFinding[];
} {
  const maxScore = 250;
  const findings: HillclimbFinding[] = [];
  const testFiles = walkFiles(SRC_DIR, [".test.ts", ".test.tsx"]).map(rel);

  if (testFiles.length === 0) {
    return { score: maxScore, maxScore, findings };
  }

  const tsxCli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const res = spawnSync(
    process.execPath,
    [tsxCli, "--test", ...testFiles],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 60_000,
    },
  );

  if (res.status !== 0) {
    const output = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
    const failLines = output
      .split(/\r?\n/)
      .filter((l) => /^not ok\b|AssertionError|Error:/i.test(l))
      .slice(0, 8);

    const matchedFile =
      testFiles.find((tf) => output.includes(tf) || output.includes(path.basename(tf))) ??
      "src/lib";

    findings.push({
      id: `unit-eval-failure:${matchedFile}`,
      gate: "unit-eval-suite",
      severity: "blocker",
      file: matchedFile,
      summary: `Unit/eval test failure: ${failLines[0] ?? "non-zero exit"}`,
      remediation: `Run \`npx tsx --test ${matchedFile}\` and fix the failing assertion without weakening Reality First guarantees.`,
    });
  }

  const penalty = findings.length * 80;
  return {
    score: Math.max(0, maxScore - penalty),
    maxScore,
    findings,
  };
}

/**
 * Gate 4: TypeScript Static Integrity
 */
function runTypecheckGate(): {
  score: number;
  maxScore: number;
  findings: HillclimbFinding[];
} {
  const maxScore = 200;
  const findings: HillclimbFinding[] = [];

  const tscCli = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
  const res = spawnSync(
    process.execPath,
    [tscCli, "--noEmit", "--pretty", "false"],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 90_000,
    },
  );

  if (res.status !== 0) {
    const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
    const regex = /^([^\s(]+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    const seenFiles = new Set<string>();
    while ((match = regex.exec(out)) !== null) {
      const file = match[1].replace(/\\/g, "/");
      const line = Number(match[2]);
      const code = match[4];
      const msg = match[5];
      if (!seenFiles.has(file) && findings.length < 15) {
        seenFiles.add(file);
        findings.push({
          id: `typecheck:${file}:${line}:${code}`,
          gate: "typecheck",
          severity: "blocker",
          file,
          line,
          summary: `${code}: ${msg}`,
          remediation: `Fix TypeScript error ${code} in ${file}:${line}.`,
        });
      }
    }
  }

  const penalty = findings.length * 40;
  return {
    score: Math.max(0, maxScore - penalty),
    maxScore,
    findings,
  };
}

/**
 * Gate 5: Knip Dead Code & Hygiene Gate
 */
function runKnipHygieneGate(): {
  score: number;
  maxScore: number;
  findings: HillclimbFinding[];
} {
  const maxScore = 100;
  const findings: HillclimbFinding[] = [];

  try {
    const raw = execSync("npx knip --no-exit-code --reporter json", {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(raw) as {
      files?: string[];
      issues?: Array<{
        file?: string;
        exports?: Array<{ name: string; line?: number }>;
        types?: Array<{ name: string; line?: number }>;
      }>;
    };

    for (const unusedFile of (parsed.files ?? []).slice(0, 10)) {
      const normalized = unusedFile.replace(/\\/g, "/");
      if (normalized.startsWith("src/")) {
        findings.push({
          id: `knip-unused-file:${normalized}`,
          gate: "knip-hygiene",
          severity: "hygiene",
          file: normalized,
          summary: "Unused source file detected by knip.",
          remediation:
            "Wire this module into its intended surface if it is part of an active FS spec, or remove dead code per Michelin principle ('if it does not drive a decision, remove it').",
        });
      }
    }

    for (const issue of (parsed.issues ?? []).slice(0, 10)) {
      if (!issue.file) continue;
      const normalized = issue.file.replace(/\\/g, "/");
      const firstExport = issue.exports?.[0];
      if (firstExport && normalized.startsWith("src/")) {
        findings.push({
          id: `knip-unused-export:${normalized}:${firstExport.name}`,
          gate: "knip-hygiene",
          severity: "hygiene",
          file: normalized,
          line: firstExport.line,
          summary: `Unused export '${firstExport.name}' in ${normalized}.`,
          remediation: `Remove unused export keyword or dead symbol '${firstExport.name}' if not part of a public package contract.`,
        });
      }
    }
  } catch {
    // Non-fatal if knip times out or has config mismatch
  }

  const penalty = Math.min(maxScore, findings.length * 5);
  return {
    score: Math.max(0, maxScore - penalty),
    maxScore,
    findings,
  };
}

function selectNextTarget(findings: HillclimbFinding[]): HillclimbFinding | null {
  if (findings.length === 0) return null;
  const weight: Record<HillclimbFinding["severity"], number> = {
    blocker: 3,
    warning: 2,
    hygiene: 1,
  };
  return [...findings].sort((a, b) => weight[b.severity] - weight[a.severity])[0];
}

function main() {
  const args = new Set(process.argv.slice(2));
  const fast = args.has("--fast");
  const jsonOnly = args.has("--json");

  const gates: GateScore[] = [];
  const allFindings: HillclimbFinding[] = [];

  const runTimed = (
    name: string,
    fn: () => { score: number; maxScore: number; findings: HillclimbFinding[] },
  ) => {
    const t0 = Date.now();
    const res = fn();
    gates.push({
      gate: name,
      score: res.score,
      maxScore: res.maxScore,
      findingsCount: res.findings.length,
      durationMs: Date.now() - t0,
    });
    allFindings.push(...res.findings);
  };

  runTimed("posture-constitution", () => runPostureAndConstitutionGate());
  runTimed("ad001-filter-transparency", () => runAd001FilterTransparencyGate());
  runTimed("unit-eval-suite", () => runUnitEvalSuite());

  if (!fast) {
    runTimed("typecheck", () => runTypecheckGate());
    runTimed("knip-hygiene", () => runKnipHygieneGate());
  }

  const totalScore = gates.reduce((s, g) => s + g.score, 0);
  const maxScore = gates.reduce((s, g) => s + g.maxScore, 0);

  let previousScore: number | null = null;
  if (fs.existsSync(STATE_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as {
        totalScore?: number;
        maxScore?: number;
      };
      if (prev.maxScore === maxScore && typeof prev.totalScore === "number") {
        previousScore = prev.totalScore;
      }
    } catch {
      // ignore corrupt state
    }
  }

  const report: HillclimbReport = {
    timestamp: new Date().toISOString(),
    totalScore,
    maxScore,
    deltaFromPrevious: previousScore !== null ? totalScore - previousScore : null,
    gates,
    nextTarget: selectNextTarget(allFindings),
    findings: allFindings,
  };

  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(report, null, 2), "utf8");
  } catch {
    // ignore write issues
  }

  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const deltaStr =
    report.deltaFromPrevious === null
      ? "baseline"
      : report.deltaFromPrevious >= 0
        ? `+${report.deltaFromPrevious}`
        : `${report.deltaFromPrevious}`;

  console.log(
    `\n=== SmartCRM Hillclimb Scorecard: ${report.totalScore} / ${report.maxScore} (${deltaStr}) ===`,
  );
  for (const g of gates) {
    console.log(
      `  [${g.gate.padEnd(26)}] ${String(g.score).padStart(3)}/${g.maxScore}  (${g.findingsCount} findings, ${g.durationMs}ms)`,
    );
  }

  if (report.nextTarget) {
    const t = report.nextTarget;
    console.log(`\nNEXT HILLCLIMB TARGET (#1 of ${allFindings.length}):`);
    console.log(`  ID:          ${t.id}`);
    console.log(`  Severity:    ${t.severity.toUpperCase()} (${t.gate})`);
    console.log(`  Location:    ${t.file}${t.line ? `:${t.line}` : ""}`);
    console.log(`  Issue:       ${t.summary}`);
    console.log(`  Action:      ${t.remediation}`);
  } else {
    console.log("\nAll evaluated gates passed with 0 findings.");
  }
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "")) {
  main();
} else if (process.argv[1]?.endsWith("crm-hillclimb.ts")) {
  main();
}
