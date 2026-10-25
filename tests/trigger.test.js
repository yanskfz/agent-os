// Tests for workspace/trigger.sh and .github/workflows/workspace-event.yml against a disposable local remote.
// No GitHub, model or network access. Run: node tests/trigger.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WORKFLOW = fs.readFileSync(path.join(ROOT, ".github/workflows/workspace-event.yml"), "utf8");
const SCRIPT = fs.readFileSync(path.join(ROOT, "workspace/trigger.sh"), "utf8");
const code = (s) => s.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
// assert.doesNotMatch would print the whole file on failure; this prints only the match.
function none(text, re, why) { const m = code(text).match(re); assert.ok(!m, `${why}: found "${m && m[0]}"`); }
const TASK = "Add a dark mode toggle to the settings page.\nKeep the existing tests green.";
const EV = ["commit:abc123", "command:npm test (exit 0)"];
const ID = ["-c", "user.name=test", "-c", "user.email=test@example.com"];

function git(cwd, args) { return spawnSync("git", args, { cwd, encoding: "utf8" }); }

// A scratch "GitHub": a bare remote plus a checkout of this repo's workspace/ code on main.
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trigger-"));
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  git(root, ["init", "-q", "--bare", "-b", "main", remote]);
  fs.mkdirSync(work);
  fs.cpSync(path.join(ROOT, "workspace"), path.join(work, "workspace"), { recursive: true });
  git(work, ["init", "-q", "-b", "main"]);
  git(work, [...ID, "add", "-A"]);
  git(work, [...ID, "commit", "-qm", "code"]);
  git(work, ["remote", "add", "origin", remote]);
  assert.equal(git(work, ["push", "-q", "origin", "main"]).status, 0);
  const summary = path.join(root, "summary.md");
  fs.writeFileSync(summary, "");
  const refs = () => git(remote, ["for-each-ref", "--format=%(refname) %(objectname)"]).stdout.trim();
  const show = (branch, file) => git(remote, ["show", `${branch}:${file}`]).stdout;
  const run = (event, env = {}) => {
    fs.writeFileSync(summary, "");
    const r = spawnSync("sh", ["workspace/trigger.sh"], { cwd: work, encoding: "utf8",
      env: { ...process.env, EVENT_JSON: event === undefined ? "" : typeof event === "string" ? event : JSON.stringify(event),
        STATE_BRANCH: "workspace-scratch", SENDER: "yanskfz", TRIGGERING_ACTOR: "yanskfz", WHO: "tester", RUN_URL: "http://example/run/1",
        GITHUB_STEP_SUMMARY: summary, ...env } });
    return { code: r.status, out: r.stdout, summary: fs.readFileSync(summary, "utf8") };
  };
  return { root, remote, work, refs, show, run };
}
const goal = { type: "goal", actor: "codex", task: TASK, owner: "claude-code", criteria: ["criterion 1", "criterion 2"] };
const dispatch = { type: "dispatch", actor: "orchestrator" };

test("idle: no event means no fetch, no write, no push, no model call", () => {
  const s = scratch();
  const before = s.refs();
  for (const e of [undefined, "", "   \n", "null"]) {
    const r = s.run(e);
    assert.equal(r.code, 0);
    assert.match(r.summary, /idle/);
    assert.equal(s.refs(), before, "remote untouched");
  }
  assert.deepEqual(fs.readdirSync(s.work).sort(), [".git", "workspace"], "working copy untouched");
  assert.equal(git(s.work, ["status", "--porcelain"]).stdout.trim(), "");
  none(SCRIPT, /\bgh\b|curl|wget|\bapi\.github|anthropic|claude/i, "no API, network or model call in the script");
});

