# Test results: agent-os v0.1.0

Date: 2026-10-25 · Environment: Claude Code cloud container, Claude Code CLI 2.1.310 · Agent model: `claude-haiku-5-5`
Harness: `node tests/run-tests.js` (tests A-G). Every check is made by the harness from files, exit codes or the
session event stream, never from what the model says. Raw per-run details: `tests/results/latest.md` / `latest.json`.

## Verification levels

| Level | Status | Evidence |
|-------|--------|----------|
| Configuration created | done | marketplace, plugin, 6 skills, 5 agents, hooks, template, fixture |
| Configuration validated | done | `claude plugin validate .` and `claude plugin validate plugins/agent-os`: both exit 0 (Test A) |
| Skills discovered | done | session init lists all 6 `agent-os:*` skills (Test A, F, G) |
| Agents discovered | done | session init lists all 5 `agent-os:*` agents (Test A, F, G) |
| Agents invoked | done | Agent tool called with `subagent_type` `agent-os:project-planner`, `developer`, `code-reviewer`, `qa-agent` (Tests B-E) |
| Agent `deployment-assistant` invoked | **not tested** | no deployment to check in the isolated fixture; discovered only |
| Tasks completed | done | plan has all sections (B); real file change (C); planted defect found (D); real test verdict (E) |
| Tests passed | done | fixture `npm test` re-run by the harness after C and after the D fix |
| Reuse in another project | done | second empty project, plugin installed, all skills/agents discovered, no app code copied (F) |
| Cloud install path | done | the exact `docs/cloud-setup-script.sh`, run in a clean config from GitHub, loads the plugin in a new session (G) |

## Tests

| Test | Result | What was checked |
|------|--------|------------------|
| A. Skill discovery | PASS | validation exit codes; 6/6 skills, 5/5 agents in the session; brief hook printed `BRIEF.md` |
| B. Planner | PASS | `agent-os:project-planner` invoked; output has Tasks, Dependencies, Acceptance criteria, Definition of done; no files changed |
| C. Developer | PASS | `agent-os:developer` invoked; `git diff` shows `src/text.js` and `test/text.test.js` changed; harness re-ran `npm test` and checked `excerpt()` behaviour itself |
| D. Code Reviewer | PASS | planted defect (`\d{3}` → `\d{2}` in `formatRupiah`); reviewer returned `[critical] src/text.js:15 ...` about the grouping; stayed read-only; defect reverted and `npm test` green |
| E. QA | PASS | `agent-os:qa-agent` ran `npm test`; its verdict (`PASS`) matches the harness's own run |
| F. Reusability | PASS | new empty project + clean Claude config: `marketplace add` + `plugin install --scope project`; 6/6 skills, 5/5 agents; project files: `.claude/settings.json`, `README.md` only |
| G. Cloud setup script | PASS | `docs/cloud-setup-script.sh` from GitHub source `yanskfz/agent-os#feat/initial-agent-os` (main does not have the plugin until this PR is merged) |

## Failures found and fixed during testing

1. **B first run FAIL (harness bug).** The planner ran as a background agent, and its plan arrived in a second
   result event the harness ignored. Fix: read all result events; ask for foreground agents. Rerun: PASS.
2. **D and E first run FAIL (real issue).** The RTK hook rewrites `git diff` to `rtk git diff`, and permissions
   are checked on the rewritten command, so the test's allow rules (`Bash(git *)`) no longer matched and the
   subagents were denied Bash. Both agents reported the denial honestly instead of guessing. Fix: add `rtk`-prefixed
   twins to allow rules (documented in `docs/HOW-TO.md`, Known limitations). Rerun: D PASS.
3. **D check was too loose (harness bug).** The first "detected" check also matched the diff text printed by the main
   session. Fix: judge only the subagent's returned text and require a severity-tagged finding. Rerun: PASS.
4. **E second run FAIL (fixture bug).** The fixture's `BRIEF.md` told QA to run a file that is not in the fixture, so
   QA correctly answered `PARTIAL`. Fix: corrected the fixture's next step. Rerun: PASS.
5. **Finding: settings alone do not install the plugin.** A project with only `extraKnownMarketplaces` +
   `enabledPlugins` in `.claude/settings.json`, started in a fresh config with `claude -p`, did not load the plugin.
   Hence the cloud setup script (Test G).

## Not verified
- The interactive claude.ai/code UI (the harness uses headless `claude -p`). Expected to behave the same once the
  setup script is in the environment; check by typing `/agent-os:` in a new session.
- `deployment-assistant` against a real Vercel deployment.
- Results with other models; agent output varies between runs.
