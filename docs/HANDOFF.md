# Active Handoff

Status: HANDOFF
Goal: g-0001
Owner: qa
Surface: terminal
Worker runs: 0/3

## Original task (verbatim)

Verify the approved new MSJ Profiles appearance in the Vercel preview and review PR #3 before merge. Do not merge or deploy.

## Acceptance criteria

- [not checked] c1: The Vercel preview loads the approved appearance
- [not checked] c2: The seven-slide carousel navigation works with arrows, dots, keyboard, and placeholder-safe video/contact states
- [not checked] c3: The layout is readable and usable at desktop and phone widths
- [not checked] c4: No real client data is exposed and the approval notice remains visible
- [not checked] c5: The QA result and any unresolved findings are compactly handed off for merge review

## Next

{"action":"dispatch","owner":"qa","handoff":"docs/HANDOFF.md","runsLeft":3}

## Rules

- One active owner. Do not edit or verify a concern another owner holds.
- Do not rewrite the task or invent acceptance criteria. Missing or unclear criteria: report an Open question.
- A criterion is `pass` only with evidence (`commit:`, `pr:`, `ci:`, `command:`, `file:`, `screenshot:`). Otherwise it is `not checked`.
- Checkpoint before the session or context window is constrained. The orchestrator never merges.
