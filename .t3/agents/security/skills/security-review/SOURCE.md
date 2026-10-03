# Source

Adapted from Anthropic's `security-review` command in
[anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review)
(`.claude/commands/security-review.md`, MIT License, Copyright (c) 2025 Anthropic).

Changes for use as a T3 workflow reviewer:

- Removed the slash-command front matter and inline `git` interpolation; the reviewer inspects the workspace diff itself.
- Replaced the sub-task orchestration with a single-agent find-then-filter pass, so it runs on any provider.
- Replaced the Markdown report with field guidance for T3's review response contract.
- Added this repository's attack surface and trust boundaries.
- Dropped exclusions that cannot apply here (Rust memory safety, notebooks).
