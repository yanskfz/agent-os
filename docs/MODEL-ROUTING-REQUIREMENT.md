# Model Routing Requirement (DRAFT)

Status: **DRAFT proposed by Claude Code for Codex to decide.** Nothing here is decided. Claude Code is the
implementation PIC; Codex and the project owner own this requirement. Items marked **Open question** block
implementation until answered.

Follows from `docs/ORCHESTRATOR-REQUIREMENT.md` ("Dollar caps and model mapping wait for the benchmark branch")
and the cost policy in `docs/AGENT-ROUTING-REQUIREMENT.md`.

## Objective

For each agent role, use the cheapest Claude model that still passes that role's quality gate, chosen from measured
results and not from guesses. The user should not have to pick a model by hand.

## Scope

In scope (decided by the owner: option "a"):

- a per-role model mapping for the agent-os agents that run inside Claude Code;
- a benchmark that measures pass rate and cost per role and model;
- applying the winning mapping to the agents.

Out of scope for this slice:

- routing to non-Claude providers (Codex, other vendors);
- the orchestrator calling any model (it stays deterministic and makes zero model calls);
- running benchmarks or workers from GitHub Actions;
- any dollar cap enforced through a billing API.

## Credentials

- Inside Claude Code, the model is chosen per agent and runs under the user's existing Claude Code login. No API key is
  needed, and none may be added to the repository (`CLAUDE.md` rule 5).
- A pay-per-token API key, or a subscription token stored as a GitHub secret, is needed only if workers or benchmarks
  run in GitHub Actions. That is out of scope here. **Open question 1** decides whether it ever comes into scope.

## Assumptions (to verify, not facts)

- A1. An agent file can set its model with a `model:` frontmatter field, and a plugin agent honours it. Today no
  agent sets `model:`. The first slice proves or disproves this.
- A2. The session's `result` event reports cost (`total_cost_usd`) and the model that served the turn. The test harness
  does not record cost yet; cost figures so far were read from the logs by hand.
- A3. Candidate models are `claude-haiku-5-5`, `claude-sonnet-5-5` and `claude-opus-5-5`. All tests so far ran on
  `claude-haiku-5-5` only.
- A4. A single run is not evidence: Test A's cost differed 2.8x between two identical runs.

## Requirements

- R1. The mapping is data in the agent files (`model:` frontmatter), reviewed in a PR, not logic in code.
- R2. The default for a role is the lowest-mean-cost model whose pass rate meets the threshold (**Open question 3**).
- R3. A larger model is used only when a quality gate fails, never by default
  (`docs/AGENT-ROUTING-REQUIREMENT.md`, cost policy).
- R4. The benchmark runs each cell (role x model) N times (**Open question 4**) against the existing checks for that
  role (tests B to E for planner, developer, reviewer and QA; H and I for handoff and delegation behaviour).
- R5. The benchmark records per run: model actually served, pass or fail per check, `total_cost_usd`, turns, and the
  raw log reference. A run whose served model differs from the requested one is marked invalid.
- R6. The benchmark has a structural budget: a maximum number of runs and a maximum total cost, and it stops and
  reports `BLOCKED` when either is reached (**Open question 4**). It never retries a failed cell to improve its numbers.
- R7. Results are written to a committed report with per-cell pass rate, mean and maximum cost, and the chosen model per
  role. Every number states how many runs it comes from.
- R8. Applying the mapping bumps the plugin version, passes `claude plugin validate` at both levels, and reruns the
  affected tests, as `CLAUDE.md` requires.
- R9. No secret, key or token appears in the repository, the logs that are committed, or the report.

## Proposed slices

1. **Verify A1 and A2.** One agent with `model: haiku` shows the served model in the event stream; record what the
   `result` event contains. If A1 fails, stop and report; the approach changes.
2. **Benchmark harness.** `tests/benchmark.js` (or a mode of `run-tests.js`) with R4 to R6 and a dry-run that prints the
   planned runs and the worst-case cost without calling a model.
3. **Run and report.** Run the benchmark within the budget and commit the report (R7).
4. **Apply.** Set `model:` per agent from the report (R1, R8).

Each slice is its own PR.

## Acceptance criteria (checkable)

- [ ] Slice 1 shows, from the event stream, the model that served an agent whose frontmatter requests a specific model.
- [ ] The benchmark's dry-run lists every planned run and stops before the first model call when the planned runs or
      worst-case cost exceed the budget.
- [ ] A benchmark run records the served model, cost and per-check result for every run, and marks a model mismatch invalid.
- [ ] A budget stop ends the benchmark with `BLOCKED` and a partial report; it does not retry.
- [ ] The report states N for every figure and does not rank a model with fewer than N valid runs in any cell.
- [ ] The chosen model per role follows R2 from the report, and each role's gate checks pass on it.
- [ ] After applying: the plugin version is bumped, both `claude plugin validate` commands pass, and the affected tests pass.
- [ ] No credential appears in any committed file.

## Open questions

1. **Credentials.** Is the work limited to the existing Claude Code login, or may a pay-per-token API key or a
   subscription token be used (for example for Actions later)? Default if unanswered: login only.
2. **Candidate models.** Are Haiku, Sonnet and Opus the right set, and is the newest model (Fable) excluded for cost?
3. **Pass threshold.** What pass rate counts as "passes the gate" (for example 100% of N, or at least 90%)?
4. **Sample size and budget.** What N per cell, and what maximum number of runs and total cost for one benchmark?
   Proposal: N of at least 5, because of the 2.8x variance in A4. Pricing and the cap are Codex's decision.
5. **Mixed roles.** Should one role be allowed a different model for different task sizes, or one model per role?
   Proposal: one model per role for the MVP.
6. **Where results live.** A committed report under `docs/`, or `TEST-RESULTS.md` only?

## Risks

- A small N hides real failures; a pass rate from 5 runs is a rough estimate, not a guarantee.
- Models and prices change; a mapping chosen today can become wrong. The report records the date and the model ids.
- The checks are small fixtures; a model that passes them may still fail on a real project.
- The `model:` field may behave differently in the interactive app than in the headless harness.
