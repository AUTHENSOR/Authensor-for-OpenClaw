---
name: Authensor Gateway
version: 0.2.0
description: >
  Fail-safe policy gate for OpenClaw marketplace skills.
  Intercepts tool calls before execution and checks them against
  your Authensor policy. Low-risk actions run automatically.
  High-risk actions require your approval. Dangerous actions are blocked.
  Only action metadata is sent to the control plane — never your files,
  API keys, or conversation content.
disable-model-invocation: true
requires:
  env:
    - CONTROL_PLANE_URL
    - AUTHENSOR_API_KEY
metadata:
  openclaw:
    skillKey: authensor-gateway
    homepage: https://github.com/AUTHENSOR/Authensor-for-OpenClaw
    marketplace: https://www.clawhub.ai/AUTHENSOR/authensor-gateway
    primaryEnv: AUTHENSOR_API_KEY
---

# Authensor Gateway

A lightweight policy gate that checks every OpenClaw tool call against your Authensor policy before it executes.

- **Low-risk actions** (read files, search, grep) — run automatically
- **High-risk actions** (write files, run commands, network requests) — require your approval
- **Dangerous actions** (delete, overwrite, access secrets) — blocked by default

Source code: https://github.com/AUTHENSOR/Authensor-for-OpenClaw

## Runtime Behavior

This skill is **instruction-only** — it contains no executable code, no install scripts, and writes nothing to disk. It works by adding policy-check instructions to the agent's system prompt.

When the agent attempts a tool call, the following happens:

1. The agent sends a **policy check request** to the Authensor control plane
2. The control plane evaluates the request against your policy and returns: `allow`, `deny`, or `require_approval`
3. If `require_approval`: the agent pauses and waits for you to approve or reject (via email link, dashboard, or CLI)
4. The agent only proceeds if the action is explicitly allowed

**The agent cannot bypass the gate.** If the control plane is unreachable, all actions are denied (fail-closed).

## What Data Is Sent to the Control Plane

**Sent** (action metadata only):
- Action type (e.g. `filesystem.write`, `code.exec`, `network.http`)
- Resource path (e.g. `/tmp/output.txt`, `https://api.example.com`)
- Tool name (e.g. `Bash`, `Write`, `Read`)
- Your Authensor API key (for authentication)

**Never sent:**
- Your AI provider API keys (Anthropic, OpenAI, etc.)
- File contents or conversation history
- Environment variables (other than `AUTHENSOR_API_KEY`)
- Any data from your filesystem

The control plane returns a single decision (`allow` / `deny` / `require_approval`) and a receipt ID. That's it.

## What Data Is Stored

The Authensor control plane stores:
- **Receipts**: action type, resource, outcome, timestamp (for audit trail)
- **Policy rules**: your allow/deny/require_approval rules

Receipts are retained for a limited period (7 days on demo tier). No file contents, conversation data, or provider API keys are ever stored.

## Setup

1. Get a demo key: https://forms.gle/QdfeWAr2G4pc8GxQA
2. Add the env vars to `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    entries: {
      "authensor-gateway": {
        enabled: true,
        env: {
          CONTROL_PLANE_URL: "https://authensor-control-plane.onrender.com",
          AUTHENSOR_API_KEY: "authensor_demo_..."
        }
      }
    }
  }
}
```

## Security Notes

- **Instruction-only**: No code is installed, no files are written, no processes are spawned
- **User-invoked only**: `disable-model-invocation: true` means the agent cannot load this skill autonomously — only you can enable it
- **Fail-closed**: If the control plane is unreachable, actions are denied (not allowed)
- **Minimal data**: Only action metadata (type + resource) is transmitted — never file contents or secrets
- **Open source**: Full source at https://github.com/AUTHENSOR/Authensor-for-OpenClaw
- **Required env vars declared**: `CONTROL_PLANE_URL` and `AUTHENSOR_API_KEY` are explicitly listed in the `requires.env` frontmatter
