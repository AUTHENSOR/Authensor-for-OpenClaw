# Changelog

## [0.5.1] - 2026-02-11

### Changed
- **IP protection**: Moved proprietary implementation details to private repos
- Removed `policies/` directory (policy schema and defaults are server-side)
- Removed `apps-script/` directory (admin automation is private)
- Removed `scripts/` directory
- Stripped detailed action classification reference from SKILL.md (classification is server-side)
- README: reduced API docs to public endpoints only (`/decide` and `/health`)
- Custom policies now require paid tier — contact support@authensor.com

### Kept
- Agent Protocol in SKILL.md (required for the skill to function)
- `/decide` endpoint documentation (public API)
- All user-facing sections: quickstart, examples, troubleshooting, limitations, security

## [0.5.0] - 2026-02-11

### Added
- **Agent Protocol (MANDATORY)** section in SKILL.md — step-by-step instructions for policy checks
- Architecture diagram in README
- Badges in README

### Changed
- README restructured with architecture diagram and badges

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
