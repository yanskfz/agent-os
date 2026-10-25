# Model Routing Requirement (DRAFT)

Status: **DRAFT. The project owner has answered the scope questions (below); Codex confirms the rest.** Claude Code is the
implementation PIC; Codex and the project owner own this requirement. Items under "Open questions" still need an answer
before the slice that depends on them.

Follows from `docs/ORCHESTRATOR-REQUIREMENT.md` ("Dollar caps and model mapping wait for the benchmark branch")
and the cost policy in `docs/AGENT-ROUTING-REQUIREMENT.md`.

## Objective

For each agent role, use the cheapest Claude model that still passes that role's quality gate, chosen from measured
results and not from guesses. The user should not have to pick a model by hand.

## Decisions

Decided by the project owner (2026-10-25):

- D1. Credentials: the existing Claude Code login only. No API key, subscription token or GitHub secret is used.
- D2. Candidate models: Haiku, Sonnet and Opus (`claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`). The newest
  model (Fable) is not a candidate.
- D3. Sample size: 5 runs per cell (role x model).
- D4. One model per role, not per task size.
- D5. Results are committed to git, in `docs/MODEL-BENCHMARK-REPORT.md`.

Delegated to Claude Code by the project owner, for Codex to confirm or override:

- D6. **Pass threshold: a model passes a role only if all 5 valid runs pass every check for that role.** Among the models
  that pass, the one with the lowest mean cost is chosen. Reason: a gate that fails 1 run in 5 is not safe as a default,
  and 5 of 5 is still only weak evidence (it does not rule out a failure rate near 40%), so a looser threshold would
  admit models that fail often. If no candidate reaches 5 of 5 for a role, no mapping is applied for that role and the
  result goes to Codex; the benchmark never picks a "best of the failures".
- D7. **Budget is structural, then measured.** The run count is fixed by the matrix (see R6). The cost ceiling is not guessed:
  a pilot of 1 run per cell measures real cost first, and the ceiling is set from it (R10).

## Scope

In scope:

- a per-role model mapping for the agent-os agents that run inside Claude Code;
- a benchmark that measures pass rate and cost per role and model;
- applying the winning mapping to the agents.

Out of scope for this slice:

- routing to non-Claude providers (Codex, other vendors);
- the orchestrator calling any model (it stays deterministic and makes zero model calls);
- running benchmarks or workers from GitHub Actions;
- any dollar cap enforced through a billing API;
- `deployment-assistant`: it has no test today, so it cannot be benchmarked and keeps the inherited model.

## Assumptions (to verify, not facts)

- A1. **Verified in slice 1 (Test J).** An agent file's `model:` frontmatter decides the model that serves it: as a subagent it
  is honoured whatever the main session runs on (Sonnet and Opus were served from a Haiku session), and an agent with no
  `model:` inherits the session's model. Run directly with `--agent` and no `--model` flag, the field applies; the
  `--model` flag overrides it. Today no repo agent sets `model:`.
- A2. **Verified in slice 1 (Test J).** The `init` event gives the session model. The `result` event's `modelUsage` lists every
  model that produced tokens, with its cost, and is the only place a subagent's model appears (its messages are not
  streamed). The harness now returns `modelUsage`, `total_cost_usd` and turns for every run.
- A3. Under the login, `total_cost_usd` is a measure of relative usage and not a bill. The real limits are the
  four-hour and weekly usage windows, so the run cap matters more than the dollar figure.
- A4. A single run is not evidence: Test A's cost differed 2.8x between two identical runs. Costs of Sonnet and Opus are
  not measured at all yet.

## Requirements

- R1. The mapping is data in the agent files (`model:` frontmatter), reviewed in a PR, not logic in code.
- R2. A role's model is chosen by D6: all checks pass in all 5 valid runs, then lowest mean cost.
- R3. A larger model is used only when a quality gate fails, never by default
  (`docs/AGENT-ROUTING-REQUIREMENT.md`, cost policy).
