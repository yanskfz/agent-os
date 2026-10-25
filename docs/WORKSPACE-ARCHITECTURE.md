# AI Workspace architecture (MVP slice)

Implements `docs/ORCHESTRATOR-REQUIREMENT.md`. Codex owns the requirement; this file describes what the code does.

## Boundary

One AI Workspace project in this repository. `workspace/orchestrator.js` is the runtime; the agent-os plugin is its worker pack.
MVP: GitHub-backed, terminal/code surface, Claude Code as the implementation worker. The 2D and 3D surfaces exist only as the
adapter contract below; a goal with `surface` other than `terminal` is rejected (`adapter_not_implemented`).

The orchestrator is a CLI, not a daemon. It reads one event, validates it against the current state, writes the result, and exits.
It imports no process, network or model module, so with no event it costs nothing. Something external (a person, a GitHub
Action, a scheduled task) must call it. This slice does not provide those triggers and does not call `gh`.

## Lifecycle

```
IDLE -> INTAKE -> TRIAGE -> HANDOFF -> WORKING -> EVIDENCE -> GATE -> DONE | RETRY | REROUTE | BLOCKED | STOPPED
```

`goal` walks IDLE to HANDOFF in one write. `report` walks WORKING to a gate outcome in one write. `RETRY` and `REROUTE` return to
`WORKING` through `dispatch`. `BLOCKED` returns to `HANDOFF` through `unblock`. `DONE` and `STOPPED` accept a new `goal`.
`stop` works from every active state. The table is `TRANSITIONS` in the code; any move not listed throws.

## Events

`node workspace/orchestrator.js record` reads one JSON event (stdin or `--file`). Rejected events exit 2 and write nothing.

| type | actor | allowed in | effect |
|------|-------|-----------|--------|
| `goal` | codex, project-owner | IDLE, DONE, STOPPED | needs `task`, `owner`, `criteria[]`; creates the handoff |
| `dispatch` | orchestrator, codex, project-owner | HANDOFF, RETRY, REROUTE | starts a worker run; RETRY needs `change {kind: input\|owner\|strategy, value}` |
| `report` | the active owner only | WORKING | `results[] {id, status, evidence[]}`, optional `reroute_to`; runs the gate |
| `block` | any | HANDOFF, WORKING, RETRY, REROUTE | `kind` decision, access, security or external, plus `reason` |
| `unblock` | codex, project-owner | BLOCKED | needs `note` (the changed input); not for budget or retry blocks |
| `checkpoint` | any | HANDOFF, WORKING, RETRY, REROUTE, BLOCKED | stores `note` and `next` so a fresh session can resume |
| `pr_opened` | any | DONE | records `pr:<url>`; the orchestrator never merges |
| `stop` | any | any active state | STOPPED; a no-op when nothing is active |

`merge` and unknown types are rejected.

## Shared state

| File | Role |
|------|------|
| `workspace/state.json` | current state, owner, criteria, run and retry counters, last checkpoint (`state.schema.json`) |
| `workspace/events.jsonl` | append-only; one line per accepted event: id, type, actor, task, ts, evidence, from, to, transitions (`events.schema.json`) |
| `docs/HANDOFF.md` | the one active handoff, rendered from `workspace/handoff.md`; the original task is copied verbatim |
| `BRIEF.md` | goal, decisions, Open questions; written by people and agents, not by the orchestrator |

Events are written before state. A crash between the two leaves an extra event line, never a state with no event behind it.

## Gates and limits

- A criterion is `pass`, `fail` or `not checked`. Evidence must be a reference of the form `commit:`, `pr:`, `ci:`, `command:`,
  `file:` or `screenshot:`. A `pass` or `fail` without such a reference is stored as `not checked`.
- `DONE` only when every criterion is `pass` with evidence. Otherwise the gate outcome is one of:
  - `REROUTE` when the report names `reroute_to` (another valid owner; no retry is spent);
  - `RETRY` the first time a criterion is open;
  - `BLOCKED` (kind `retry`) when a criterion is still open after its one retry.
