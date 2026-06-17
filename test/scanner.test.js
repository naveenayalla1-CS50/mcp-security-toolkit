import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanTarget } from "../src/scanner.js";

test("safe example reports MCP config without high-risk findings", async () => {
  const report = await scanTarget(new URL("../examples/safe-filesystem-mcp", import.meta.url).pathname);

  assert.equal(report.summary.high, 0);
  assert.equal(report.summary.riskLevel, "LOW");
  assert.ok(report.findings.some((finding) => finding.title === "MCP server configuration detected"));
});

test("unsafe example reports high-risk findings", async () => {
  const report = await scanTarget(new URL("../examples/unsafe-filesystem-mcp", import.meta.url).pathname);

  assert.equal(report.summary.riskLevel, "HIGH");
  assert.ok(report.summary.high >= 3);
  assert.ok(report.findings.some((finding) => finding.title.includes("bash")));
  assert.ok(report.findings.some((finding) => finding.title.includes("GITHUB_TOKEN")));
});

test("scanner handles a single JSON file target", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-sec-"));
  const configPath = path.join(directory, "mcp.json");

  await fs.writeFile(configPath, JSON.stringify({
    mcpServers: {
      demo: {
        command: "node",
        tools: {
          write_file: true
        }
      }
    }
  }));

  const report = await scanTarget(configPath);

  assert.equal(report.scannedFiles, 1);
  assert.equal(report.summary.riskLevel, "HIGH");
  assert.ok(report.findings.some((finding) => finding.title.includes("write_file")));
});

test("scanner ignores invalid JSON but still scans text", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-sec-"));
  const configPath = path.join(directory, "broken.json");

  await fs.writeFile(configPath, "{ command: \"bash -lc\" ");

  const report = await scanTarget(configPath);

  assert.equal(report.summary.riskLevel, "HIGH");
  assert.ok(report.findings.some((finding) => finding.title.includes("bash")));
});
