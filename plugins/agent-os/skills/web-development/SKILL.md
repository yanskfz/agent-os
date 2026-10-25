---
name: web-development
description: Implement web features or fixes inside an existing project, following that project's framework, file layout and conventions. Use for "build this page", "add a section", "fix the layout", "change the button", or any HTML/CSS/JS or framework change in a website or web app.
---

# Web development

## Inputs
- A scoped task with acceptance criteria (from `project-planning` or the user).
- The project's `CLAUDE.md` and `BRIEF.md`, if present.

## Steps
1. Read the project's rules first. Find the framework and conventions from the files themselves
   (package.json, existing components, CSS approach). Do not introduce a new framework, library or build step
   unless the user approved it.
2. Read only the files the task touches, plus one similar existing file to copy its style.
3. Make the smallest change that meets the acceptance criteria. Match naming, comment density and idiom.
4. Keep content and configuration where the project expects it (e.g. text in a content file, colors in theme tokens).
5. Accessibility basics on every UI change: real `<button>`/`<a>`, visible focus, alt text, contrast at least 4.5:1,
   respect `prefers-reduced-motion`.
6. Run the project's checks (see `testing-and-validation`). For visual changes, take screenshots at 1440 px and 390 px.
7. Commit on a feature branch with a short English message. Open a PR when asked.

## Output
- The changed files, committed on a branch.
- A report of at most 5 lines: what changed, how it was checked, what the user should look at.

## Validation
- Every acceptance criterion is checked and reported as pass or fail.
- The project's existing checks still pass.
- `git diff` contains only files the task needs.
