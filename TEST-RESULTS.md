# Test results: agent-os v0.2.2

Date: 2026-10-25 · Environment: Claude Code cloud container, Claude Code CLI 2.1.310 · Agent model: `claude-haiku-5-5`
Harness: `node tests/run-tests.js` (tests A-H). Every check is made by the harness from files, exit codes or the
session event stream, never from what the model says. Raw per-run details: `tests/results/latest.md` / `latest.json`.

**How the v0.2.1 results were obtained (not one clean run):**
1. A, B, D, F passed in the first full run on v0.2.1. C, E and H **failed** in that run.
2. The three failures were diagnosed (see "Failures found and fixed"), the harness was corrected, and C, E, H were rerun: PASS.
3. G was run afterwards against the pushed branch `yanskfz/agent-os#feat/routing-cost-design-guards`: PASS.
So the current PASS state combines three runs. Every result is a single run on one model.
4. After the Codex delegation rule was added to `CLAUDE.md`, `claude plugin validate` (both levels) passed again and
   H was rerun once more: PASS (two consecutive H passes). This rerun cannot exercise the new rule: H runs the agent
   directly in a fixture copy, while the rule governs how a main session delegates (see the verification table).

**v0.2.2 (delegation routing):** adds Test I and a `SessionStart` hook that gives the main session a delegation rule.
Test I failed before the hook (the main session rewrote the vague task into a 1,100-character brief with numbered steps and
the developer edited `index.html`; it rewrote the QA task into a "verify" request), and passed in two consecutive runs after it.
`claude plugin validate .` and `claude plugin validate plugins/agent-os` passed at v0.2.2; A, H and I were rerun, B-G were not.

## Verification levels

| Level | Status | Evidence |
|-------|--------|----------|
| Configuration created | done | marketplace, plugin, 7 skills (incl. `agent-routing`), 5 agents, hooks, template, fixture |
| Configuration validated | done | `claude plugin validate .` and `claude plugin validate plugins/agent-os`: both exit 0 at v0.2.1 (advisory only: plugin README has no marketplace install line) |
| Skills / agents discovered | done | 7/7 skills and 5/5 agents in a fresh session (Tests A, F, G at v0.2.1) |
| Agents invoked | done | Agent tool called with `agent-os:project-planner`, `developer`, `code-reviewer`, `qa-agent` (Tests B-E) |
| Tasks completed | done | plan has all sections (B); real file change (C); planted defect found (D); real test verdict (E) |
| Tests passed | done | fixture `npm test` re-run by the harness after C and after the D fix |
| Routing preamble changes behaviour | **partly tested** | Test H, 2 cases, one run each: `qa-agent` given an implementation task and `developer` given a vague task both returned a handoff (Owner, Unresolved) and changed no file. Run as the agent directly (`--agent`); delegation through a main session is not covered, and an earlier version of H showed a main session can rewrite a vague task into detailed steps before delegating |
| Main-session delegation rule | **tested, 2 runs** | Test I runs a main session (no `--agent`) and judges the Agent tool call's prompt and the repo diff. Shipped to every project by the plugin's `SessionStart` hook (`scripts/delegation-rule.sh`), because the `CLAUDE.md` rule only applies inside this repository. Before the hook: FAIL (vague task expanded into steps and acted on). After: PASS twice. The invented-criteria check is a heuristic (list steps, criteria headings, unmentioned file names, long added text), and the cases are 4 tasks on one model |
| `agent-routing` skill loaded by agents | **not observed** | 0 Skill-tool calls in the B-E logs; the preamble no longer references the skill (it is a 3-line inline check) |
| Reuse in another project | done | second empty project, plugin installed from a local checkout, 7/7 skills, 5/5 agents, no app code copied (F, v0.2.1) |
| Cloud install path | done | the exact `docs/cloud-setup-script.sh`, from GitHub branch `feat/routing-cost-design-guards`, loads agent-os v0.2.1 in a new session (G) |
| Design guard (9 viewports) | done, **manual** | `screenshot.js` run on a scratch copy of the template: FAIL before the CSS fix, OK at all nine viewports after. Not part of `run-tests.js`, so it is not rerun automatically |
| `deployment-assistant` invoked | **not tested** | no deployment to check in the isolated fixture; discovered only |

## Tests

| Test | Result | What was checked |
|------|--------|------------------|
| A. Skill discovery | PASS | validation exit codes; 7/7 skills, 5/5 agents in the session; brief hook printed `BRIEF.md` |
| B. Planner | PASS | `agent-os:project-planner` invoked; output has Tasks, Dependencies, Acceptance criteria, Definition of done; no files changed |
| C. Developer | PASS | `agent-os:developer` invoked; diff against the fixture commit shows `src/text.js` and `test/text.test.js` changed; harness re-ran `npm test` and checked `excerpt()` behaviour itself |
| D. Code Reviewer | PASS | planted defect (`\d{3}` → `\d{2}` in `formatRupiah`); reviewer returned a `[critical]` finding about the grouping; stayed read-only; defect reverted and `npm test` green |
| E. QA | PASS | `agent-os:qa-agent` ran `npm test`; its verdict (`PASS`) matches the harness's own run |
| F. Reusability | PASS | new empty project + clean Claude config: `marketplace add` + `plugin install --scope project`; 7/7 skills, 5/5 agents; project files: `.claude/settings.json`, `README.md` only |
| G. Cloud setup script | PASS | `docs/cloud-setup-script.sh` from GitHub source `yanskfz/agent-os#feat/routing-cost-design-guards`; plugin v0.2.1 loaded, 7/7 skills, 5/5 agents (main does not have v0.2.x until the PR is merged) |
| H. Out-of-scope handoff | PASS | session run as the agent (`--agent`); `qa-agent` + implementation task and `developer` + vague task: each returned Owner and Unresolved, and the repo had no change vs the fixture commit |
| I. Main-session delegation | PASS (2 runs) | main session delegates; judged from the Agent call's prompt and the repo diff. Vague and out-of-scope tasks reach the worker word for word with no added steps, the worker returns Owner and Unresolved, no file changes, and the vague case goes back to the user to decide. The explicit task keeps every user criterion, the worker changes the code and the harness's `npm test` passes. With two agents asked to do the same work, at most one does it |

