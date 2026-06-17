import process from "node:process";
import { scanTarget } from "./scanner.js";

const HELP = `mcp-sec

Security scanner for MCP servers and AI-agent tool configurations.

Usage:
  mcp-sec scan [path] [--json]
  mcp-sec help
  mcp-sec version

Examples:
  mcp-sec scan .
  mcp-sec scan ./examples/unsafe-filesystem-mcp
  mcp-sec scan ./mcp.json --json
`;

export async function runCli(args) {
  const command = args[0] ?? "help";

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    console.log("0.1.0");
    return;
  }

  if (command !== "scan") {
    throw new Error(`unknown command "${command}". Run "mcp-sec help".`);
  }

  const json = args.includes("--json");
  const target = args.find((arg, index) => index > 0 && !arg.startsWith("-")) ?? ".";
  const report = await scanTarget(target);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printTextReport(report);

  if (report.summary.high > 0) {
    process.exitCode = 2;
  }
}

function printTextReport(report) {
  console.log(`MCP Security Scan`);
  console.log(`Target: ${report.target}`);
  console.log(`Risk level: ${report.summary.riskLevel}`);
  console.log(`Findings: ${report.summary.total} total, ${report.summary.high} high, ${report.summary.medium} medium, ${report.summary.low} low`);
  console.log("");

  if (report.findings.length === 0) {
    console.log("No MCP security findings detected.");
    return;
  }

  for (const finding of report.findings) {
    console.log(`[${finding.severity}] ${finding.title}`);
    console.log(`File: ${finding.file}`);
    console.log(`Why: ${finding.reason}`);
    console.log(`Recommendation: ${finding.recommendation}`);
    console.log("");
  }
}
