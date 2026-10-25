# Active Handoff

Status: PLAN_REQUESTED
Branch: feat/agent-orchestrator
Implementation PIC: Claude Code
Requirements PIC: Codex
Review PIC: Codex

## Task

Design the first implementation plan for an event-driven agent orchestrator that
coordinates Codex requirements, Claude Code implementation, Product Design, QA,
review, and deployment verification without overlapping ownership or wasting model
tokens.

## Read first

- `AGENTS.md`
- `CLAUDE.md`
- `docs/AGENT-ROUTING-REQUIREMENT.md`
- `docs/REPORT-2026-10-25-routing-branch.md`
- `TEST-RESULTS.md`

## Constraints

- Plan only. Do not edit implementation files, create the orchestrator, or open a PR.
- Start from the current `main` state and this branch.
- Preserve the task and intent; do not invent product decisions.
- The orchestrator must be idle by default and wake on meaningful events.
- No hidden always-on polling loop.
- Use GitHub as persistent shared state where practical.
- Keep Codex as requirements/architecture/quality owner and Claude Code as implementation PIC.
- Benchmarking is out of scope for this plan unless it is explicitly isolated as a later experiment.

## Required plan

Maximum 8 lines. Include:

1. state machine and lifecycle;
2. worker boundaries and adapters;
3. shared state and handoff artifacts;
4. evidence-based quality gates;
5. retry, reroute, and blocked behavior;
6. cost budget and stop conditions;
7. files and tests to change;
8. checkable acceptance criteria.

If this task is not yours, return:

```md
Status: HANDOFF_REQUIRED
Owner:
Scope:
Reason:
Unresolved:
```