## Cost per run (v0.2.1, `claude-haiku-5-5`)

Source: `total_cost_usd` in each session's `result` event, latest log per test (`tests/results/logs/`, not committed).
One run each.

| Test | Cost (USD) |
|------|-----------|
| A. Discovery | 0.0037 |
| B. Planner | 0.0099 |
| C. Developer | 0.0083 |
| D. Reviewer | 0.0072 |
| E. QA | 0.0060 |
| F. Reuse | 0.0036 |
| G. Setup script | 0.0032 |
| H1. QA handoff | 0.0023 |
| H2. Developer handoff | 0.0036 |
| Total | 0.0479 |

Test I (v0.2.2, latest run): I1 0.0063, I2 0.0070, I3 0.0076, I4 0.0114, total 0.0323. Not added to the total above, which is the v0.2.1 run.

H was rerun once after the `CLAUDE.md` patch: H1 0.0011, H2 0.0019, about half of the first H run (0.0023, 0.0036) for the
same prompts. The table above keeps the first-run values.

The first baseline (v0.2.0) priced Test A at 0.0103; the same prompt cost 0.0037 here. That is a 2.8x difference from
run to run on an identical task, so single-run costs are only a scale indicator. A model benchmark needs several runs
per cell. Costs for other models are not measured. Costs of the first v0.2.1 run's failed C, E, H were not kept.

## Findings from the v0.2.1 run

1. **The shortened preamble works when the agent receives the task directly** (H, 2 cases). Run as the developer,
   "make the site better" returned a handoff with Scope, Owner and Unresolved (about $0.002) and changed nothing.
2. **It did not hold when a main session delegated.** In the first H attempt the main session expanded the vague task
   into explicit steps, the developer then acted and edited `index.html`. This is a gap in routing that the agent
   preamble cannot close: the main session decides what the subagent is told. **Closed in v0.2.2** by the delegation rule in the `SessionStart` hook; see Test I.
3. **The template failed the design guard at 320 px** (page overflow 30 px, clipped controls and chip) and the
   navigation dots were 20x32 px at 320-414 px, below the guard's 24x24 minimum. The old screenshot check (390 and
   1440 px only) could not see either. Fixed in the template CSS; verified OK at all nine viewports.
4. **Fonts do not load in this sandbox** (`fonts.googleapis.com` blocked). The screenshot check now lists failed
   third-party requests as a note instead of counting them as console errors.
5. **Agent commits vary between runs.** The developer committed its change in one run and not in another. Checks must
   compare against the fixture commit, not HEAD.

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
6. **C FAIL on the first v0.2.1 run (harness bug).** The developer did the work and committed it; the harness compared
   the working tree to HEAD and saw no changes. Fix: compare to the fixture commit. Rerun: PASS.
7. **E FAIL on the first v0.2.1 run (permission rule, agent behaved correctly).** QA ran `npm test` (2 pass, 0 fail)
   but its `npm test; echo $?` was blocked, so it marked the exit code "not checked" and returned PARTIAL. Fix: allow
   `echo *` (and its `rtk` twin) in the harness. Rerun: PASS.
8. **H FAIL on the first attempt (invalid test).** See finding 2. Fix: run the session as the agent with `--agent`.
   Rerun: PASS.

## Not verified
- The interactive claude.ai/code UI (the harness uses headless `claude -p`). Expected to behave the same once the
  setup script is in the environment; check by typing `/agent-os:` in a new session.
- `deployment-assistant` against a real Vercel deployment.
- Results with other models; variance between runs (every result is a single run, and Test A's cost varied 2.8x).
- Delegation routing beyond Test I: one model, 4 tasks, 2 consecutive passes; the invented-criteria check is a heuristic; the `Skill`-based path and the orchestrator calling it are not covered.
- The design guard beyond what `screenshot.js` checks: 200% zoom, keyboard focus order, contrast, landscape layouts.
- The design guard check is not in `run-tests.js`.

## Workspace orchestrator (`node tests/workspace.test.js`)

Deterministic: no model, no network, no cost. Separate from tests A-H. Run on 2026-10-25 with Node 22.

| Level | Result |
|-------|--------|
| Created | `workspace/{orchestrator.js,handoff.md,state.schema.json,events.schema.json}`, `docs/WORKSPACE-ARCHITECTURE.md`, `tests/workspace.test.js` |
| Passed | 16 of 16 |
| Mutation check | raising the run cap, raising the retry cap, accepting unevidenced `pass` and allowing `merge` each made at least one test fail; the original code passes |
| Not run | `claude plugin validate` and tests A-H (the plugin and `tests/run-tests.js` were not changed); no GitHub Action or scheduled trigger exists yet, so the orchestrator has only been driven by the tests |
