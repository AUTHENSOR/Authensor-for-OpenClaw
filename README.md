# Authensor for OpenClaw (Hosted Beta)

**One job:** make marketplace skills fail-closed so your keys don’t get used without you knowing.

## 3-Step Quickstart
1. Install the **Authensor Gateway** skill from the OpenClaw marketplace.
2. Request a demo key (email delivered).
3. Paste the key once, start a new session, and run any marketplace skill. It will be blocked by default and a receipt will be created.

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

If you use sandboxed OpenClaw sessions, also add:

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

## What You Get
- Marketplace skills **fail-closed** by default.
- Every attempt creates a **receipt** you can review.
- Hosted control plane, no local database or server required.

## Demo Tier Limits
- Sandbox mode only (no real API calls)
- Tight rate limits
- Short receipt retention

## Request Demo Key
This repo includes a tiny form + API that emails demo keys.

### Deploy the key-issuer
Set env vars:
- `CONTROL_PLANE_URL`
- `AUTHENSOR_ADMIN_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM`

Start locally:
```bash
npm install
npm start
```

Open `http://localhost:3000` and request a key.

## OpenClaw References
- Skills config: `https://docs.openclaw.ai/tools/skills-config`
- Onboarding wizard: `https://docs.openclaw.ai/start/wizard`
