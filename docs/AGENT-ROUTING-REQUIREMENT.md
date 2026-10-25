# Agent Routing and Cost Optimization Requirement

## Objective

Route each task to the smallest suitable agent and context, with one active owner,
explicit handoffs, and a quality-based escalation path. The user should not need
to manage agent order or model intensity manually.

## Hard rules

1. Run an agent-fit check before invoking any agent.
   - Classify the task as brief, planning, implementation, review, QA, deployment,
     design, or documentation.
   - Select one primary owner.
   - Do the work directly when the task is small and unambiguous.
   - Invoke a secondary agent only when its distinct output is required.

2. One task has one active owner.
   - `project-brief`: requirements, decisions, status, and next step.
   - `project-planner`: multi-step plans; no product code.
   - `developer`: one scoped implementation task with acceptance criteria.
   - `code-reviewer`: independent diff review; read-only.
   - `qa-agent`: executed checks and acceptance-criteria verification; no fixes.
   - `deployment-assistant`: deployment/readiness verification; read-only.
   - Product Design: visual direction, prototype, and design QA.
   - Codex or the project owner: requirement authority, routing, orchestration, and final synthesis.
     Claude Code cannot invoke Codex. When the required owner is unavailable, Claude Code
     records the ambiguity in `BRIEF.md` (Open questions) and hands off externally.

3. Do not duplicate work.
   - Do not plan a typo fix or a clearly scoped one-file change.
   - Do not make code review repeat the full QA suite.
   - Do not make QA perform code review.
   - Do not make deployment verification repeat application validation.
   - Do not make an implementation agent redesign the product unless the handoff
     explicitly changes the design scope.

4. Every handoff carries only the minimum useful context:
   - scope;
   - owner;
   - relevant files or screens;
   - acceptance criteria;
   - checks already run;
   - expected output;
   - unresolved questions.

5. Read the minimum context needed:
   - `BRIEF.md` and `CLAUDE.md` when present;
   - directly relevant files;
   - the previous handoff artifact, not the entire conversation.

6. Escalate only when justified:
   - requirement conflict or missing decision;
   - acceptance criteria cannot be checked;
   - the first result fails a quality gate;
   - the task crosses ownership boundaries;
   - access, security, or deployment state requires user input.

## Adaptive quality override

Routing is not permanent. If the user says the result is unsatisfactory, re-triage
before retrying. Identify whether the failure came from the requirement, wrong
owner, insufficient context, insufficient reasoning, or an untested assumption.
Then change only the failing part: refine the requirement, switch owner, add a
focused handoff, or increase reasoning intensity.

Do not rerun the full workflow with a larger model by default.

## Cost policy

- Use the lightest suitable mode for routing, extraction, formatting, and routine edits.
- Use medium reasoning for planning, documentation synthesis, and coordinated changes.
- Use higher reasoning for ambiguity, architecture, debugging, security, or conflicting evidence.
- Use the highest intensity only when a quality gate shows that it is justified.
- Prefer one focused pass with a compact artifact over repeated full-context passes.
- A model or agent must not be selected only because it is available.

## Handoff contract

```md
Scope:
Owner:
Inputs:
Acceptance criteria:
Checks already run:
Output expected:
Unresolved:
```

## Definition of done

- The primary owner matches the task.
- No two active owners edit or verify the same concern.
- Handoffs are compact and complete.
- Acceptance criteria have `pass`, `fail`, or `not checked`.
- The relevant brief or requirement records the current decision and next step.
- Any escalation has a reason and a focused follow-up.
