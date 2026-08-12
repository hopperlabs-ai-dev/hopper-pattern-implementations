#!/usr/bin/env node
/**
 * Guard: Hopper Secrets is the only active Hopper secret/signing custody.
 *
 * Scans the exact Git index. It has no disable flag, legacy switch, or path
 * allowlist. Only closed non-runtime classifications owned by Conventions are
 * exempt: the policy implementation itself, its negative fixtures, and an
 * explicitly archived evidence tree.
 */

import { execFileSync } from "node:child_process";

const TEXT_EXTENSIONS = [
  ".c",
  ".cc",
  ".cjs",
  ".cpp",
  ".cts",
  ".entitlements",
  ".h",
  ".hpp",
  ".js",
  ".json",
  ".m",
  ".md",
  ".mjs",
  ".mm",
  ".mts",
  ".plist",
  ".sh",
  ".swift",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
];

const PROHIBITED = [
  {
    ruleId: "security.custody.apple-secure-enclave-prohibited",
    expression:
      /kSecAttrTokenIDSecureEnclave|SecureEnclaveKeyStore|secure-enclave-provider/gu,
  },
  {
    ruleId: "security.custody.apple-keychain-secret-custody-prohibited",
    expression:
      /kSecClassGenericPassword|KeychainTokenStore|SecKeyCreateRandomKey/gu,
  },
  {
    ruleId: "security.custody.legacy-device-assurance-prohibited",
    expression: /device-bound\+yubikey-presence/gu,
  },
];

export function findPlatformCustodyViolations({ files, readFile }) {
  const violations = [];
  for (const file of files) {
    if (!TEXT_EXTENSIONS.some((extension) => file.endsWith(extension))) {
      continue;
    }
    if (isClosedEvidencePath(file)) continue;
    let content;
    try {
      content = readFile(file);
    } catch {
      continue;
    }
    const lineStarts = indexLineStarts(content);
    for (const pattern of PROHIBITED) {
      pattern.expression.lastIndex = 0;
      for (const match of content.matchAll(pattern.expression)) {
        if (match.index === undefined) continue;
        violations.push(
          `${file}:${String(lineNumberAt(lineStarts, match.index))}:${pattern.ruleId}`,
        );
      }
    }
  }
  return violations;
}

function isClosedEvidencePath(file) {
  return (
    file.startsWith("docs/archive/") ||
    file.startsWith("tests/fixtures/platform-custody/") ||
    file === "tests/platform-custody-policy.test.ts" ||
    file === "packages/estate-gates/test/guards.test.mjs" ||
    file === "docs/adr/0038-hopper-secrets-only-platform-custody.md" ||
    file === "packages/core/src/security/platform-custody-policy.ts" ||
    file === "packages/estate-gates/guards/check-platform-custody.mjs" ||
    file === ".githooks/estate-gates/check-platform-custody.mjs"
  );
}

function indexLineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

function lineNumberAt(lineStarts, index) {
  let lower = 0;
  let upper = lineStarts.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (lineStarts[middle] <= index) lower = middle + 1;
    else upper = middle;
  }
  return lower;
}

function main() {
  const repoRoot = process.argv[2] ?? process.cwd();
  const files = execFileSync("git", ["-C", repoRoot, "ls-files", "--cached"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean);
  const violations = findPlatformCustodyViolations({
    files,
    readFile: (file) =>
      execFileSync("git", ["-C", repoRoot, "show", `:${file}`], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      }),
  });
  if (violations.length > 0) {
    process.stderr.write(
      `estate-gates/check-platform-custody: ${String(violations.length)} prohibited active custody finding(s)\n`,
    );
    for (const violation of violations.slice(0, 100)) {
      process.stderr.write(`  ${violation}\n`);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
