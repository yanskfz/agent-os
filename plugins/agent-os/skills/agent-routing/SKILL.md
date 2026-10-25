---
name: agent-routing
description: Select the smallest suitable owner, enforce non-overlapping handoffs, and escalate only when a quality gate or ambiguity requires it.
---

# Agent routing

Use this skill before invoking an agent or handing work to another platform.

## 1. Classify the task

Choose exactly one primary mode:

- **brief**: requirements, decisions, status, or open questions;
- **planning**: a multi-step change with dependencies;
- **design**: visual direction, prototype, or design QA;
- **implementation**: a scoped code change with acceptance criteria;
- **review**: independent review of a diff or design;
- **QA**: executed checks and acceptance-criteria verification;
- **deployment**: deployment or reachability verification;
- **documentation**: factual documentation or structured rewrite.

For a small, clear change, do the work directly. Do not invoke an agent only
because one exists.

## 2. Select one primary owner

Use this default map:

| Mode | Owner |
|---|---|
| brief | project-brief / Codex |
| planning | project-planner |
| design | Product Design |
| implementation | developer / Claude Code |
| review | code-reviewer / Codex |
| QA | qa-agent |
| deployment | deployment-assistant |
| documentation | Codex or the smallest suitable documentation workflow |

A secondary owner is allowed only when it supplies a distinct output that the
primary owner cannot produce.

### External owners

Codex, Product Design, and the project owner work outside Claude Code. Claude Code
cannot invoke them. When one of them is the required owner, record the decision or
ambiguity in `BRIEF.md` (Open questions), return a compact handoff, and stop. Do not
guess the missing requirement.

## 3. Build a compact handoff

Provide:

```md
Scope:
Owner:
Inputs:
Acceptance criteria:
Checks already run:
Output expected:
Unresolved:
```

Do not paste the full conversation when this artifact is sufficient.

## 4. Enforce boundaries

- Planner does not implement.
- Developer does not expand scope or redesign without a new decision.
- Reviewer does not edit.
- QA does not fix.
- Deployment verification does not deploy.
- Product Design owns visual decisions, not production code.
- Codex or the project owner owns requirement authority and final routing decisions.
  Claude Code records ambiguity in `BRIEF.md` and hands off externally when the
  required owner is unavailable.

## 5. Apply the quality override

If the user reports an unsatisfactory result:

1. stop repeating the same workflow;
2. identify the failure class: requirement, owner, context, reasoning, or
   untested assumption;
3. change only that part;
4. rerun the narrowest relevant gate;
5. record the decision and next step.

Escalate reasoning intensity only when the failure or task complexity justifies
it. A larger model is not a substitute for a clearer requirement.

## 6. Token discipline

- Read `BRIEF.md` and `CLAUDE.md` when present, then only relevant files.
- Prefer compact artifacts over transcript replay.
- Run each check once unless the result is invalid or the code changed.
- Do not have review, QA, and deployment repeat the same check.
- Stop when the requested acceptance criteria are met.

## Validation

Before handoff, confirm:

- one primary owner is named;
- the task belongs to that owner's mode;
- the acceptance criteria are checkable;
- no other active owner is editing or verifying the same concern;
- the output expected from the handoff is explicit.
