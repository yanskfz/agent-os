# CLAUDE.md: agent-os

This repo is the shared library (Claude Code plugin + templates). It is not a client project.

## Rules
1. Owner: Yansz, works from a phone. Chat in casual Indonesian (gue/lu); everything in git in English.
2. Plan first (max 8 lines). After Yansz says "lanjut", work through to a PR without stopping;
   only ask when blocked by access, permission or a decision only he can make.
3. Never touch client project repos from here. Test only in `fixtures/` copies (the test harness does this).
4. Never fake results. Report each verification level separately: created, validated, discovered, invoked, completed, passed.
5. No secrets in the repo. No paid services. No deploy of this repo to Vercel.
6. Requirements are decided in chat (Claude chat or Codex) or by the project owner, not here. If a requirement is
   missing or ambiguous, write an Open question in `BRIEF.md`, hand off, and stop instead of guessing.

## Changing the plugin
- Files: `plugins/agent-os/{skills,agents,hooks,scripts}`. Skills are `skills/<name>/SKILL.md` with `name` + `description` frontmatter.
- After a change: bump `version` in `plugins/agent-os/.claude-plugin/plugin.json`, run
  `claude plugin validate .` and `claude plugin validate plugins/agent-os`, then `node tests/run-tests.js` (or the affected test letters),
  and update `TEST-RESULTS.md` from `tests/results/latest.md`.
- Keep agents few and distinct. Prefer a skill over a new agent, and a native Claude Code feature over custom code.

## Saving tokens
Read only what the task needs. Cut long output. Use `node tests/run-tests.js <letters>` to rerun only what changed.
End-of-task report: max 5 lines.
