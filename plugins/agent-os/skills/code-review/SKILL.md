---
name: code-review
description: Review a code change for correctness, bugs, security issues, maintainability and missing tests, and report concrete findings with severity. Use for "review this", "check my PR", "is this safe to merge", "cek kodenya", or before merging any branch.
---

# Code review

## Inputs
- What to review: the current branch diff (`git diff <base>...HEAD`), a PR, or named files.
- The task's acceptance criteria, if known.

## Steps
1. Get the diff. Read the changed lines plus enough surrounding code to understand them.
2. Check, in order:
   - **Correctness**: does it do what the task says? Off-by-one, wrong conditions, unhandled empty or missing values.
   - **Bugs**: runtime errors, broken references (missing files, wrong IDs, wrong paths), race conditions.
   - **Security**: secrets in code, unsafe HTML injection (`innerHTML` with outside data), open redirects, overly broad permissions.
   - **Maintainability**: duplication, unclear names, client data inside shared/engine code.
   - **Missing tests**: behavior that changed but no check covers it.
3. For each suspected issue, confirm it from the code (or by running it) before reporting. Drop anything you cannot confirm.

## Output
A list, most severe first. Each finding:
`[severity] file:line - what is wrong - how it fails (concrete input or scenario) - suggested fix`
Severity: `critical` (data loss, security, site down), `major` (visible bug), `minor` (small bug or risk), `nit` (style).
If nothing is found, say "No findings" and list what was checked.

## Validation
- Every finding has a file and line and a concrete failure scenario.
- No finding is speculative; unconfirmed ideas go under "Not verified" or are dropped.
- The review does not change code unless the user asked for fixes.
