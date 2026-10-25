# Agent Orchestrator Requirement

## Objective

Build a stoppable, event-driven orchestrator for this repository's agent workflow.
Given one project goal, it should route work to the correct owner, preserve the
original intent, pass compact handoffs, inspect evidence, and continue until the
quality gate passes or a real blocker requires the project owner.

## Roles

- Codex: requirements, architecture, routing, quality gates, and final synthesis.
- Claude Code: implementation of scoped repository tasks.
- Product Design: visual direction, prototype, and design QA when invoked.
- QA: executed tests and acceptance-criteria verification.
- Reviewer: independent code or design findings.
- Deployment assistant: read-only deployment verification.

## Lifecycle

The default lifecycle is:

`INTAKE → REQUIREMENTS → DESIGN → IMPLEMENT → VERIFY → REPAIR → DONE`

Any state may transition to `BLOCKED` when an owner decision, access, security
approval, or irreversible action is required.

The orchestrator is idle when there is no active goal and wakes only on a new goal,
a worker report, a commit or PR event, a failed check, or explicit user feedback.

## Non-overlap rules

- One active owner per concern.
- A worker receives the original task plus compact context; the orchestrator must
  not invent acceptance criteria while delegating.
- Product Design does not own production code.
- Claude Code does not decide unresolved product requirements.
- QA and reviewer do not fix the implementation they evaluate.
- Deployment verification does not deploy.

## Evidence gates

Every transition must identify its evidence:

- requirements: brief, decisions, Open questions, acceptance criteria;
- design: selected direction and responsive/design guard evidence;
- implementation: changed files and relevant checks;
- verification: command output, screenshots, or status evidence;
- repair: failed criterion and focused corrective task.

## Cost and safety

- No always-on polling.
- Use the smallest suitable model/effort and a per-run budget.
- Stop duplicate work and repeated checks.
- Retry only with a changed input, owner, or strategy.
- Escalate unresolved product decisions and external side effects.
- Never claim completion from a worker's text without evidence.

## Initial acceptance criteria

- [ ] A plan defines the lifecycle, worker boundaries, state artifacts, gates, and tests.
- [ ] The orchestrator can remain idle without model calls.
- [ ] A new goal creates one active handoff and one primary owner.
- [ ] A worker result can move the state forward, trigger focused repair, or become BLOCKED.
- [ ] The original task is preserved across handoffs.
- [ ] Duplicate ownership is rejected or surfaced.
- [ ] Budget and maximum retry limits are enforced.
- [ ] The workflow is testable without deploying this repository.
