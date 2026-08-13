#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDeclaredScenarios } from "../../../packages/idea-reasoning-runtime/src/index.mjs";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(await readFile(path.join(directory, "fixture.json"), "utf8"));
const result = evaluateDeclaredScenarios(fixture);
if (result.status !== "passed") process.exitCode = 1;
console.log(JSON.stringify(result, null, 2));
