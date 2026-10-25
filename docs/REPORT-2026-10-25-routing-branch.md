# Report: review and test rerun of `feat/routing-cost-design-guards`

Date: 2026-10-25 · Plugin: `agent-os` v0.2.0 · Reviewer: Claude (cloud session) · Test model: `claude-haiku-5-5`
Audience: the owner (Yansz) and Codex, for an independent check.

## 1. What was reviewed

The branch adds 13 commits over `main` (13 files changed):

- `docs/AGENT-ROUTING-REQUIREMENT.md`: single owner per task, minimal handoffs, escalation only with a reason, quality override.
- `docs/COMPANY-PROFILE-DESIGN-GUARD.md`: responsive and accessibility contract for company profile sites.
- `plugins/agent-os/skills/agent-routing/SKILL.md`: the routing skill.
- Routing preamble added to all five agents; three routing fields added to the `BRIEF.md` template
  (`Primary owner`, `Work mode`, `Quality gate`).
- `tests/run-tests.js`: expected skill list now includes `agent-routing`.
- Plugin version bumped to 0.2.0; README updated.

Review was read-only until the test rerun. Method: cloned the branch, read every changed file, diffed against `main`.

## 2. Verification levels (as of commit `3cea0b5`)

| Level | Status | Evidence |
|-------|--------|----------|
| Created | done | files above exist on the branch |
| Validated | done | `claude plugin validate .` and `claude plugin validate plugins/agent-os` both pass. Advisory only: plugin README has no marketplace install line |
| Skills / agents discovered | done | Test A: 7/7 skills, 5/5 agents |
| Agents invoked | done | Tests B-E invoked planner, developer, reviewer, QA |
| Completed / passed | done | Tests A-E PASS (one run each, Haiku) |
| Tests F, G on v0.2.0 | **not run** | results in `TEST-RESULTS.md` are from v0.1.0 and are marked as such |
| `agent-routing` skill loaded by agents | **not observed** | 0 Skill-tool calls in the B-E session logs |
| Routing behaviour (hand-off of out-of-scope tasks) | **not tested** | no test covers it |
| Design guard enforced | **not tested** | screenshot check covers 2 of the 9 required viewports |
| `deployment-assistant` | **not tested** | no deployment in the fixture |

## 3. Cost baseline (first measurement)

Source: `total_cost_usd` in each session's `result` event. One run per test, one model.

| Test | USD |
|------|-----|
| A | 0.0103 |
| B | 0.0128 |
| C | 0.0095 |
| D | 0.0076 |
| E | 0.0073 |
| Total | 0.0475 |

Shows scale only (cents per run). No variance data, no other models.

## 4. Findings

Ordered by importance. "Confirmed" means observed in files or logs; "Unverified" means reasoned but not tested.

1. **Stale results (confirmed, fixed in `3cea0b5`).** `TEST-RESULTS.md` still said 6 skills and v0.1.0 while the harness
   expected 7. Now rerun and updated; F and G remain unrerun and are labelled.
2. **Routing skill is not exercised (confirmed).** Agents are told to apply `agent-os:agent-routing` but made 0 Skill-tool
   calls in B-E. The earlier concern that every agent call loads a 100-line skill did not materialise. The inverse
   problem exists instead: routing behaviour is unproven. A test is needed where an agent receives an out-of-scope task
   and must return a compact handoff instead of acting.
3. **Cost policy is wording only (confirmed).** "Light / medium / higher / highest" intensity is not mapped to concrete
   models. No agent has a `model:` field. No benchmark exists. No alert exists for spend above a baseline.
   Decision pending: whether to benchmark models per agent role (cheapest model that passes consistently becomes the default).
4. **Design guard is documentation only (confirmed).**
   - The guard requires 9 viewports; `screenshot.js` checks 1440 and 390.
   - The template's navigation dots are 20 px wide on narrow screens (`.dot` at max-width 699 px), below the guard's own
     24x24 px minimum target size.
   - Neither the template nor QA references the guard.
5. **Ambiguous owners (confirmed).** The routing table names `Codex` and `Product Design` as owners. Claude Code cannot
   invoke them, so inside the plugin the instruction is ambiguous. Suggest wording such as "hand off to the owner outside
   Claude Code" and keeping the table as a human routing aid.
6. **Missing workflow rule (confirmed).** `CLAUDE.md` does not say that requirements are discussed in chat/Codex and that
   Claude Code must stop and record an Open question in `BRIEF.md` when a requirement is ambiguous.
