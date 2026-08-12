#!/usr/bin/env node
/**
 * Guard: file line-count ceiling (estate standard: 800 max; split, never bump).
 *
 * Scans the exact git index that would be committed. New files may not exceed
 * the ceiling. A legacy tracked file already above the ceiling may shrink or
 * stay unchanged, but may never grow. This migration-safe ratchet prevents
 * new debt without making adoption impossible for an existing repository.
 *
 * Exit 0 = clean. Exit 1 = violations (file:lines/ceiling).
 * Usage: node check-file-sizes.mjs [repoRoot] [--config gates.json]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULTS = {
  maxLines: 800,
  extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs"],
  excludePathPatterns: ["/dist/", "/generated/", ".gen.", "/vendor/"],
};

export function loadConfig(repoRoot, explicitPath) {
  const path = explicitPath ?? join(repoRoot, "gates.json");
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { ...DEFAULTS, ...(parsed.fileSize ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

export function findViolations({
  files,
  countLines,
  baselineLines = () => undefined,
  config,
}) {
  const violations = [];
  for (const file of files) {
    if (!config.extensions.some((ext) => file.endsWith(ext))) continue;
    const excluded = config.excludePathPatterns.some((pattern) =>
      `/${file}`.includes(pattern),
    );
    if (excluded) continue;
    let lines;
    try {
      lines = countLines(file);
    } catch {
      continue;
    }
    const baseline = baselineLines(file);
    const exceedsCeiling = lines > config.maxLines;
    const isNewDebt = baseline === undefined || baseline <= config.maxLines;
    const enlargesLegacyDebt = baseline !== undefined && lines > baseline;
    if (exceedsCeiling && (isNewDebt || enlargesLegacyDebt))
      violations.push(`${file}:${lines}/${config.maxLines}`);
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
  const files = execFileSync("git", ["-C", repoRoot, "ls-files", "--cached"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean);
  const violations = findViolations({
    files,
    countLines: (file) => countGitLines(repoRoot, `:${file}`),
    baselineLines: (file) => {
      try {
        return countGitLines(repoRoot, `HEAD:${file}`);
      } catch {
        return undefined;
      }
    },
    config,
  });
  if (violations.length > 0) {
    process.stderr.write(
      `estate-gates/check-file-sizes: ${violations.length} new or enlarged file(s) over ceiling — split them, do not raise the ceiling\n`,
    );
    for (const violation of violations.slice(0, 50))
      process.stderr.write(`  ${violation}\n`);
    process.exit(1);
  }
}

function countGitLines(repoRoot, objectName) {
  return execFileSync("git", ["-C", repoRoot, "show", objectName], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).split("\n").length;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