test("a goal creates the state branch with only state, the original task intact, and leaves code branches alone", () => {
  const s = scratch();
  const mainBefore = git(s.remote, ["rev-parse", "main"]).stdout;
  const r = s.run(goal);
  assert.equal(r.code, 0, r.summary);
  assert.match(r.summary, /recorded/);
  assert.match(r.summary, /HANDOFF/);
  const files = git(s.remote, ["ls-tree", "-r", "--name-only", "workspace-scratch"]).stdout.trim().split("\n").sort();
  assert.deepEqual(files, ["docs/HANDOFF.md", "workspace/events.jsonl", "workspace/state.json"], "no code on the state branch");
  assert.ok(s.show("workspace-scratch", "docs/HANDOFF.md").includes(TASK));
  assert.equal(JSON.parse(s.show("workspace-scratch", "workspace/state.json")).task, TASK);
  assert.equal(git(s.remote, ["rev-parse", "main"]).stdout, mainBefore, "main did not move");
  assert.equal(git(s.remote, ["for-each-ref", "--format=%(refname)"]).stdout.trim().split("\n").sort().join(), "refs/heads/main,refs/heads/workspace-scratch");
  const msg = git(s.remote, ["log", "-1", "--format=%an%n%B", "workspace-scratch"]).stdout;
  assert.match(msg, /github-actions\[bot\]/);
  assert.match(msg, /Recorded for tester/);
});

test("later events append to the same branch; state and events stay valid", () => {
  const s = scratch();
  s.run(goal);
  assert.equal(s.run(dispatch).code, 0);
  const r = s.run({ type: "report", actor: "claude-code", results: [{ id: "c1", status: "pass", evidence: EV }, { id: "c2", status: "pass", evidence: EV }] });
  assert.equal(r.code, 0);
  assert.match(r.summary, /DONE/);
  assert.match(r.summary, /open_pr/);
  const events = s.show("workspace-scratch", "workspace/events.jsonl").trim().split("\n").map(JSON.parse);
  assert.deepEqual(events.map((e) => e.id), ["e-0001", "e-0002", "e-0003"]);
  assert.equal(git(s.remote, ["rev-list", "--count", "workspace-scratch"]).stdout.trim(), "3");
  assert.equal(JSON.parse(s.show("workspace-scratch", "workspace/state.json")).state, "DONE");
});

test("a rejected event fails visibly and changes nothing", () => {
  const s = scratch();
  s.run(goal);
  const before = s.refs();
  const second = s.run(goal);
  assert.equal(second.code, 2, "second concurrent goal is rejected");
  assert.match(second.summary, /rejected/);
  assert.match(second.summary, /wrong_state/);
  assert.match(second.out, /::error::event rejected/);
  const dup = s.run({ type: "dispatch", actor: "orchestrator", owner: "qa" });
  assert.equal(dup.code, 2);
  assert.match(dup.summary, /duplicate_owner/);
  assert.equal(s.run("{not json").code, 2);
  assert.equal(s.run({ type: "merge", actor: "orchestrator" }).code, 2);
  assert.equal(s.refs(), before, "remote unchanged after every rejection");
});

test("a BLOCKED state succeeds but is flagged as a warning with the reason", () => {
  const s = scratch();
  s.run(goal);
  s.run(dispatch);
  const r = s.run({ type: "block", actor: "claude-code", kind: "access", reason: "no push permission" });
  assert.equal(r.code, 0);
  assert.match(r.out, /::warning::workspace is BLOCKED/);
  assert.match(r.summary, /BLOCKED/);
  assert.match(r.summary, /no push permission/);
});

test("only workspace-* branches can be written, and never a code branch", () => {
  const s = scratch();
  const before = s.refs();
  for (const b of ["main", "feat/agent-orchestrator", "workspace", "x-workspace-a", "../etc", "workspace-a..b", "workspace-a b", "workspace-x.lock", "workspace-a;rm", "workspace-a$(id)"]) {
    const r = s.run(goal, { STATE_BRANCH: b });
    assert.equal(r.code, 3, b);
  }
  assert.equal(s.run(goal, { STATE_BRANCH: "workspace-ok/sub" }).code, 0, "a normal nested workspace branch is fine");
  assert.equal(git(s.remote, ["rev-parse", "main"]).stdout, before.split("\n").find((l) => l.startsWith("refs/heads/main")).split(" ")[1] + "\n");
});

test("a state that fails validation is never pushed", () => {
  const s = scratch();
  // A broken orchestrator that reports success but writes an invalid state: the trigger must catch it before pushing.
  fs.writeFileSync(path.join(s.work, "workspace/orchestrator.js"), `
    const fs = require("fs"); const path = require("path");
    const dir = process.argv[process.argv.indexOf("--dir") + 1];
    fs.mkdirSync(path.join(dir, "workspace"), { recursive: true });
    fs.writeFileSync(path.join(dir, "workspace/state.json"), JSON.stringify({ state: "NOT_A_STATE" }));
    console.log(JSON.stringify({ ok: true, state: "HANDOFF", event: "e-0001", next: {} }));`);
  const before = s.refs();
  const r = s.run(goal);
  assert.equal(r.code, 4);
  assert.match(r.summary, /failed validation/);
  assert.equal(s.refs(), before);
});

