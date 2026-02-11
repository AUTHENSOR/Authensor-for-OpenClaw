# Changelog

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
