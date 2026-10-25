#!/bin/sh
# Records one orchestrator event on a dedicated state branch. Called by .github/workflows/workspace-event.yml and by the
# tests; it never calls a model, `gh` or the GitHub API, and it never merges. Run it from a checkout of this repository.
#
# Env:  EVENT_JSON    one event as JSON (see docs/WORKSPACE-ARCHITECTURE.md); empty or "null" means idle
#       STATE_BRANCH  branch that holds workspace/state.json, workspace/events.jsonl, docs/HANDOFF.md
#                     (default workspace-state; must start with "workspace-", so code branches cannot be written)
#       REMOTE        git remote to read and push (default origin)
#       WHO, RUN_URL  recorded in the commit message and the summary
# Exit: 0 recorded, idle or no-op   2 event rejected   3 bad state branch   4 written state failed validation   5 git failed
set -u
REMOTE="${REMOTE:-origin}"
STATE_BRANCH="${STATE_BRANCH:-workspace-state}"
EVENT_JSON="${EVENT_JSON:-}"
WHO="${WHO:-unknown}"
RUN_URL="${RUN_URL:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

say() { printf '%s\n' "$*" >> "$SUMMARY"; }

trimmed="$(printf '%s' "$EVENT_JSON" | tr -d ' \t\r\n')"
if [ -z "$trimmed" ] || [ "$trimmed" = "null" ]; then
  say "### Workspace event: idle"
  say "No event was provided, so nothing was read, written or pushed and no model was called."
  exit 0
fi

case "$STATE_BRANCH" in
  workspace-*) ;;
  *) echo "::error::state branch '$STATE_BRANCH' must start with 'workspace-'"; say "### Workspace event: refused"; say "State branch \`$STATE_BRANCH\` must start with \`workspace-\`."; exit 3 ;;
esac
if printf '%s' "$STATE_BRANCH" | grep -Eq '[^A-Za-z0-9._/-]|\.\.|//|/$|\.lock$'; then
  echo "::error::state branch '$STATE_BRANCH' has characters that are not allowed"; say "### Workspace event: refused"; exit 3
fi

STATE_DIR="$(mktemp -d)"
trap 'git worktree remove --force "$STATE_DIR" >/dev/null 2>&1; rm -rf "$STATE_DIR"' EXIT
if git ls-remote --exit-code --heads "$REMOTE" "$STATE_BRANCH" >/dev/null 2>&1; then
  git fetch -q --depth=1 "$REMOTE" "$STATE_BRANCH" && git worktree add -q -B "$STATE_BRANCH" "$STATE_DIR" FETCH_HEAD || exit 5
else
  # First event: an orphan branch that holds only state, never code.
  git worktree add -q --detach "$STATE_DIR" HEAD || exit 5
  ( cd "$STATE_DIR" && git checkout -q --orphan "$STATE_BRANCH" && git rm -rfq . ) || exit 5
fi

OUT="$(printf '%s' "$EVENT_JSON" | node "$HERE/orchestrator.js" record --dir "$STATE_DIR" 2>"$STATE_DIR/.err")"
CODE=$?
ERR="$(cat "$STATE_DIR/.err" 2>/dev/null)"
rm -f "$STATE_DIR/.err"
if [ "$CODE" -ne 0 ]; then
  echo "::error::event rejected: $ERR"
  say "### Workspace event: rejected (exit $CODE)"
  say '```json'; say "$ERR"; say '```'
  say "Nothing was written or pushed."
  exit 2
fi

if ! VERR="$(node "$HERE/validate.js" --dir "$STATE_DIR" 2>&1 >/dev/null)"; then
  echo "::error::written state failed validation: $VERR"
  say "### Workspace event: state failed validation"; say '```json'; say "$VERR"; say '```'; say "Nothing was pushed."
  exit 4
fi

STATE="$(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(o.noop?"NOOP":o.state)})')"
if [ "$STATE" = "NOOP" ]; then
  say "### Workspace event: no-op"; say "Nothing was active, so nothing was written or pushed."
  exit 0
fi

( cd "$STATE_DIR" && git add workspace/state.json workspace/events.jsonl docs/HANDOFF.md ) || exit 5
if ! ( cd "$STATE_DIR" && git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -q -m "workspace: $STATE ($(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).event))'))" \
  -m "Recorded for $WHO. $RUN_URL" ); then exit 5; fi
# A normal push: if another writer got there first this fails instead of overwriting.
( cd "$STATE_DIR" && git push -q "$REMOTE" "HEAD:refs/heads/$STATE_BRANCH" ) || { echo "::error::push to $STATE_BRANCH failed"; say "### Workspace event: push failed"; exit 5; }

NEXT="$(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s).next)))')"
say "### Workspace event: recorded"
say "- state: \`$STATE\`"
say "- branch: \`$STATE_BRANCH\`"
say "- next: \`$NEXT\`"
say "- by: $WHO $RUN_URL"
if [ "$STATE" = "BLOCKED" ]; then
  echo "::warning::workspace is BLOCKED: $NEXT"
  say ""; say "**BLOCKED.** A person has to act: \`$NEXT\`"
fi
exit 0
