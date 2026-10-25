# AGENTS.md

## Collaboration contract

This repository is the shared implementation surface for Codex and Claude Code.

- Codex is the requirements, architecture, routing, and quality-gate owner.
- Claude Code is the implementation owner for scoped repository changes.
- Product Design owns visual direction and design QA when explicitly invoked.
- QA owns executed verification; the reviewer owns independent findings.
- Deployment verification is read-only unless the user explicitly authorizes a deployment.

## PIC rule

Before acting, identify the primary owner for the task.

If the current agent is not the PIC, or the task crosses an ownership boundary,
return a compact handoff and stop. Do not edit files merely because the agent can.

## Ambiguity rule

Preserve the user's task and intent when handing it to another agent. Do not rewrite
an ambiguous request into detailed implementation steps.

For implementation, review, QA, and deployment work, missing acceptance criteria
requires an Open question and handoff rather than guessing.

For requirements and planning work, ambiguity is an input: record assumptions,
Open questions, and checkable acceptance criteria.

## Shared state

- `BRIEF.md` is the project state and requirement source.
- `docs/HANDOFF.md` is the single active handoff.
- Reports must record evidence, not claims.
- Only one active owner may edit or verify a concern at a time.

## Change discipline

Read the relevant brief, handoff, and repository rules first. Read only the files
needed for the task. Do not touch unrelated files. Run the narrowest relevant checks,
then report what actually ran.

## Orchestrator work

The orchestrator must be event-driven, budgeted, evidence-based, and stoppable.
It may reroute work when a quality gate fails, but it must escalate to the project
owner for unresolved product decisions, access, security, or irreversible actions.
