# CLAUDE.md: Company profile site

One-screen static carousel site for a small business. Built from the agent-os `company-profile` template.
Shared skills, agents and hooks come from the agent-os plugin (enabled in `.claude/settings.json`).

## Read first
1. `BRIEF.md` (its top is also printed at session start): status, open questions, next step, requirements.
2. This file.
3. Only the files you are about to change.

## Hard rules
1. Before any task, write a plan of at most 8 lines and wait for "lanjut" (or the owner's go word in BRIEF.md).
2. No production deploy or custom domain until the approval phrase in `BRIEF.md` is written in chat.
3. No real phone numbers, emails, addresses or names in code until the owner provides them.
4. Never invent facts (years, counts, client names, certificates, claims like "best"). Use `[placeholders]`.
5. No new library, framework or build step without permission. Plain HTML, CSS and JS.
6. Never commit secrets. Never delete files or branches, never force-push to `main`, without permission.
7. Everything in git is in English. Site copy is in the client's language and lives only in `client/content.js`.
8. At the end of every task, update `BRIEF.md` (Status, Open questions, Next step, Decisions).

## Structure
```
index.html, css/style.css, js/carousel.js   ENGINE  same for every client
client/content.js                            CLIENT  all site text
client/theme.css                             CLIENT  font, colors, radius
client/img/                                  CLIENT  photos, 1080x896
BRIEF.md                                     CLIENT  requirements + status
mockups/                                     CLIENT  mockup pages + screenshots
```
A new client changes only CLIENT files. Engine changes must work for every client.

## Workflow (gates)
1. Brief: fill `BRIEF.md` (skill: project-brief / project-planning). Gate: owner says "lanjut".
2. Mockup: `mockups/v1.html` with grey boxes; screenshot it (skill: testing-and-validation). Gate: "lanjut build".
3. Build on `feat/<name>` (agent: developer), review (agent: code-reviewer), check (agent: qa-agent), open a PR.
4. Preview: Vercel comments a protected preview link on the PR (agent: deployment-assistant to verify).
5. Production: owner merges after the approval phrase.

## Quality
1440 px and 390 px look right; no page scroll on desktop; real buttons and links; visible focus;
contrast at least 4.5:1; alt text on every photo; no console errors; reduced motion respected; placeholders in [brackets].

## Talking to the owner
Short messages, simple words, visuals over text. End-of-task report: at most 5 lines.
