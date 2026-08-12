#!/usr/bin/env node
/**
 * Guard: no console.log in production code.
 *
 * Scans git-TRACKED files only (never node_modules or untracked artifacts).
 * Exemptions: configured path patterns (tests, scripts, bin, cli, demos) and
 * lines carrying the allow marker for deliberate, reviewed logging.
 *
 * Exit 0 = clean. Exit 1 = violations (each printed as file:line).
 * Usage: node check-console-log.mjs [repoRoot] [--config gates.json]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULTS = {
  extensions: [".ts", ".tsx", ".mts", ".cts"],
  excludePathPatterns: [
    "/scripts/",
    "/bin/",
    "/cli/",
    ".test.",
    ".spec.",
    "/test/",
    "/tests/",
    "/demos/",
    "/examples/",
  ],
  allowMarker: "estate-gates-allow-console",
};

export function loadConfig(repoRoot, explicitPath) {
  const path = explicitPath ?? join(repoRoot, "gates.json");
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { ...DEFAULTS, ...(parsed.consoleLog ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

export function findViolations({ files, readFile, config }) {
  const violations = [];
  for (const file of files) {
    if (!config.extensions.some((ext) => file.endsWith(ext))) continue;
    const excluded = config.excludePathPatterns.some((pattern) =>
      `/${file}`.includes(pattern),
    );
    if (excluded) continue;
    let content;
    try {
      content = readFile(file);
    } catch {
      continue; // deleted since listing; not this guard's concern
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!/\bconsole\.log\s*\(/.test(line)) continue;
      if (line.includes(config.allowMarker)) continue;
      violations.push(`${file}:${i + 1}`);
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
  const files = execFileSync("git", ["-C", repoRoot, "ls-files"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean);
  const violations = findViolations({
    files,
    readFile: (file) => readFileSync(join(repoRoot, file), "utf8"),
    config,
  });
  if (violations.length > 0) {
    process.stderr.write(
      `estate-gates/check-console-log: ${violations.length} violation(s)\n`,
    );
    for (const violation of violations.slice(0, 50))
      process.stderr.write(`  ${violation}\n`);
    if (violations.length > 50)
      process.stderr.write(`  … and ${violations.length - 50} more\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
