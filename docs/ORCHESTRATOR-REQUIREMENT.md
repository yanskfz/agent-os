# Agent Orchestrator Requirement

## Product boundary

Build one AI Workspace project in this `agent-os` repository. The orchestrator is
the core runtime and agent-os is its reusable worker pack. The workspace must
eventually coordinate terminal/code work, visual 2D design/prototyping, and visual
3D work from one project goal.

The MVP is GitHub-backed and terminal/code-first. It must define the adapter contract
for 2D and 3D surfaces without building those surfaces yet.

## Objective

Build a stoppable, event-driven orchestrator that routes work to the correct owner,
preserves original intent, passes compact handoffs, inspects evidence, and continues
until a quality gate passes or a real blocker requires the project owner.

## Roles

- Codex: requirements, architecture, routing, quality gates, and final synthesis.
- Claude Code: implementation of scoped repository tasks.
- Product Design: visual direction, prototype, and design QA when a 2D surface is invoked.
- QA: executed tests and acceptance-criteria verification.
- Reviewer: independent code or design findings.
- Deployment assistant: read-only deployment verification.

## Lifecycle

The default lifecycle is:

`IDLE → INTAKE → TRIAGE → HANDOFF → WORKING → EVIDENCE → GATE`

From `GATE`, transition to `DONE`, `RETRY`, `REROUTE`, `BLOCKED`, or `STOPPED`.
The orchestrator is idle with no active goal and makes no model calls. It wakes on a
new goal, worker report, commit/PR event, failed check, or explicit user feedback.

## Worker and surface boundaries

- One active owner per concern.
- A worker receives the original task plus compact context; delegation must not invent
  acceptance criteria.
- Terminal/code is the first surface and uses Claude Code.
- 2D and 3D surfaces use an adapter contract with declared inputs, outputs, and evidence.
- Product Design does not own production code.
- Claude Code does not decide unresolved product requirements.
- QA and reviewer do not fix the implementation they evaluate.
- Deployment verification does not deploy.
- The orchestrator may open a PR but never merges automatically.

## Shared state and events

Use GitHub-backed artifacts as persistent state:

- `BRIEF.md`: goal, decisions, owner, mode, quality gate, Open questions;
- `workspace/state.json`: current state, active owner, retry count, budget;
- `workspace/events.jsonl`: append-only event evidence;
- `docs/HANDOFF.md`: one active handoff with the original task preserved;
- worker reports, commits, PRs, and CI results: evidence references.

Each event has an id, type, actor, task reference, timestamp, and evidence references.

## Evidence gates

Every transition identifies evidence:

- requirements: brief, decisions, Open questions, acceptance criteria;
- design: selected direction and responsive/design guard evidence;
- implementation: changed files and relevant checks;
- verification: command output, screenshots, or status evidence;
- repair: failed criterion and focused corrective task.

Every criterion is `pass`, `fail`, or `not checked`. A claim without evidence is
`not checked`.

## Token and resource optimization

This is a hard gate, not a suggestion. Optimize Claude Code's four-hour reset window,
weekly reset budget, and Codex usage discipline.

- Idle state makes zero model calls and performs no polling.
- Select the smallest suitable worker, model/effort, context, and number of runs.
- Use compact artifacts instead of replaying the conversation.
- Never run multiple owners on the same concern.
- At most one focused retry per failed gate and at most three worker runs per goal.
- Before a session/context window is constrained, persist a checkpoint and hand off.
- Dollar caps and model mapping wait for the benchmark branch; structural caps apply now.
- A resource budget failure transitions to STOPPED or BLOCKED, never to an unbounded retry.

## Cost, retry, and safety

- No always-on polling.
- The initial cap is at most one focused retry per failed gate and at most three worker
  runs per goal. Dollar caps and model mapping wait for the separate benchmark branch.
- Retry only with a changed input, owner, or strategy.
- Stop duplicate work and repeated checks.
- Escalate unresolved product decisions, access, security, and external side effects.
- Never claim completion from worker text without evidence.

## Initial implementation slice

The first code slice is dependency-free and testable without deployment:

- `docs/WORKSPACE-ARCHITECTURE.md`;
- `workspace/state.schema.json`;
- `workspace/events.schema.json`;
- `workspace/handoff.md`;
- `workspace/orchestrator.js` with `next`, `record`, `stop`, and `status`;
- `tests/workspace.test.js`.

## Acceptance criteria

- [ ] A plan defines the lifecycle, worker boundaries, state artifacts, gates, and tests.
- [ ] With no event, the orchestrator remains idle and makes zero model calls.
- [ ] A new goal creates one active handoff and one primary owner.
- [ ] A worker result advances state, triggers focused repair, reroutes, or becomes BLOCKED.
- [ ] The original task is preserved across handoffs.
- [ ] Duplicate ownership is rejected or surfaced.
- [ ] One retry per failed gate and three worker runs per goal are enforced.
- [ ] A DONE transition requires evidence for every required criterion.
- [ ] The workflow is testable without deploying this repository.