const asActor = (actor, extra = {}) => ({ ...goal, actor, ...extra });

test("authority comes from the GitHub sender: someone not on the allowlist cannot act as codex or the project owner", () => {
  const s = scratch();
  const before = s.refs();
  for (const claimed of ["codex", "project-owner", "orchestrator"]) {
    const r = s.run(asActor(claimed), { SENDER: "mallory", TRIGGERING_ACTOR: "mallory" });
    assert.equal(r.code, 6, claimed);
    assert.match(r.summary, /not authorized/);
    assert.match(r.summary, /sender_not_allowed/);
    assert.match(r.out, /::error::event not authorized/);
  }
  assert.equal(s.refs(), before, "nothing written, nothing pushed");
  assert.equal(s.run(goal).code, 0, "the allowlisted owner still can");
});

test("fail closed: no sender, missing or malformed allowlist, or a re-run by someone else is rejected", () => {
  const s = scratch();
  const before = s.refs();
  assert.equal(s.run(goal, { SENDER: "", TRIGGERING_ACTOR: "" }).code, 6, "no sender");
  assert.equal(s.run(goal, { TRIGGERING_ACTOR: "mallory" }).code, 6, "triggering actor not on the list even though the original actor is");
  assert.equal(s.run(goal, { ALLOWLIST: path.join(s.root, "missing.json") }).code, 6, "missing allowlist");
  const bad = path.join(s.root, "bad.json");
  for (const body of ["{not json", "{}", '{"version":2,"senders":{}}', '{"version":1,"senders":{"yanskfz":{}}}', "[]"]) {
    fs.writeFileSync(bad, body);
    assert.equal(s.run(goal, { ALLOWLIST: bad }).code, 6, body);
  }
  assert.equal(s.refs(), before);
});

test("an allowlisted sender can only act as the actors listed for them", () => {
  const s = scratch();
  const narrow = path.join(s.root, "narrow.json");
  fs.writeFileSync(narrow, JSON.stringify({ version: 1, senders: { yanskfz: { actors: ["claude-code", "orchestrator"] }, codexbot: { actors: ["codex"] } } }));
  const before = s.refs();
  const r = s.run(asActor("codex"), { ALLOWLIST: narrow });
  assert.equal(r.code, 6);
  assert.match(r.summary, /actor_not_allowed/);
  assert.equal(s.refs(), before);
  assert.equal(s.run(asActor("codex"), { ALLOWLIST: narrow, SENDER: "codexbot", TRIGGERING_ACTOR: "codexbot" }).code, 0, "the sender that may act as codex can");
  assert.equal(s.run({ type: "dispatch", actor: "claude-code" }, { ALLOWLIST: narrow, SENDER: "codexbot", TRIGGERING_ACTOR: "codexbot" }).code, 6, "and cannot act as anyone else");
});

test("logins are matched case-insensitively, as GitHub treats them", () => {
  const s = scratch();
  assert.equal(s.run(goal, { SENDER: "YansKFZ", TRIGGERING_ACTOR: "yanskfz" }).code, 0);
});

test("the recorded sender is the verified one, whatever the payload says", () => {
  const s = scratch();
  s.run({ ...goal, sender: "codex-impostor" });
  s.run({ ...dispatch, sender: "someone-else" });
  const events = s.show("workspace-scratch", "workspace/events.jsonl").trim().split("\n").map(JSON.parse);
  assert.deepEqual(events.map((e) => e.sender), ["yanskfz", "yanskfz"]);
  assert.match(s.run(dispatch).summary, /not authorized|rejected|wrong_state/, "sanity: a third dispatch is refused by the state machine");
  // A payload that names another sender does not help an unlisted user either.
  const r = s.run({ ...goal, sender: "yanskfz" }, { SENDER: "mallory", TRIGGERING_ACTOR: "mallory" });
  assert.equal(r.code, 6);
});

test("idle stays idle for everyone: no event is neither authorized nor written", () => {
  const s = scratch();
  const before = s.refs();
  for (const e of [undefined, "null", "  "]) assert.equal(s.run(e, { SENDER: "mallory", TRIGGERING_ACTOR: "mallory" }).code, 0);
  assert.equal(s.refs(), before);
});

