# Changelog

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
