# Authensor for OpenClaw (Hosted Beta)

**One job:** stop risky marketplace actions from running without you knowing.

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
          CONTROL_PLANE_URL: "https://authensor-control-plane.onrender.com",
          AUTHENSOR_API_KEY: "authensor_demo_..."
        }
      }
    }
  }
}
```

Sandboxed OpenClaw sessions (optional):

<details>
<summary>Sandboxed sessions (optional)</summary>

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          env: {
            CONTROL_PLANE_URL: "https://authensor-control-plane.onrender.com",
            AUTHENSOR_API_KEY: "authensor_demo_..."
          }
        }
      }
    }
  }
}
```
</details>

## How It Works (Runtime Behavior)

This skill is **instruction-only** — no executable code, no install scripts, nothing written to disk. It adds policy-check instructions to the agent's system prompt.

When the agent attempts a tool call:

1. A **policy check request** is sent to the Authensor control plane
2. The control plane evaluates it against your policy and returns: `allow`, `deny`, or `require_approval`
3. If `require_approval`: the agent pauses and waits for you to approve or reject
4. The agent only proceeds if the action is explicitly allowed

**Fail-closed:** If the control plane is unreachable, all actions are denied.

### What data is sent to the control plane

**Sent** (action metadata only):
| Field | Example | Purpose |
|-------|---------|---------|
| Action type | `filesystem.write` | Policy matching |
| Resource path | `/tmp/output.txt` | Policy matching |
| Tool name | `Bash` | Classification |
| Authensor API key | `authensor_demo_...` | Authentication |

**Never sent:**
- Your AI provider API keys (Anthropic, OpenAI, etc.)
- File contents or conversation history
- Environment variables (other than `AUTHENSOR_API_KEY`)
- Any data from your filesystem

The control plane returns a single decision (`allow` / `deny` / `require_approval`) and a receipt ID. That's it.

### What data is stored

- **Receipts**: action type, resource, outcome, timestamp (for your audit trail)
- **Policy rules**: your allow/deny/require_approval rules

Receipts are retained for a limited period (7 days on demo tier). No file contents, conversation data, or provider API keys are ever stored.

## How Approvals Work (No Pain)
- **Low-risk actions run automatically.**
- **High-risk actions require owner confirmation** (approval) before execution.
- **Known-dangerous actions are blocked.**

That means you're not approving every single step — only the risky ones.

## Security

| Property | Detail |
|----------|--------|
| **Instruction-only** | No code installed, no files written, no processes spawned |
| **User-invoked only** | `disable-model-invocation: true` — the agent cannot load this skill autonomously |
| **Fail-closed** | Unreachable control plane = all actions denied |
| **Minimal data** | Only action metadata (type + resource) transmitted |
| **Open source** | Full source in this repo |
| **Env vars declared** | `CONTROL_PLANE_URL` and `AUTHENSOR_API_KEY` in `requires.env` frontmatter |

## Demo Tier Limits
- Sandbox mode only (no real API calls)
- Tight rate limits
- Short receipt retention (7 days)
- Custom policies unlocked on paid tiers
- Demo keys auto-expire after 7 days (upgrade email sent)
 - Optional email domain allowlist for demo keys (see `apps-script/README.md`)

## Get Demo Key Access
Form: https://forms.gle/QdfeWAr2G4pc8GxQA

We use **Google Form + Apps Script** so there's no public API to run.
See `apps-script/README.md` to set it up in under 10 minutes.

## Approvals by Email
Approvals can be handled by email with signed links (no UI required).
Setup is in `apps-script/README.md`.

## Marketplace Stub
This repo includes a tiny marketplace stub skill in `skills/authensor-gateway`. You can publish that stub and point the listing back here as the canonical landing page.

## OpenClaw References
- Skills config: `https://docs.openclaw.ai/tools/skills-config`
- Onboarding wizard: `https://docs.openclaw.ai/start/wizard`