test("a non-object event is rejected before any authority is considered", () => {
  const s = scratch();
  for (const e of ['"codex"', "42", "[1]", "{\"type\":\"goal\"}"]) assert.equal(s.run(e).code, 2, e);
});

test("pushes are never forced and never go to a code branch", () => {
  none(SCRIPT, /git push[^\n]*(--force|--force-with-lease|\s-f\b)|\+HEAD:|\+refs\//, "push must be a plain fast-forward push");
  const s = scratch();
  s.run(goal);
  // Another writer moves the branch after this run fetched it: the push must fail, not overwrite.
  const other = path.join(s.root, "other");
  git(s.root, ["clone", "-q", "-b", "workspace-scratch", s.remote, other]);
  fs.writeFileSync(path.join(other, "note.txt"), "other writer\n");
  git(other, [...ID, "add", "-A"]);
  git(other, [...ID, "commit", "-qm", "other"]);
  git(other, ["push", "-q", "origin", "workspace-scratch"]);
  const tip = git(s.remote, ["rev-parse", "workspace-scratch"]).stdout;
  assert.equal(s.run(dispatch).code, 0, "a run that fetches after the other writer builds on top of it");
  assert.notEqual(git(s.remote, ["rev-parse", "workspace-scratch"]).stdout, tip);
  assert.ok(git(s.remote, ["show", "workspace-scratch:note.txt"]).stdout.includes("other writer"), "the other writer's commit survived");
});

test("workflow: explicit events only, least privilege, no merge, event never interpolated into a shell", () => {
  const on = WORKFLOW.slice(WORKFLOW.indexOf("\non:"), WORKFLOW.indexOf("\npermissions:"));
  assert.match(on, /workflow_dispatch:/);
  assert.match(on, /repository_dispatch:/);
  none(on, /schedule|cron|push:|pull_request|workflow_run|issue_comment/, "no polling or implicit trigger");
  assert.match(WORKFLOW, /^permissions: \{\}$/m, "no default permissions");
  const perms = [...WORKFLOW.matchAll(/^\s+permissions:\n((?:\s{6,}\S.*\n)+)/gm)].map((m) => m[1].trim());
  assert.deepEqual(perms, ["contents: write"], "the job gets contents: write and nothing else");
  none(WORKFLOW, /pull-requests|actions: write|id-token|packages|issues:|gh pr|gh api|merge/i, "cannot merge or open PRs");
  assert.match(WORKFLOW, /cancel-in-progress: false/);
  assert.match(WORKFLOW, /concurrency:/);
  const runs = [...WORKFLOW.matchAll(/^\s+run: (.*)$/gm)].map((m) => m[1]);
  assert.deepEqual(runs, ["sh workspace/trigger.sh"]);
  assert.ok(runs.every((r) => !r.includes("${{")), "no expression inside a run command");
  assert.match(WORKFLOW, /EVENT_JSON: \$\{\{/);
});

test("workflow: the sender comes from GitHub and only the default branch's copy runs", () => {
  assert.match(WORKFLOW, /SENDER: \$\{\{ github\.actor \}\}/);
  assert.match(WORKFLOW, /TRIGGERING_ACTOR: \$\{\{ github\.triggering_actor \}\}/);
  assert.match(WORKFLOW, /if: github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/);
  assert.doesNotMatch(code(WORKFLOW), /SENDER:[^\n]*(inputs|client_payload)/, "the sender never comes from the payload or inputs");
  const allow = JSON.parse(fs.readFileSync(path.join(ROOT, "workspace/allowed-senders.json"), "utf8"));
  assert.deepEqual(Object.keys(allow.senders), ["yanskfz"], "initial allowlist is the owner only");
});

test("workflow and script agree on the contract", () => {
  assert.match(SCRIPT, /workspace-\*\)/);
  assert.match(WORKFLOW, /default: 'workspace-state'/);
  assert.match(WORKFLOW, /types: \[workspace-event\]/);
  for (const name of ["EVENT_JSON", "STATE_BRANCH", "SENDER", "TRIGGERING_ACTOR", "WHO", "RUN_URL"]) assert.match(WORKFLOW, new RegExp(`${name}:`));
});
