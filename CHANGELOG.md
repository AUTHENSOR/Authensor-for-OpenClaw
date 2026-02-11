# Changelog

## [0.5.0] - 2026-02-11

### Added
- **Agent Protocol (MANDATORY)** section in SKILL.md — explicit step-by-step instructions the agent follows to call `/decide` before every tool call
- **Action Classification Reference** — detailed mapping table for edge cases (git ops, sudo, chmod, secret files, docker, curl/wget)
- **Default policy** (`policies/default.json`) — 10-rule deny-by-default policy shipped with the repo
- **Policy schema** (`policies/schema.json`) — JSON Schema for policy validation with `all`/`any` condition logic
- **Smoke test script** (`scripts/test-policy.sh`) — automated curl-based test against the control plane (health + 8 policy decisions)
- **Custom Policies** section in README — how to write and upload custom rules
- **Architecture diagram** in README — visual flow from user → agent → control plane → decision
- **Audit trail examples** in README — curl commands to query receipts
- **Badges** in README — version, license, ClawHub marketplace link
- **Repo Layout** section in README — file-by-file guide
- `/decide` endpoint documented in Control Plane API table

### Changed
- README restructured: added repo layout, custom policy guide, receipt viewer, smoke test instructions
- Control Plane API section now documents the `/decide` decision endpoint (the core agent-facing API)

## [0.4.0] - 2026-02-11

### Added
- **"When to Use This"** section — who the skill is for, with ClawHavoc context
- **"What Gets Caught"** table — 8 concrete examples of tool calls and their policy outcomes
- **"Verify It's Working"** section — step-by-step test after setup
- **Troubleshooting** section — 5 common issues with solutions
- **Control Plane API** documentation — all REST endpoints used by the skill and Apps Script
- Collapsible troubleshooting in README

### Changed
- Demo key email now sends only the executor key (previously sent both ingest + executor)
- Email includes copy-pasteable JSON config block instead of compact one-liner
- Email subject changed from "Demo Keys" to "Demo Key" (singular)

### Fixed
- Users no longer receive an unnecessary ingest key they don't need for OpenClaw

## [0.3.0] - 2026-02-11

### Changed
- **Honest enforcement language** — replaced "the agent cannot bypass the gate" with accurate description of prompt-level enforcement model
- Added **Limitations** section documenting what Authensor can and cannot do today
- Added **How Enforcement Works** section explaining prompt-level vs code-level enforcement

### Added
- MIT LICENSE file
- This CHANGELOG
- Link to OpenClaw hook proposal (Issue #10502) for future code-level enforcement

### Removed
- Empty `public/` directory

## [0.2.0] - 2026-02-11

### Changed
- Moved `requires.env` to top-level frontmatter (fixes ClawHub registry metadata mismatch)
- Added `disable-model-invocation: true` (agent cannot load skill autonomously)

### Added
- **Runtime Behavior** section with exact data flow
- **What Data Is Sent / What Data Is Stored** transparency sections
- **Security Notes** table
- Action-level email cooldown to prevent approval spam (`APPROVAL_ACTION_COOLDOWN_MINUTES`)

## [0.1.0] - 2026-01-15

### Added
- Initial release
- Instruction-only skill manifest (SKILL.md)
- Google Apps Script for demo key issuance via Google Form
- Email-based approval flow with HMAC-signed links
- Rate limit webhook receiver
- Policy missing webhook receiver
- Demo key auto-expiry and upgrade emails
- "Always allow" policy mutation from approval emails
