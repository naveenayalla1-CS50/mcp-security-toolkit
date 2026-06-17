# MCP Server Threat Model

## Assets

- Source code and private repositories
- Local files and user directories
- API tokens and cloud credentials
- Customer data and internal data
- CI/CD workflows
- Tickets, docs, messages, and business systems

## Trust Boundaries

- AI agent to MCP client
- MCP client to MCP server
- MCP server to local filesystem
- MCP server to shell/process runtime
- MCP server to external APIs
- MCP server to internal systems

## Common Risks

### Prompt Injection

Untrusted content can instruct an agent to call a powerful MCP tool, leak a secret, modify files, or trigger an external action.

### Over-Permissioned Tools

An MCP server may expose broad tools such as `run_shell_command`, `write_file`, or `delete_file` when the workflow only needs read-only access.

### Secret Exposure

Servers may read environment variables, config files, or credentials and return them through logs or tool responses.

### Unsafe Local Execution

Shell tools can execute commands produced or influenced by untrusted content.

### Missing Approval Gates

Autonomous agents may perform write actions without a separate human confirmation step.

## Recommended Controls

- Least-privilege tool design
- Read-only mode by default
- Approval gates for high-risk tools
- Filesystem sandboxing
- Secret redaction
- Allowlisted commands and paths
- Audit logging
- CI scanning for risky configs
- Regular dependency updates
