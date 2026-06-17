import fs from "node:fs/promises";
import path from "node:path";

const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".turbo"]);
const MAX_FILE_BYTES = 1024 * 1024;

const HIGH_RISK_TOOL_WORDS = [
  "exec",
  "shell",
  "terminal",
  "delete",
  "remove",
  "write",
  "overwrite",
  "env",
  "secret",
  "token",
  "credential",
  "password"
];

const HIGH_RISK_COMMANDS = [
  "bash",
  "sh",
  "zsh",
  "powershell",
  "cmd",
  "python -c",
  "node -e",
  "rm ",
  "curl ",
  "wget ",
  "chmod ",
  "docker "
];

const SECRET_WORDS = ["TOKEN", "SECRET", "PASSWORD", "API_KEY", "PRIVATE_KEY", "CREDENTIAL", "CONNECTION_STRING"];
const SENSITIVE_PATHS = ["~", ".ssh", ".aws", ".azure", "Desktop", "Documents"];

export async function scanTarget(inputTarget) {
  const target = path.resolve(inputTarget);
  const stat = await fs.stat(target).catch(() => {
    throw new Error(`target does not exist: ${inputTarget}`);
  });
  const files = stat.isDirectory() ? await collectFiles(target) : [target];
  const findings = [];

  for (const file of files) {
    const relative = path.relative(target, file) || path.basename(file);
    const fileFindings = await scanFile(file, relative);
    findings.push(...fileFindings);
  }

  return {
    target,
    scannedFiles: files.length,
    summary: summarize(findings),
    findings
  };
}

async function collectFiles(root) {
  const files = [];

  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
        continue;
      }

      if (isInterestingFile(entry.name)) {
        const stat = await fs.stat(fullPath);
        if (stat.size <= MAX_FILE_BYTES) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(root);
  return files;
}

function isInterestingFile(name) {
  return (
    name === "package.json" ||
    name === ".env" ||
    name === ".env.example" ||
    name.endsWith(".json") ||
    name.endsWith(".mjs") ||
    name.endsWith(".js") ||
    name.endsWith(".ts") ||
    name.endsWith(".yaml") ||
    name.endsWith(".yml")
  );
}

async function scanFile(file, relative) {
  const content = await fs.readFile(file, "utf8");
  const findings = [];

  findings.push(...scanText(content, relative));

  if (file.endsWith(".json") || path.basename(file) === "package.json") {
    const parsed = safeJsonParse(content);
    if (parsed) {
      findings.push(...scanJson(parsed, relative));
    }
  }

  return findings;
}

function scanText(content, file) {
  const findings = [];
  const lower = content.toLowerCase();

  for (const command of HIGH_RISK_COMMANDS) {
    if (containsCommand(lower, command)) {
      findings.push(finding({
        severity: "HIGH",
        title: `Potential command execution detected: ${command.trim()}`,
        file,
        reason: "AI-agent tool access to shell commands can execute untrusted instructions or mutate local systems.",
        recommendation: "Require explicit approval, sandbox execution, and restrict this tool for autonomous agents."
      }));
    }
  }

  for (const secret of SECRET_WORDS) {
    if (content.includes(secret)) {
      findings.push(finding({
        severity: "MEDIUM",
        title: `Potential secret reference detected: ${secret}`,
        file,
        reason: "MCP servers that read or forward secrets can expose credentials through prompts, logs, or tool output.",
        recommendation: "Load secrets through a secure secret store and redact sensitive values from logs and responses."
      }));
    }
  }

  for (const sensitivePath of SENSITIVE_PATHS) {
    if (content.includes(sensitivePath)) {
      findings.push(finding({
        severity: "MEDIUM",
        title: `Broad or sensitive path reference detected: ${sensitivePath}`,
        file,
        reason: "Broad filesystem access can expose private files to an AI agent or prompt-injection workflow.",
        recommendation: "Scope filesystem access to a dedicated project directory or read-only working folder."
      }));
    }
  }

  return dedupeFindings(findings);
}

function scanJson(value, file) {
  const findings = [];

  walkJson(value, [], (keyPath, node) => {
    const key = keyPath.at(-1) ?? "";

    if (typeof key === "string" && key.toLowerCase() === "mcpservers" && isObject(node)) {
      findings.push(finding({
        severity: "LOW",
        title: "MCP server configuration detected",
        file,
        reason: "This file configures MCP servers that may expose tools to AI agents.",
        recommendation: "Review every configured server for tool scope, secrets, filesystem access, and approval requirements."
      }));
    }

    const lowerKey = typeof key === "string" ? key.toLowerCase() : "";
    if (lowerKey !== "env" && HIGH_RISK_TOOL_WORDS.some((word) => lowerKey.includes(word))) {
      findings.push(finding({
        severity: "HIGH",
        title: `Risky tool or setting name detected: ${key}`,
        file,
        reason: "Tool names that imply shell, write, delete, or secret access are high-risk when exposed to autonomous agents.",
        recommendation: "Use least privilege, add approval gates, and disable this tool unless the workflow requires it."
      }));
    }

    if (typeof node === "string") {
      const lowered = node.toLowerCase();
      if (node === "/") {
        findings.push(finding({
          severity: "MEDIUM",
          title: "Broad filesystem root path detected",
          file,
          reason: "Root filesystem access can expose private files to an AI agent or prompt-injection workflow.",
          recommendation: "Scope filesystem access to a dedicated project directory or read-only working folder."
        }));
      }

      for (const command of HIGH_RISK_COMMANDS) {
        if (containsCommand(lowered, command)) {
          findings.push(finding({
            severity: "HIGH",
            title: `Risky command configured: ${command.trim()}`,
            file,
            reason: "Configured MCP commands can execute local or network operations when invoked by an AI agent.",
            recommendation: "Prefer read-only tools, sandbox execution, and approval policies for command-running tools."
          }));
        }
      }
    }
  });

  return dedupeFindings(findings);
}

function walkJson(node, keyPath, visit) {
  visit(keyPath, node);

  if (Array.isArray(node)) {
    node.forEach((child, index) => walkJson(child, [...keyPath, String(index)], visit));
    return;
  }

  if (isObject(node)) {
    for (const [key, child] of Object.entries(node)) {
      walkJson(child, [...keyPath, key], visit);
    }
  }
}

function summarize(findings) {
  const high = findings.filter((finding) => finding.severity === "HIGH").length;
  const medium = findings.filter((finding) => finding.severity === "MEDIUM").length;
  const low = findings.filter((finding) => finding.severity === "LOW").length;
  const riskLevel = high > 0 ? "HIGH" : medium > 0 ? "MEDIUM" : low > 0 ? "LOW" : "PASS";

  return {
    riskLevel,
    total: findings.length,
    high,
    medium,
    low
  };
}

function finding({ severity, title, file, reason, recommendation }) {
  return {
    severity,
    title,
    file,
    reason,
    recommendation
  };
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function dedupeFindings(findings) {
  const seen = new Set();
  const deduped = [];

  for (const finding of findings) {
    const key = `${finding.severity}:${finding.title}:${finding.file}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(finding);
    }
  }

  return deduped;
}

function containsCommand(text, command) {
  const normalized = command.trim().toLowerCase();
  if (normalized.length <= 3 && /^[a-z]+$/.test(normalized)) {
    return new RegExp(`(^|[^a-z0-9_-])${escapeRegExp(normalized)}([^a-z0-9_-]|$)`).test(text);
  }

  return text.includes(command.toLowerCase());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
