# Test results: agent-os v0.2.0

Date: 2026-10-25 · Environment: Claude Code cloud container, Claude Code CLI 2.1.310 · Agent model: `claude-haiku-5-5`
Harness: `node tests/run-tests.js` (tests A-G). Every check is made by the harness from files, exit codes or the
session event stream, never from what the model says. Raw per-run details: `tests/results/latest.md` / `latest.json`.

**Scope of this update:** tests A-E were rerun on v0.2.0 (branch `feat/routing-cost-design-guards`).
Tests F and G were **not** rerun on v0.2.0; their rows below are from the v0.1.0 run.

## Verification levels

| Level | Status | Evidence |
|-------|--------|----------|
| Configuration created | done | marketplace, plugin, 7 skills (incl. `agent-routing`), 5 agents, hooks, template, fixture |
| Configuration validated | done | `claude plugin validate .` and `claude plugin validate plugins/agent-os`: both exit 0, v0.2.0 (Test A; only advisory: plugin README lacks a marketplace install line) |
| Skills discovered | done | session init lists all 7 `agent-os:*` skills (Test A, v0.2.0). F and G last ran on v0.1.0 (6 skills) |
| Agents discovered | done | session init lists all 5 `agent-os:*` agents (Test A) |
| Agents invoked | done | Agent tool called with `subagent_type` `agent-os:project-planner`, `developer`, `code-reviewer`, `qa-agent` (Tests B-E, v0.2.0) |
| `agent-routing` skill loaded by agents | **not observed** | 0 Skill-tool calls in the B-E session logs; agents carry only the one-line preamble. Whether the routing rules change agent behaviour is untested |
| Agent `deployment-assistant` invoked | **not tested** | no deployment to check in the isolated fixture; discovered only |
| Tasks completed | done | plan has all sections (B); real file change (C); planted defect found (D); real test verdict (E) |
| Tests passed | done | fixture `npm test` re-run by the harness after C and after the D fix |
| Reuse in another project | done | second empty project, plugin installed, all skills/agents discovered, no app code copied (F) |
| Cloud install path | done | the exact `docs/cloud-setup-script.sh`, run in a clean config from GitHub, loads the plugin in a new session (G) |

## Tests

| Test | Result | What was checked |
|------|--------|------------------|
| A. Skill discovery | PASS | validation exit codes; 7/7 skills, 5/5 agents in the session; brief hook printed `BRIEF.md` |
| B. Planner | PASS | `agent-os:project-planner` invoked; output has Tasks, Dependencies, Acceptance criteria, Definition of done; no files changed |
| C. Developer | PASS | `agent-os:developer` invoked; `git diff` shows `src/text.js` and `test/text.test.js` changed; harness re-ran `npm test` and checked `excerpt()` behaviour itself |
| D. Code Reviewer | PASS | planted defect (`\d{3}` → `\d{2}` in `formatRupiah`); reviewer returned `[critical] src/text.js:15 ...` about the grouping; stayed read-only; defect reverted and `npm test` green |
| E. QA | PASS | `agent-os:qa-agent` ran `npm test`; its verdict (`PASS`) matches the harness's own run |
| F. Reusability (v0.1.0 run, not rerun) | PASS | new empty project + clean Claude config: `marketplace add` + `plugin install --scope project`; 6/6 skills, 5/5 agents; project files: `.claude/settings.json`, `README.md` only |
| G. Cloud setup script (v0.1.0 run, not rerun) | PASS | `docs/cloud-setup-script.sh` from GitHub source `yanskfz/agent-os#feat/initial-agent-os` (main does not have the plugin until this PR is merged) |

## Cost per run (v0.2.0, `claude-haiku-5-5`)

Source: `total_cost_usd` in each session's `result` event (`tests/results/logs/`, not committed). One run each.

| Test | Cost (USD) |
|------|-----------|
| A. Discovery | 0.0103 |
| B. Planner | 0.0128 |
| C. Developer | 0.0095 |
| D. Reviewer | 0.0076 |
| E. QA | 0.0073 |
| Total A-E | 0.0475 |

This is the first cost baseline. It is a single run per test on one model, so it shows scale (cents), not variance.
Costs for other models are not measured yet.

## Findings from the v0.2.0 rerun

1. **A-E all PASS on v0.2.0.** The suspected risk that the routing preamble makes `developer` hand off instead of
   editing did not occur in this run (C passed with 2 files changed). One run is not proof; output varies between runs.
2. **The routing skill is not exercised.** Agents are told to "apply the agent-os:agent-routing skill" but made 0
   Skill-tool calls in B-E. So the 100-line skill is not adding load per agent call (the earlier overhead worry did not
   show up), but the routing behaviour is also not tested by any test.

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
- Routing behaviour itself (agents handing off out-of-scope tasks), and the responsive design guard (the screenshot
  check covers 1440 and 390 px only; the guard asks for nine viewports).
- Tests F and G on v0.2.0.
