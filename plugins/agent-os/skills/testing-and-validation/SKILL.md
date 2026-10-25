---
name: testing-and-validation
description: Find the right checks for a project, run them, and report real results with evidence. Use for "test this", "does it work", "run the tests", "check the site", "cek hasilnya", after any code change, and before opening a PR.
---

# Testing and validation

## Inputs
- The project (and optionally the acceptance criteria to check).

## Steps
1. Find existing checks: `package.json` scripts (`test`, `lint`, `build`), test folders, CI files, a `scripts/` folder.
2. Run them. Capture the exit code and the last lines of output. Never claim a pass you did not see.
3. For static or visual web projects with no test suite, run the bundled screenshot check:
   `node "${CLAUDE_PLUGIN_ROOT}/skills/testing-and-validation/scripts/screenshot.js" [page] [outDir]`
   (run it from the project root; needs Playwright, which Claude Code cloud sessions have).
   It prints one `OK`/`FAIL` line per width (1440 and 390) with page overflow, broken images and console errors.
4. Check each acceptance criterion and mark it `pass`, `fail` or `not checked` (with the reason).
5. For a failure, give the exact command and output so it can be reproduced.

## Output
```
Command: <command>   Exit: <code>
Result: <last relevant lines>
Criteria: <criterion> - pass|fail|not checked (reason)
```
End with one line: `PASS`, `FAIL` or `PARTIAL`.

## Validation
- Every reported result comes from a command that actually ran in this session.
- Failures include a reproducible command.
- "Not checked" items say why (missing tool, no access, needs a person).
