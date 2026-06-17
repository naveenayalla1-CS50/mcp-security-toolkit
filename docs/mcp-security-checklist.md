# MCP Security Checklist

Use this checklist before connecting an MCP server to an AI agent.

## Tool Scope

- [ ] Does the server expose only the tools the agent truly needs?
- [ ] Are read-only tools separated from write/action tools?
- [ ] Are destructive actions such as delete, overwrite, send, deploy, or execute gated?
- [ ] Are tool names clear enough for a reviewer to understand their risk?

## Filesystem Access

- [ ] Is filesystem access scoped to a project directory?
- [ ] Is access to home directories blocked?
- [ ] Is access to `.ssh`, `.aws`, `.azure`, credentials, downloads, and desktop folders blocked?
- [ ] Are write actions disabled by default?

## Shell and Process Execution

- [ ] Does the server run shell commands?
- [ ] Are commands allowlisted?
- [ ] Are arguments validated?
- [ ] Is execution sandboxed?
- [ ] Is human approval required for command execution?

## Secrets

- [ ] Are secrets loaded from a secure secret store?
- [ ] Are secrets redacted from logs?
- [ ] Are secrets redacted from tool responses?
- [ ] Are `.env` files excluded from source control?
- [ ] Are tokens scoped to the minimum required permissions?

## Network and APIs

- [ ] Does the server call external APIs?
- [ ] Are outbound destinations restricted?
- [ ] Are API keys scoped and rotated?
- [ ] Are write actions to external systems approved by a human?

## Prompt Injection

- [ ] Can untrusted content influence tool calls?
- [ ] Can data from files, web pages, tickets, or emails instruct the agent to call tools?
- [ ] Are system/tool instructions separated from untrusted data?
- [ ] Are high-risk actions confirmed outside the model response?

## Logging and Audit

- [ ] Are tool calls logged?
- [ ] Are failed tool calls logged?
- [ ] Are sensitive values redacted?
- [ ] Can a reviewer trace who/what triggered an action?

## Production Readiness

- [ ] Is there a clear owner?
- [ ] Is there a documented approval policy?
- [ ] Are risky tools disabled by default?
- [ ] Are dependencies updated?
- [ ] Is the server reviewed before connecting to customer or production data?
