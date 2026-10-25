// Deterministic tests for workspace/orchestrator.js. No model, no network, no deployment.
// Run: node tests/workspace.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ORCH = path.join(ROOT, "workspace/orchestrator.js");
const orch = require(ORCH);
const STATE_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, "workspace/state.schema.json"), "utf8"));
const EVENT_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, "workspace/events.schema.json"), "utf8"));

const TASK = "Add a dark mode toggle to the settings page.\nKeep the existing tests green.";
const EV = ["commit:abc123", "command:npm test (exit 0)"];

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "workspace-")); }
function cli(dir, args, event) {
  const r = spawnSync(process.execPath, [ORCH, ...args, "--dir", dir], { encoding: "utf8", input: event ? JSON.stringify(event) : "" });
  const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  return { code: r.status, out: parse(r.stdout), err: parse(r.stderr) };
}
const rec = (dir, ev) => cli(dir, ["record"], ev);
const status = (dir) => cli(dir, ["status"]).out;
const raw = (dir) => ["workspace/state.json", "workspace/events.jsonl", "docs/HANDOFF.md"].map((f) => { try { return fs.readFileSync(path.join(dir, f), "utf8"); } catch { return null; } }).join("\u0000");
const goal = (dir, n = 2, extra = {}) => rec(dir, { type: "goal", actor: "codex", task: TASK, owner: "claude-code", criteria: Array.from({ length: n }, (_, i) => `criterion ${i + 1}`), ...extra });
const dispatch = (dir, extra = {}) => rec(dir, { type: "dispatch", actor: "orchestrator", ...extra });
const pass = (id) => ({ id, status: "pass", evidence: EV });
const failed = (id) => ({ id, status: "fail", evidence: ["command:npm test (exit 1)"] });
const report = (dir, results, extra = {}) => rec(dir, { type: "report", actor: "claude-code", results, ...extra });

