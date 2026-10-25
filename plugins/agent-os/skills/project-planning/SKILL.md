---
name: project-planning
description: Turn project requirements into a scoped plan with tasks, dependencies, acceptance criteria, risks and a definition of done. Use when the user describes something to build ("plan this", "break this down", "what do we need for X", "bikin rencana"), when a BRIEF.md is new or changed, or before starting any multi-step change.
---

# Project planning

Turn requirements into a plan someone can execute and check on a phone screen.

## Inputs
- The requirement: chat text, an issue, or the project's `BRIEF.md`.
- The repo itself, if one exists (read only what the plan needs).

## Steps
1. Read `BRIEF.md` if it exists. List what is known and what is missing. Never invent missing facts;
   mark them as `[placeholder]` and add them to Open questions.
2. Write the plan in this exact shape (Markdown, short lines):
   - **Scope**: in scope / out of scope, 2-5 bullets each.
   - **Tasks**: numbered, each one small enough for one PR or one session. Each task names the files it touches.
   - **Dependencies**: which task needs which (e.g. `3 needs 1`), plus outside blockers (data, access, approval).
   - **Acceptance criteria**: per task, checkable statements ("At 390 px wide, the page does not scroll sideways").
   - **Risks**: what could go wrong, with likelihood (low/med/high) and the mitigation.
   - **Definition of done**: the checklist for the whole project.
3. If the project has a `BRIEF.md`, update its Status, Open questions and Next step sections (see the `project-brief` skill).
4. If the project's rules require approval before work, stop after the plan and wait.

## Output
One Markdown plan with the six headings above, in that order. No code.

## Validation
- All six headings are present.
- Every task has at least one acceptance criterion.
- Every dependency points to a task number that exists.
- Nothing in the plan states a fact that is not in the inputs.
