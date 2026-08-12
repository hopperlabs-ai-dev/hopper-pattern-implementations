#!/usr/bin/env node
/**
 * Guard: the repository's agent instruction contract is present, findable,
 * and not drifting into fiction.
 *
 * AGENTS.md is the estate's canonical agent instruction file (141/149 repos).
 * This guard asserts, over git-TRACKED files only:
 *   1. AGENTS.md exists at the repository root and is non-empty.
 *   2. Required sections are present (default: Authority, Verification).
 *   3. No AGENT.md exists — the one-letter fork is invisible to every
 *      AGENTS.md-convention agent and splits the contract across two files.
 *   4. AGENTS.md cites no absolute workstation paths (estate rule:
 *      instructions are location-independent).
 *   5. Every repository path cited in an inline code span resolves — to a
 *      tracked file, a tracked directory prefix, or an on-disk path (build
 *      artifacts a gate materializes may legitimately be gitignored).
 *      An instruction that names nothing real is a fiction.
 *   6. CLAUDE.md, when present, is exactly the projection `@AGENTS.md` —
 *      a hand-written summary is a second authority by definition.
 *
 * Exit 0 = clean. Exit 1 = violations (each printed as file:detail).
 * Usage: node check-agent-instructions.mjs [repoRoot] [--config gates.json]
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULTS = {
  requiredSections: ["Authority", "Verification"],
  claudeMode: "projection",
  generatedPathPatterns: ["dist/", "build/", "artifacts/", "node_modules/"],
};

const ABSOLUTE_PATH_PATTERN =
  /(?:^|[\s"'`(])(?:\/Users\/|\/home\/|[A-Za-z]:\\)/u;
const CODE_SPAN_PATTERN = /`([^`\n]+)`/gu;
const PATHISH_PATTERN = /^[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)+\/?$/u;

export function loadConfig(repoRoot, explicitPath) {
  const path = explicitPath ?? join(repoRoot, "gates.json");
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { ...DEFAULTS, ...(parsed.agentInstructions ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

function citedPathCandidates(line) {
  const candidates = [];
  for (const match of line.matchAll(CODE_SPAN_PATTERN)) {
    const span = match[1].trim();
    if (span.length === 0 || span.length > 200) continue;
    if (span.includes("://")) continue; // URL, not a repository path
    if (/[*?<>{}$\s\\]/u.test(span)) continue; // glob, placeholder, or command
    if (!PATHISH_PATTERN.test(span)) continue;
    // Domain-first references (github.com/org/module, registry.io/pkg) are
    // module identifiers, not repository paths — never resolvable locally.
    if (/^[a-z0-9-]+\.[a-z]{2,}$/iu.test(span.split("/")[0])) continue;
    candidates.push(span.replace(/\/$/u, ""));
  }
  return candidates;
}

export function findAgentInstructionViolations({
  files,
  readFile,
  pathExists,
  config,
}) {
  // A repository with nothing tracked yet (bootstrap, pre-first-commit) has
  // nothing to protect; the guard fires from the first tracked file onward.
  if (files.length === 0) return [];

  const violations = [];
  const tracked = new Set(files);
  const generated = (candidate) =>
    (config.generatedPathPatterns ?? []).some(
      (pattern) =>
        candidate.startsWith(pattern) || candidate.includes(`/${pattern}`),
    );
  const exists = (candidate) =>
    generated(candidate) ||
    tracked.has(candidate) ||
    files.some((file) => file.startsWith(`${candidate}/`)) ||
    pathExists(candidate);

  if (tracked.has("AGENT.md")) {
    violations.push(
      "AGENT.md:forbidden (one-letter fork of AGENTS.md — merge it into AGENTS.md)",
    );
  }

  if (!tracked.has("AGENTS.md")) {
    violations.push("AGENTS.md:missing");
    return violations;
  }

  let content;
  try {
    content = readFile("AGENTS.md");
  } catch {
    violations.push("AGENTS.md:unreadable");
    return violations;
  }
  if (content.trim().length === 0) {
    violations.push("AGENTS.md:empty");
    return violations;
  }

  const lines = content.split("\n");
  const headings = lines
    .filter((line) => /^#{1,6}\s/u.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/u, "").toLowerCase());
  for (const section of config.requiredSections) {
    const wanted = section.toLowerCase();
    if (!headings.some((heading) => heading.includes(wanted))) {
      violations.push(`AGENTS.md:missing-section:${section}`);
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (ABSOLUTE_PATH_PATTERN.test(line)) {
      violations.push(`AGENTS.md:${i + 1}:absolute-path`);
    }
    for (const candidate of citedPathCandidates(line)) {
      if (!exists(candidate)) {
        violations.push(`AGENTS.md:${i + 1}:unresolved-path:${candidate}`);
      }
    }
  }

  if (config.claudeMode === "projection" && tracked.has("CLAUDE.md")) {
    let claude;
    try {
      claude = readFile("CLAUDE.md");
    } catch {
      claude = null;
    }
    if (claude !== null && claude.trim() !== "@AGENTS.md") {
      violations.push(
        "CLAUDE.md:not-a-projection (must be exactly `@AGENTS.md`; a hand-written summary is a second authority)",
      );
    }
  }

  return violations;
}

function main() {
  const repoRoot =
    process.argv[2] && !process.argv[2].startsWith("--")
      ? process.argv[2]
      : process.cwd();
  const configFlag = process.argv.indexOf("--config");
  const config = loadConfig(
    repoRoot,
    configFlag === -1 ? undefined : process.argv[configFlag + 1],
  );
  if (config.enabled === false) return;
  const files = execFileSync("git", ["-C", repoRoot, "ls-files"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean);
  const violations = findAgentInstructionViolations({
    files,
    readFile: (file) => readFileSync(join(repoRoot, file), "utf8"),
    pathExists: (candidate) => existsSync(join(repoRoot, candidate)),
    config,
  });
  if (violations.length > 0) {
    process.stderr.write(
      `estate-gates/check-agent-instructions: ${violations.length} violation(s)\n`,
    );
    for (const violation of violations.slice(0, 50))
      process.stderr.write(`  ${violation}\n`);
    if (violations.length > 50)
      process.stderr.write(`  … and ${violations.length - 50} more\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
