# Active Handoff

Status: PLAN_REQUESTED
Branch: feat/agent-orchestrator
Implementation PIC: Claude Code
Requirements PIC: Codex
Review PIC: Codex

## Task

Design the first implementation plan for one AI Workspace project whose core is an
event-driven agent orchestrator. The MVP is GitHub-backed and terminal/code-first;
visual 2D and 3D work are later surfaces behind an adapter contract.

## Read first

- `AGENTS.md`
- `CLAUDE.md`
- `docs/AGENT-ROUTING-REQUIREMENT.md`
- `docs/ORCHESTRATOR-REQUIREMENT.md`
- `docs/REPORT-2026-10-25-routing-branch.md`
- `TEST-RESULTS.md`

## Constraints

- Plan only. Do not edit implementation files, create the orchestrator, or open a PR.
- Preserve the original task and intent; do not invent product decisions.
- The orchestrator must be idle by default and event-driven; no hidden always-on polling.
- GitHub is persistent shared state; Codex, Claude Code, and future surfaces communicate through artifacts and events.
- Terminal/code is the first implementation surface. 2D/3D are adapter contracts only in this slice.
- The orchestrator may open a PR but never merge automatically.
- Initial limits: one focused retry per failed gate and three worker runs per goal.
- Benchmarking and dollar/model mapping are out of scope for this slice.

## Required plan

Maximum 8 lines. Include:

1. AI Workspace boundary and MVP versus later surfaces;
2. state machine and lifecycle;
3. worker boundaries and adapters;
4. shared state and event protocol;
5. evidence-based quality gates;
6. retry, reroute, blocked behavior, and cost cap;
7. files, tests, and the first implementation slice;
8. checkable acceptance criteria.

If this task is not yours, return:

```md
Status: HANDOFF_REQUIRED
Owner:
Scope:
Reason:
Unresolved:
```