7. **Missing project files (confirmed).** No root `BRIEF.md`, `CHANGELOG.md`, `AGENTS.md`, or roadmap.
8. **History noise (confirmed).** The message "Wire agent-fit routing into existing agents" appears 5 times and
   "Document routing and company profile design guards" twice. Use squash merge.
9. **Risk that did not occur (unverified as a general claim).** The preamble could make `developer` hand off instead of
   editing when acceptance criteria are not explicit. Test C passed with 2 files changed. One run does not prove it is safe.

## 5. Suggested next steps (not yet done)

1. Decide whether the per-agent preamble should shrink to 2-3 inline lines, given the skill is not loaded.
2. Add a routing-behaviour test (finding 2).
3. Add `BRIEF.md`, `CHANGELOG.md`, `AGENTS.md` (shared rules for Claude and Codex), `docs/REQUIREMENTS.md`, roadmap.
4. Add a model benchmark (`tests/model-bench.js`): reviewer and planner tasks at several difficulty levels, 3 runs per model,
   recording pass rate, duration and cost; budget cap set before running.
5. Wire the design guard into `screenshot.js` and fix the 20 px dot target.
6. Rerun F and G on v0.2.0.

## 6. Questions for the Codex check

- Does the routing requirement match what Codex intended, especially "Codex owns requirement authority and final routing"?
- Is the preamble wording in the five agents acceptable, or should routing live only in the skill?
- Are the nine verification viewports final, or should the guard drop to the viewports the screenshot check can run?
- Should the model benchmark in step 4 be in scope for this branch or a separate one?

## 7. Not verified in this report

- Behaviour with models other than Haiku.
- Variance between runs; every result is a single run.
- The interactive claude.ai/code UI (the harness is headless `claude -p`).

## 8. Addendum: Codex decisions applied (plugin v0.2.1)

Codex decisions received 2026-10-25 and what was done. Sections 1-7 above describe the state at commit `ac4ea5e`.

| Codex decision | Done | Notes |
|----------------|------|-------|
| Keep the preamble, shorten to 2-3 lines, drop the skill reference | yes | Same text for developer; role-specific third criterion for the others (see deviations) |
| Clarify external handoff wording | yes | Skill, requirement doc and `CLAUDE.md` rule 6: Codex or the project owner owns requirement authority; Claude Code records ambiguity in `BRIEF.md` and hands off |
| Add a test for out-of-scope tasks | yes | Test H, 2 cases, PASS |
| Rerun F and G on the new version | yes | both PASS at v0.2.1; G ran against the pushed branch |
| Wire the design guard into the screenshot check | yes | `screenshot.js`: nine viewports, targets under 24x24 px, clipped header/footer elements |
| Fix the 20 px navigation dot | yes | 24 px; also fixed a real 320 px overflow found by the new check |
| Model benchmark in a separate branch | **not started** | deliberately out of this branch |

**Deviations from the Codex text, for you to confirm or reject:**
1. The planner and reviewer preambles differ from the generic text. The planner writes the acceptance criteria, so
   requiring them as input would make it hand off every planning request. The reviewer needs a diff or files, not
   criteria. Test B and D remain valid with this wording.
2. The handoff names its fields (Scope, Owner, Unresolved) so that a handoff is well-formed and testable. The agent
   no longer loads the routing skill, so the fields would otherwise be undefined for it.

**New limitation found (finding 2 in `TEST-RESULTS.md`):** when a main session delegates to an agent, it can rewrite a
vague request into detailed steps, and the agent then acts. Run directly as the agent, the preamble held. Closing this
needs a rule for the delegating session, not for the agent. Question for Codex: should that rule live in `CLAUDE.md`
("pass the user's task to subagents verbatim, and ask when it lacks acceptance criteria")?

**Test outcome (details in `TEST-RESULTS.md`):** the first full v0.2.1 run had three failures (C, E, H). Causes: a
harness bug (C), a blocked `echo` in the harness permissions (E), and an invalid test design (H). The harness was
fixed and C, E, H rerun: PASS. All of A-H pass, but across three runs, one run each, one model.

**Next, not started:** model benchmark on a separate branch with a budget cap and several runs per cell (Test A's cost
varied 2.8x between two identical runs, so single runs cannot rank models), then `BRIEF.md`, `CHANGELOG.md`, `AGENTS.md`.
