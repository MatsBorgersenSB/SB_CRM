#!/usr/bin/env node
import { execSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CACHE_PATH = path.join(ROOT, ".cursor", "hillclimb-hook-cache.json");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "{}";
  }
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    }
  } catch {
    // ignore
  }
  return { hashes: {} };
}

function saveCache(cache) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  } catch {
    // ignore
  }
}

function hashFile(fullPath) {
  try {
    const buf = fs.readFileSync(fullPath);
    return crypto.createHash("sha1").update(buf).digest("hex");
  } catch {
    return null;
  }
}

function getDirtySrcFiles() {
  try {
    const out = execSync("git status --porcelain -- src/", {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(2).trim().replace(/^"+|"+$/g, ""))
      .map((p) => (p.includes(" -> ") ? p.split(" -> ")[1] : p))
      .map((p) => p.replace(/\\/g, "/"))
      .filter((p) => p.startsWith("src/") && (p.endsWith(".ts") || p.endsWith(".tsx")));
  } catch {
    return [];
  }
}

function checkChangedFiles(changedRelFiles) {
  const issues = [];

  for (const relative of changedRelFiles) {
    const full = path.join(ROOT, relative);
    if (!fs.existsSync(full) || relative.endsWith(".test.ts") || relative.endsWith(".test.tsx")) {
      continue;
    }

    const content = fs.readFileSync(full, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      if (
        /types\s*\?\?\s*\[\s*["']Customer["']\s*\]/.test(lineText) ||
        /\|\|\s*["']Customer["']/.test(lineText)
      ) {
        issues.push(
          `${relative}:${lineNum} — Defaults missing company type to 'Customer'. Keep unknown types Unclassified and use @/lib/company-classification.`,
        );
      }

      if (
        relative.startsWith("src/components/") &&
        !relative.includes("expert") &&
        !relative.includes("debug") &&
        /\bconfidence\b.*%|\bMath\.round\([^)]*confidence[^)]*\)\s*\+\s*["']%["']/.test(lineText)
      ) {
        issues.push(
          `${relative}:${lineNum} — Exposes raw confidence % in primary UI (violates North Star Principle #8).`,
        );
      }
    });

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
      issues.push(
        `${relative} — References Create Opportunity on a company without gating on isOpportunityEligibleCompany / shouldOfferCreateOpportunity.`,
      );
    }

    if (
      relative.startsWith("src/components/") &&
      /(table|list|workspace|directory|grid)/i.test(path.basename(relative))
    ) {
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
        issues.push(
          `${relative} — Filtered list/table lacks AD-001 Filter Transparency (FilterToolbar / FilterTransparencyBar / Showing X of Y).`,
        );
      }
    }
  }

  // Run companion unit tests for touched files
  const companionTests = new Set();
  for (const relative of changedRelFiles) {
    if (relative.endsWith(".test.ts") || relative.endsWith(".test.tsx")) {
      if (fs.existsSync(path.join(ROOT, relative))) {
        companionTests.add(relative);
      }
    } else {
      const candidate = relative.replace(/\.(tsx?)$/, ".test.$1");
      if (fs.existsSync(path.join(ROOT, candidate))) {
        companionTests.add(candidate);
      }
    }
  }

  if (companionTests.size > 0) {
    const testList = [...companionTests];
    const tsxCli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
    const res = spawnSync(
      process.execPath,
      [tsxCli, "--test", ...testList],
      {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 20_000,
      },
    );
    if (res.status !== 0) {
      const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
      const summary = out
        .split(/\r?\n/)
        .filter((l) => /^not ok\b|AssertionError|Error:/i.test(l))
        .slice(0, 4)
        .join(" | ");
      issues.push(
        `Companion unit test failed (${testList.join(", ")}): ${summary || "non-zero exit"}`,
      );
    }
  }

  return issues;
}

function main() {
  readStdin();
  const dirtyFiles = getDirtySrcFiles();
  if (dirtyFiles.length === 0) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const cache = loadCache();
  const newlyChanged = [];

  for (const relFile of dirtyFiles) {
    const full = path.join(ROOT, relFile);
    const h = hashFile(full);
    if (!h) continue;
    if (cache.hashes[relFile] !== h) {
      newlyChanged.push(relFile);
      cache.hashes[relFile] = h;
    }
  }

  if (newlyChanged.length === 0) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  // Keep graphify AST updated asynchronously in the background when code files in src/ change
  try {
    const child = spawn("graphify", ["update", "."], {
      cwd: ROOT,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch {
    // Non-blocking if graphify CLI is busy or unavailable
  }

  const issues = checkChangedFiles(newlyChanged);
  saveCache(cache);

  if (issues.length > 0) {
    const payload = {
      followup_message:
        "SmartCRM self-healing stop gate detected regressions in files modified this turn:\n" +
        issues.map((i) => `- ${i}`).join("\n") +
        "\n\nPlease fix these issues and verify before finishing.",
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    process.exit(0);
  }

  process.stdout.write("{}\n");
  process.exit(0);
}

main();