- A retry needs a changed input, owner or strategy that was not tried before.
- At most 3 worker runs per goal. The fourth `dispatch` ends in `BLOCKED` (kind `budget`) and never starts. Neither cap can be lifted
  by `unblock`; stop and set a new goal.
- Dollar caps and model mapping are out of scope (separate benchmark branch).
- The evidence check is a format check only. It does not prove that the commit, PR, CI run, file or screenshot exists, and it must
  not be described as proof. Resolving references (marking them `verified` or `unverified`) is a later, optional verifier or CI gate
  so that `record` stays dependency-free and works without credentials.

## Surface adapter contract (2D, 3D: not implemented)

A surface adapter declares three things and nothing else:

1. inputs: the handoff fields it needs from `state.json` and `docs/HANDOFF.md`;
2. outputs: the artifacts it produces (design file, prototype URL, screenshots);
3. evidence: the `file:`, `screenshot:` or `ci:` references that prove each criterion.

It reports through the same `report` event and owns no production code. Adding one later means extending `surface` in the schema
and the goal check, not changing the state machine.

## Tests

`node tests/workspace.test.js` (16 tests, dependency-free, no model) and `node tests/trigger.test.js` (10 tests, local git only). They drive the real CLI against scratch directories and
validate every written state and event against the schemas.

CI: `.github/workflows/workspace-tests.yml` runs the same command on Node 22 for pull requests to, and pushes on, `feat/agent-orchestrator`,
with `contents: read` only. Making it a required status is a repository branch-protection setting, not part of the workflow file.

## Event trigger (GitHub Action)

`.github/workflows/workspace-event.yml` runs `workspace/trigger.sh`, which records one event on a state branch.

- **Triggers:** `workflow_dispatch` and `repository_dispatch` (type `workspace-event`) only. No schedule, push or pull_request trigger, so
  nothing runs unless someone sends an event. An empty or `null` event exits idle: no fetch, no write, no push, no model call.
- **Payload:** one orchestrator event as JSON. `gh workflow run workspace-event.yml -f state_branch=workspace-scratch -f event='{...}'`, or
  `POST /repos/{owner}/{repo}/dispatches` with `{"event_type":"workspace-event","client_payload":{"event":{...},"state_branch":"..."}}`.
  The event reaches the script through an environment variable and is never interpolated into a shell command.
- **State branch:** `workspace-state` by default; the name must start with `workspace-`, so a code branch can never be written. The first event
  creates an orphan branch that holds only `workspace/state.json`, `workspace/events.jsonl` and `docs/HANDOFF.md`. The hand-written
  `docs/HANDOFF.md` on code branches is never touched.
- **After each event:** `workspace/validate.js` checks the written state and every event against the schemas, event ids are sequential, and the
  handoff still contains the original task verbatim. Only then is the commit pushed, with a plain (never forced) push.
- **Evidence in the Action:** a rejected event fails the job (exit 2, `::error::`, the rejection code in the run summary, nothing written). A
  `BLOCKED` state succeeds but adds a `::warning::` and a summary line with the reason. Every recorded run shows state, branch, next action and who sent it.
- **Concurrency:** runs are serialized per state branch (`cancel-in-progress: false`). GitHub keeps one running and one pending run, so a third
  event sent while two are queued is cancelled and shows as a cancelled run: resend it. The state machine also rejects a second goal while one is active.
- **Permissions:** `permissions: {}` for the workflow and `contents: write` for the one job, to push the state branch. No pull-requests permission, no
  merge call anywhere; `tests/trigger.test.js` fails if either appears.
- **Limits:**
  - Anyone with write access can send an event, and the `actor` inside the payload is not authenticated. Treat the dispatch right as the
    authority check, or put the job behind a protected environment.
  - `repository_dispatch` only runs from the workflow file on the default branch (`main`). `workflow_dispatch` is the way to try it before that.
  - The first push of an orphan state branch needs the repository to allow the Actions token to push; a branch ruleset on `workspace-*` would block it.

Tested without GitHub in `tests/trigger.test.js` against a scratch bare remote (10 tests, mutation-checked).

## Follow-ups, in the order Codex set

1. CI job: done.
2. Main-session delegation routing: done (Test I and the `SessionStart` hook).
3. Real event trigger: this section.
