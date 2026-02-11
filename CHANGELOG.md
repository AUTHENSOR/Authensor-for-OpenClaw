# Changelog

## [0.6.0] - 2026-02-11

### Fixed
- **CRITICAL: Read tool now detects sensitive paths.** `Read`, `Glob`, `Grep` targeting `~/.ssh/*`, `*.env`, `~/.aws/*`, and other sensitive patterns are now classified as `secrets.access` instead of `safe.read`
- **Safe Bash commands tightened.** Removed `cat` and `echo` from safe command list (both can write via shell redirection). Only `ls`, `pwd`, `whoami` remain safe.
- **Approval flow docs reconciled.** README no longer claims automatic email approvals — now correctly documents CLI approval as default with email as optional setup
- **"Fail-closed" language clarified.** Security tables now say "Instructed fail-closed" with cross-reference to Limitations section
- **Polling timeout added.** Agent now stops polling after 10 minutes (20 attempts) instead of indefinitely
- **Undocumented endpoint added to README.** `GET /receipts/<receiptId>` now in API table
- **Expanded error handling.** Added 429 (rate limited) and malformed response handling to Agent Protocol
- **Expanded redaction patterns.** Added `curl -u`, `git clone` with credentials, `mysql -p`, `--password`/`--token` flag stripping
- **Removed internal key prefix leak.** Troubleshooting no longer reveals admin key naming convention
- **Added `unlink`/`truncate` to destructive command detection**
- Updated examples table: added `Read ~/.ssh/id_rsa` and `Read .env` as denied examples

## [0.5.2] - 2026-02-11

### Fixed
- **Registry metadata**: Added `env` declaration inside `metadata.openclaw` so ClawHub correctly displays required environment variables
- **Resource redaction**: Agent Protocol now includes explicit Step 1b requiring secrets/tokens/query params be stripped from resource values before transmission to control plane
- Updated "What Data Is Sent" sections in SKILL.md and README to clarify redaction behavior

## [0.5.1] - 2026-02-11

### Changed
- Streamlined repo to public-facing content only
- README: reduced API docs to public endpoints only (`/decide` and `/health`)
- Custom policies now require paid tier — contact support@authensor.com

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
- Collapsible troubleshooting in README

### Changed
- Demo key onboarding email improved with copy-pasteable JSON config block

## [0.3.0] - 2026-02-11

### Changed
- **Honest enforcement language** — replaced "the agent cannot bypass the gate" with accurate description of prompt-level enforcement model
- Added **Limitations** section documenting what Authensor can and cannot do today
- Added **How Enforcement Works** section explaining prompt-level vs code-level enforcement

### Added
- MIT LICENSE file
- This CHANGELOG
- Link to OpenClaw hook proposal (Issue #10502) for future code-level enforcement

## [0.2.0] - 2026-02-11

### Changed
- Moved `requires.env` to top-level frontmatter (fixes ClawHub registry metadata mismatch)
- Added `disable-model-invocation: true` (agent cannot load skill autonomously)

### Added
- **Runtime Behavior** section with exact data flow
- **What Data Is Sent / What Data Is Stored** transparency sections
- **Security Notes** table

## [0.1.0] - 2026-01-15

### Added
- Initial release
- Instruction-only skill manifest (SKILL.md)
- Email-based approval flow for high-risk actions
- Demo key issuance via Google Form
