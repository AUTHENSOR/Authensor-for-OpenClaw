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

## How Approvals Work (No Pain)
- **Low-risk actions run automatically.**
- **High-risk actions require owner confirmation** (approval) before execution.
- **Known-dangerous actions are blocked.**

That means you’re not approving every single step — only the risky ones.

## Demo Tier Limits
- Sandbox mode only (no real API calls)
- Tight rate limits
- Short receipt retention
- Custom policies unlocked on paid tiers
- Demo keys auto-expire after 7 days (upgrade email sent)

## Get Demo Key Access
Form: https://forms.gle/QdfeWAr2G4pc8GxQA

We use **Google Form + Apps Script** so there’s no public API to run.
See `apps-script/README.md` to set it up in under 10 minutes.

## Approvals by Email
Approvals can be handled by email with signed links (no UI required).
Setup is in `apps-script/README.md`.

## Marketplace Stub
This repo includes a tiny marketplace stub skill in `skills/authensor-gateway`. You can publish that stub and point the listing back here as the canonical landing page.

## OpenClaw References
- Skills config: `https://docs.openclaw.ai/tools/skills-config`
- Onboarding wizard: `https://docs.openclaw.ai/start/wizard`