// Minimal JSON Schema subset: type, const, enum, required, properties, items, pattern, minimum, minLength.
function check(schema, v, at = "$") {
  const errs = [];
  const t = (x) => (x === null ? "null" : Array.isArray(x) ? "array" : Number.isInteger(x) ? "integer" : typeof x);
  if (schema.const !== undefined && v !== schema.const) errs.push(`${at}: expected ${schema.const}`);
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${at}: ${JSON.stringify(v)} not in enum`);
  if (schema.type) {
    const ok = [].concat(schema.type).some((k) => k === t(v) || (k === "number" && typeof v === "number"));
    if (!ok) { errs.push(`${at}: type ${t(v)}`); return errs; }
  }
  if (typeof v === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) errs.push(`${at}: pattern`);
    if (schema.minLength && v.length < schema.minLength) errs.push(`${at}: too short`);
  }
  if (typeof v === "number" && schema.minimum !== undefined && v < schema.minimum) errs.push(`${at}: below minimum`);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const k of schema.required || []) if (!(k in v)) errs.push(`${at}.${k}: missing`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in v) errs.push(...check(s, v[k], `${at}.${k}`));
  }
  if (Array.isArray(v) && schema.items) v.forEach((x, i) => errs.push(...check(schema.items, x, `${at}[${i}]`)));
  return errs;
}
function assertValid(dir) {
  const s = status(dir);
  assert.deepEqual(check(STATE_SCHEMA, s), [], "state.json matches state.schema.json");
  const f = path.join(dir, "workspace/events.jsonl");
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split("\n").filter(Boolean)) assert.deepEqual(check(EVENT_SCHEMA, JSON.parse(l)), [], l);
}

test("idle: no event means no state change, no files, no model call", () => {
  const dir = tmp();
  assert.equal(status(dir).state, "IDLE");
  assert.deepEqual(cli(dir, ["next"]).out, { action: "none" });
  assert.deepEqual(fs.readdirSync(dir), [], "status and next wrote nothing");
  assert.deepEqual(check(STATE_SCHEMA, status(dir)), []);
  const src = fs.readFileSync(ORCH, "utf8").replace(/^\/\/.*$/gm, "");
  assert.doesNotMatch(src, /child_process|require\(["'](node:)?(https?|net|tls|dgram|dns)["']\)|\bfetch\s*\(|\bspawn|\bexec/, "no process, network or model access");
  assert.doesNotMatch(src, /setInterval|setTimeout|watch\(|watchFile/, "no polling");
});

test("a new goal creates one handoff and one primary owner, with the task verbatim", () => {
  const dir = tmp();
  const r = goal(dir);
  assert.equal(r.code, 0);
  assert.equal(r.out.state, "HANDOFF");
  const s = status(dir);
  assert.equal(s.owner, "claude-code");
  assert.equal(s.task, TASK);
  assert.ok(fs.readFileSync(path.join(dir, "docs/HANDOFF.md"), "utf8").includes(TASK));
  const events = fs.readFileSync(path.join(dir, "workspace/events.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].transitions, ["IDLE>INTAKE", "INTAKE>TRIAGE", "TRIAGE>HANDOFF"]);
  assert.deepEqual(cli(dir, ["next"]).out, { action: "dispatch", owner: "claude-code", handoff: "docs/HANDOFF.md", runsLeft: 3 });
  assertValid(dir);
});

test("a goal without task, owner or criteria is rejected and writes nothing", () => {
  for (const bad of [{ task: "" }, { owner: "nobody" }, { criteria: [] }, { criteria: [""] }]) {
    const dir = tmp();
    const r = goal(dir, 2, bad);
    assert.equal(r.code, 2);
    assert.equal(r.err.code, "missing_requirement");
    assert.deepEqual(fs.readdirSync(dir), []);
  }
  const dir = tmp();
  assert.equal(goal(dir, 2, { actor: "claude-code" }).err.code, "not_requirements_owner", "Claude Code cannot decide requirements");
});

test("2D and 3D surfaces are adapter contracts only", () => {
  for (const surface of ["2d", "3d"]) {
    const dir = tmp();
    assert.equal(goal(dir, 2, { surface }).err.code, "adapter_not_implemented");
    assert.deepEqual(fs.readdirSync(dir), []);
  }
});

test("duplicate ownership is rejected and leaves state untouched", () => {
  const dir = tmp();
  goal(dir);
  const before = raw(dir);
  assert.equal(goal(dir).err.code, "wrong_state", "second goal while one is active");
  assert.equal(dispatch(dir, { owner: "qa" }).err.code, "duplicate_owner");
  dispatch(dir);
  const mid = raw(dir);
  assert.equal(rec(dir, { type: "report", actor: "qa", results: [pass("c1")] }).err.code, "duplicate_owner");
  assert.equal(dispatch(dir).err.code, "wrong_state", "already WORKING");
  assert.equal(raw(dir), mid);
  assert.notEqual(before, mid);
});

test("claims without evidence are `not checked`, and DONE needs evidence for every criterion", () => {
  const dir = tmp();
  goal(dir);
  dispatch(dir);
  const r = report(dir, [{ id: "c1", status: "pass" }, { id: "c2", status: "pass", evidence: ["report: worker says it works", "looks fine"] }]);
  assert.equal(r.out.state, "RETRY", "unevidenced passes cannot reach DONE");
  const s = status(dir);
  assert.deepEqual(s.criteria.map((c) => c.status), ["not checked", "not checked"]);
  assert.equal(report(dir, [pass("c1")]).err.code, "wrong_state");
  assertValid(dir);
});

test("DONE requires every criterion pass with evidence, then open_pr is emitted, never a merge", () => {
  const dir = tmp();
  goal(dir);
  dispatch(dir);
  const r = report(dir, [pass("c1"), pass("c2")]);
  assert.equal(r.out.state, "DONE");
  assert.deepEqual(r.out.next, { action: "open_pr" });
  assert.equal(rec(dir, { type: "pr_opened", actor: "orchestrator", pr: "no-prefix" }).err.code, "bad_event");
  assert.equal(rec(dir, { type: "pr_opened", actor: "orchestrator", pr: "pr:https://github.com/yanskfz/agent-os/pull/3" }).code, 0);
  assert.deepEqual(cli(dir, ["next"]).out, { action: "none" });
  const m = rec(dir, { type: "merge", actor: "orchestrator" });
  assert.equal(m.err.code, "forbidden");
  assert.doesNotMatch(fs.readFileSync(ORCH, "utf8").replace(/^\/\/.*$/gm, ""), /\bgh\b|git merge|pulls\/.*merge/);
  assertValid(dir);
});

test("one focused retry per failed gate, only with a changed input, owner or strategy", () => {
  const dir = tmp();
  goal(dir);
  dispatch(dir);
  assert.equal(report(dir, [pass("c1"), failed("c2")]).out.state, "RETRY");
  assert.deepEqual(cli(dir, ["next"]).out, { action: "dispatch", owner: "claude-code", requires: "change", failed: ["c2"], runsLeft: 2 });
  assert.equal(dispatch(dir).err.code, "retry_needs_change");
  assert.equal(dispatch(dir, { change: { kind: "vibes", value: "x" } }).err.code, "retry_needs_change");
  assert.equal(dispatch(dir, { change: { kind: "strategy", value: "fix the selector first" } }).code, 0);
  assert.equal(status(dir).state, "WORKING");
  const r = report(dir, [failed("c2")]);
  assert.equal(r.out.state, "BLOCKED");
  assert.equal(status(dir).blocked.kind, "retry");
  assert.equal(dispatch(dir).err.code, "wrong_state", "no second retry");
  assert.equal(rec(dir, { type: "unblock", actor: "codex", note: "try again" }).err.code, "not_resumable");
  assertValid(dir);
});

test("a retry cannot repeat a change that was already tried", () => {
  const dir = tmp();
  goal(dir, 3);
  dispatch(dir);
  report(dir, [pass("c1"), failed("c2"), pass("c3")]);
  const change = { kind: "input", value: "use the new fixture" };
  dispatch(dir, { change });
  report(dir, [pass("c2"), failed("c3")]);
  assert.equal(status(dir).state, "RETRY");
  assert.equal(dispatch(dir, { change }).err.code, "retry_repeats_change");
});

test("at most three worker runs per goal", () => {
  const dir = tmp();
  goal(dir, 4);
  dispatch(dir);
  report(dir, [pass("c1"), failed("c2"), failed("c3"), failed("c4")]);
  dispatch(dir, { change: { kind: "input", value: "v2" } });
  report(dir, [pass("c2"), failed("c3"), failed("c4")]);
  assert.equal(status(dir).state, "BLOCKED", "c3 failed again after its one retry");
  // Staggered failures keep every gate within its single retry, so only the run cap can stop the loop.
  const d2 = tmp();
  goal(d2, 3);
  dispatch(d2);
  report(d2, [failed("c1"), pass("c2"), pass("c3")]);
  dispatch(d2, { change: { kind: "input", value: "v2" } });
  report(d2, [pass("c1"), failed("c3")]);
  dispatch(d2, { change: { kind: "input", value: "v3" } });
  const third = report(d2, [pass("c3")]);
  assert.equal(third.out.state, "DONE");
  assert.equal(status(d2).runs, 3);
  const d3 = tmp();
  goal(d3, 3);
  dispatch(d3);
  report(d3, [failed("c1"), pass("c2"), pass("c3")]);
  dispatch(d3, { change: { kind: "input", value: "v2" } });
  report(d3, [pass("c1"), failed("c2")]);
  dispatch(d3, { change: { kind: "input", value: "v3" } });
  report(d3, [pass("c2"), failed("c3")]);
  assert.equal(status(d3).state, "RETRY");
  const over = dispatch(d3, { change: { kind: "input", value: "v4" } });
  assert.equal(over.code, 0);
  assert.equal(over.out.state, "BLOCKED");
  assert.equal(status(d3).runs, 3, "the fourth run never started");
  assert.equal(status(d3).blocked.kind, "budget");
  assert.equal(rec(d3, { type: "unblock", actor: "project-owner", note: "more please" }).err.code, "not_resumable");
  assertValid(d3);
});

test("a failed gate can reroute to a different owner; the task stays the same", () => {
  const dir = tmp();
  goal(dir);
  dispatch(dir);
  const r = report(dir, [failed("c1")], { reroute_to: "claude-code" });
  assert.equal(r.err.code, "duplicate_owner");
  assert.equal(report(dir, [failed("c1")], { reroute_to: "reviewer" }).out.state, "REROUTE");
  const s = status(dir);
  assert.equal(s.owner, "reviewer");
  assert.equal(s.task, TASK);
  assert.equal(s.retries.c1 || 0, 0, "a reroute does not spend the retry");
  assert.equal(dispatch(dir, { owner: "claude-code" }).err.code, "duplicate_owner");
  assert.equal(dispatch(dir).out.state, "WORKING");
  assert.equal(rec(dir, { type: "report", actor: "claude-code", results: [pass("c1")] }).err.code, "duplicate_owner");
  const h = fs.readFileSync(path.join(dir, "docs/HANDOFF.md"), "utf8");
  assert.ok(h.includes(TASK) && h.includes("Owner: reviewer"));
});

test("a real blocker goes to BLOCKED and only codex or the owner can lift it with a changed input", () => {
  const dir = tmp();
  goal(dir);
  dispatch(dir);
  assert.equal(rec(dir, { type: "block", actor: "claude-code", kind: "mystery", reason: "x" }).err.code, "bad_event");
  assert.equal(rec(dir, { type: "block", actor: "claude-code", kind: "access", reason: "no push permission" }).out.state, "BLOCKED");
  assert.deepEqual(cli(dir, ["next"]).out, { action: "escalate", kind: "access", reason: "no push permission" });
  assert.equal(rec(dir, { type: "unblock", actor: "claude-code", note: "self-approved" }).err.code, "not_requirements_owner");
  assert.equal(rec(dir, { type: "unblock", actor: "project-owner" }).err.code, "bad_event");
  assert.equal(rec(dir, { type: "unblock", actor: "project-owner", note: "push access granted" }).out.state, "HANDOFF");
  assertValid(dir);
});

test("stop halts every active state, and a stopped goal accepts no work", () => {
  const prep = {
    HANDOFF: (d) => goal(d),
    WORKING: (d) => { goal(d); dispatch(d); },
    RETRY: (d) => { goal(d); dispatch(d); report(d, [failed("c1"), pass("c2")]); },
    REROUTE: (d) => { goal(d); dispatch(d); report(d, [failed("c1")], { reroute_to: "qa" }); },
    BLOCKED: (d) => { goal(d); rec(d, { type: "block", actor: "orchestrator", kind: "decision", reason: "needs owner" }); },
  };
  for (const [state, setup] of Object.entries(prep)) {
    const dir = tmp();
    setup(dir);
    assert.equal(status(dir).state, state);
    const r = cli(dir, ["stop", "--reason", "enough"]);
    assert.equal(r.out.state, "STOPPED", state);
    assert.equal(dispatch(dir).err.code, "wrong_state");
    assert.equal(report(dir, [pass("c1")]).err.code, "wrong_state");
    assert.deepEqual(cli(dir, ["next"]).out, { action: "none" });
    assertValid(dir);
  }
  const idle = tmp();
  assert.equal(cli(idle, ["stop"]).out.noop, true);
  assert.deepEqual(fs.readdirSync(idle), []);
});

test("a checkpoint persists without changing state or spending a run", () => {
  const dir = tmp();
  goal(dir);
  dispatch(dir);
  const r = rec(dir, { type: "checkpoint", actor: "claude-code", note: "c1 done, c2 half done", next: "finish c2 then run npm test" });
  assert.equal(r.out.state, "WORKING");
  const s = status(dir);
  assert.deepEqual(s.checkpoint, { note: "c1 done, c2 half done", next: "finish c2 then run npm test" });
  assert.equal(s.runs, 1);
  assert.equal(rec(dir, { type: "checkpoint", actor: "claude-code", note: "x" }).err.code, "bad_event");
});

test("the transition table is closed: only listed moves are possible", () => {
  assert.deepEqual(Object.keys(orch.TRANSITIONS).sort(), [...orch.STATES].sort());
  for (const from of orch.STATES) for (const to of orch.STATES) {
    const s = { ...orch.idleState(), state: from };
    const legal = orch.TRANSITIONS[from].includes(to);
    if (legal) orch.go(s, to, []);
    else assert.throws(() => orch.go(s, to, []), (e) => e.code === "illegal_transition", `${from} -> ${to}`);
  }
  assert.ok(!Object.values(orch.TRANSITIONS).flat().includes("IDLE"), "IDLE is the starting point, never re-entered");
  assert.deepEqual(orch.TRANSITIONS.IDLE, ["INTAKE"]);
  assert.deepEqual([...orch.TRANSITIONS.GATE].sort(), ["BLOCKED", "DONE", "RETRY", "REROUTE", "STOPPED"].sort());
});

test("end to end on a scratch project: goal, work, retry, evidence, DONE, PR action; schemas hold at every step", () => {
  const dir = tmp();
  goal(dir, 2);
  assertValid(dir);
  dispatch(dir);
  assertValid(dir);
  report(dir, [pass("c1"), failed("c2")]);
  assertValid(dir);
  dispatch(dir, { change: { kind: "strategy", value: "start from the failing test" } });
  report(dir, [pass("c2")]);
  assert.equal(status(dir).state, "DONE");
  assert.deepEqual(cli(dir, ["next"]).out, { action: "open_pr" });
  assertValid(dir);
  const ids = fs.readFileSync(path.join(dir, "workspace/events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).id);
  assert.deepEqual(ids, ids.map((_, i) => `e-${String(i + 1).padStart(4, "0")}`), "append-only, sequential ids");
  assert.equal(goal(dir, 1, { task: "Second goal" }).code, 0, "a finished goal frees the workspace");
  assert.equal(status(dir).goal, "g-0002");
});