- R4. Each cell (role x model) is run 5 times against the existing checks for that role. A run passes only if every check
  for the role passes in it:
  - planner: Test B;
  - developer: Tests C and H (developer case);
  - code-reviewer: Test D;
  - qa-agent: Tests E and H (qa-agent case).
- R5. The benchmark records per run: model actually served, pass or fail per check, `total_cost_usd`, turns, and the
  raw log reference. A run whose served model differs from the requested one is invalid. Invalid runs are excluded and
  not retried; a cell with fewer than 5 valid runs is unranked.
- R6. Structural cap: 4 roles x 3 models x 5 runs = 60 role-runs (90 test executions, because developer and qa-agent
  run two checks each). The benchmark stops with `BLOCKED` and a partial report when the run cap or the cost ceiling (R10)
  is reached. It never retries a failed cell to improve its numbers.
- R7. Results are committed to `docs/MODEL-BENCHMARK-REPORT.md` with per-cell pass count, mean and maximum cost, and
  the chosen model per role. Every number states how many runs it comes from, and the report records the date and
  the model ids.
- R8. Applying the mapping bumps the plugin version, passes `claude plugin validate` at both levels, and reruns the
  affected tests, as `CLAUDE.md` requires.
- R9. No secret, key or token appears in the repository, the committed logs or the report.
- R10. Pilot first: 1 run per cell (12 role-runs) measures real cost. The cost ceiling for the full benchmark is then set to
  1.5x the pilot's cost extrapolated to 5 runs per cell, written into the harness config in a PR before the full run.

## Proposed slices

1. **Verify A1 and A2.** One agent with `model: haiku` shows the served model in the event stream; record what the
   `result` event contains. If A1 fails, stop and report; the approach changes.
2. **Benchmark harness.** `tests/benchmark.js` (or a mode of `run-tests.js`) with R4 to R6 and a dry run that prints the
   planned runs and the run cap without calling a model.
3. **Pilot (R10).** Run 1 per cell, commit the measured costs, set the ceiling.
4. **Full run and report.** Run 5 per cell within the cap and commit `docs/MODEL-BENCHMARK-REPORT.md`.
5. **Apply.** Set `model:` per agent from the report (R1, R8).

Each slice is its own PR.

## Acceptance criteria (checkable)

- [ ] Slice 1 shows, from the event stream, the model that served an agent whose frontmatter requests a specific model.
- [ ] The benchmark's dry run lists every planned run (60 role-runs) and exits before the first model call.
- [ ] A benchmark run records the served model, cost and per-check result for every run, and marks a model mismatch invalid.
- [ ] A cap stop (runs or cost ceiling) ends the benchmark with `BLOCKED` and a partial report; it does not retry.
- [ ] The pilot's measured cost per cell is committed before the cost ceiling is set.
- [ ] The report states the run count for every figure and ranks no cell with fewer than 5 valid runs.
- [ ] A role's chosen model passed all 5 valid runs for that role; a role where no model did is reported with no mapping.
- [ ] After applying: the plugin version is bumped, both `claude plugin validate` commands pass, and the affected tests pass.
- [ ] No credential appears in any committed file.

## Open questions

1. Does Codex confirm D6 (all 5 of 5 runs must pass) or want a looser threshold? A looser one admits models that fail
   about one run in five.
2. Is a cost ceiling of 1.5x the extrapolated pilot cost acceptable, or should it also be capped in absolute usage
   (for example a share of the weekly window)? The weekly window is not readable from the session, so an absolute
   cap would need a number from the owner.
3. Is excluding `deployment-assistant` (no test, so no benchmark) acceptable for this slice?

## Risks

- A sample of 5 per cell is a rough estimate, not a guarantee. D6 is strict for that reason.
- Models and prices change; a mapping chosen today can become wrong. The report records the date and the model ids.
- The checks are small fixtures; a model that passes them may still fail on a real project.
- The `model:` field may behave differently in the interactive app than in the headless harness.
- The full benchmark uses real usage from the owner's login windows; the pilot and the run cap exist to bound that.
