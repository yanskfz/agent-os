---
name: project-brief
description: Create or update the project's BRIEF.md, the single file that holds requirements, current status, open questions, decisions and the next step, so any new session can continue without the user re-explaining. Use at the start of a new project ("new project", "create requirements", "bikin brief"), whenever requirements or decisions change, and at the end of every task.
---

# Project brief

`BRIEF.md` in the project root is the one file a new session reads to know where things stand.
The agent-os plugin prints its Status, Open questions and Next step at every session start.

## Inputs
- The user's description of the project, or an existing `BRIEF.md`.

## Steps
1. If `BRIEF.md` is missing, copy `${CLAUDE_PLUGIN_ROOT}/skills/project-brief/templates/BRIEF.md` to the project root
   and fill it from what the user said. Unknown values stay as `[ ]`. Never guess.
2. Keep these sections, in this order, with these exact headings (the session hook looks for them):
   `## Status`, `## Open questions`, `## Next step`, then `## Decisions`, `## Requirements`, `## Data`, `## Done when`.
3. At the end of every task, update:
   - **Status**: stage, current branch and PR links, preview links, date (YYYY-MM-DD).
   - **Open questions**: add new ones, tick answered ones (`- [x]`) and move the answer into Decisions.
   - **Next step**: one or two lines that a new session can act on without asking.
   - **Decisions**: one line per final decision with the date, so it is not discussed again.
4. Keep the top three sections short (under about 25 lines together): they are injected into every session.

## Output
An updated `BRIEF.md`, committed with the task's other changes.

## Validation
- The three top headings exist exactly as written.
- Next step is concrete (names a file, branch, PR or person).
- No invented facts; every unknown is `[ ]` or an open question.
