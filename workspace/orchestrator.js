#!/usr/bin/env node
// agent-os workspace orchestrator: a deterministic state machine over GitHub-backed files.
// It never calls a model, the network, a subprocess or `gh`: it only reads an event, validates it against the
// current state, and writes state.json, events.jsonl and docs/HANDOFF.md. With no event it does nothing.
//
// Usage:  node workspace/orchestrator.js status | next | stop [--reason <text>]
//         node workspace/orchestrator.js record [--file event.json]     (event JSON on stdin otherwise)
// Option: --dir <project root>   (default: current directory)
// Exit:   0 accepted, 1 usage error, 2 event rejected (nothing was written)
const fs = require("fs");
const path = require("path");

const STATES = ["IDLE", "INTAKE", "TRIAGE", "HANDOFF", "WORKING", "EVIDENCE", "GATE", "DONE", "RETRY", "REROUTE", "BLOCKED", "STOPPED"];
const TRANSITIONS = {
  IDLE: ["INTAKE"],
  INTAKE: ["TRIAGE", "BLOCKED", "STOPPED"],
  TRIAGE: ["HANDOFF", "BLOCKED", "STOPPED"],
  HANDOFF: ["WORKING", "BLOCKED", "STOPPED"],
  WORKING: ["EVIDENCE", "BLOCKED", "STOPPED"],
  EVIDENCE: ["GATE", "BLOCKED", "STOPPED"],
  GATE: ["DONE", "RETRY", "REROUTE", "BLOCKED", "STOPPED"],
  RETRY: ["WORKING", "BLOCKED", "STOPPED"],
  REROUTE: ["WORKING", "BLOCKED", "STOPPED"],
  BLOCKED: ["HANDOFF", "STOPPED"],
  DONE: ["INTAKE"],
  STOPPED: ["INTAKE"],
};
const ACTIVE = ["INTAKE", "TRIAGE", "HANDOFF", "WORKING", "EVIDENCE", "GATE", "RETRY", "REROUTE", "BLOCKED"];
const OWNERS = ["codex", "claude-code", "product-design", "qa", "reviewer", "deployment-assistant"];
const COORDINATORS = ["orchestrator", "codex", "project-owner"];
const REQUIREMENT_AUTHORITY = ["codex", "project-owner"];
const LIMITS = { maxRuns: 3, maxRetriesPerGate: 1 };
const RESUMABLE = ["decision", "access", "security", "external"];
// Only evidence a reader can open counts; worker prose or a bare report file never turns a criterion into `pass`.
const EVIDENCE_REF = /^(commit|pr|ci|command|file|screenshot):\S/;
const HANDLED_AT = {
  goal: ["IDLE", "DONE", "STOPPED"],
  dispatch: ["HANDOFF", "RETRY", "REROUTE"],
  report: ["WORKING"],
  block: ["HANDOFF", "WORKING", "RETRY", "REROUTE"],
  unblock: ["BLOCKED"],
  checkpoint: ["HANDOFF", "WORKING", "RETRY", "REROUTE", "BLOCKED"],
  pr_opened: ["DONE"],
  stop: STATES,
};

function reject(code, message) { const e = new Error(message); e.code = code; throw e; }
const text = (v) => typeof v === "string" && v.trim() !== "";

function idleState() {
  return { version: 1, state: "IDLE", goal: null, surface: "terminal", task: "", owner: null, criteria: [], runs: 0,
    limits: { ...LIMITS }, retries: {}, changes: [], blocked: null, checkpoint: null, pr: null, updated: null };
}

// Every state change goes through here, so an illegal move can never be written.
function go(s, to, trail) {
  if (!(TRANSITIONS[s.state] || []).includes(to)) reject("illegal_transition", `${s.state} -> ${to}`);
  trail.push(`${s.state}>${to}`);
  s.state = to;
}

function block(s, trail, kind, reason) {
  s.blocked = { kind, reason };
  go(s, "BLOCKED", trail);
}

function validOwner(v) { return OWNERS.includes(v); }

// Pure: (state, event, context) -> { state, entry } or { noop }. Throws a coded error on any rejection.
function step(prev, ev, ctx) {
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) reject("bad_event", "event must be a JSON object");
  if (ev.type === "merge") reject("forbidden", "the orchestrator never merges; a person merges the PR");
  if (!HANDLED_AT[ev.type]) reject("unknown_event", `unknown event type: ${ev.type}`);
  if (!text(ev.actor)) reject("bad_event", "event needs an actor");
  const s = JSON.parse(JSON.stringify(prev || idleState()));
  if (!HANDLED_AT[ev.type].includes(s.state)) reject("wrong_state", `${ev.type} is not accepted in ${s.state}`);
  const from = s.state;
  const trail = [];
  let evidence = [];

  if (ev.type === "stop") {
    if (!ACTIVE.includes(s.state)) return { noop: true, state: s };
    s.blocked = null;
    go(s, "STOPPED", trail);
  } else if (ev.type === "goal") {
    if (!REQUIREMENT_AUTHORITY.includes(ev.actor)) reject("not_requirements_owner", "only codex or the project owner may set a goal");
    if ((ev.surface || "terminal") !== "terminal") reject("adapter_not_implemented", `surface ${ev.surface} is an adapter contract only in the MVP`);
    const criteria = Array.isArray(ev.criteria) ? ev.criteria : [];
    if (!text(ev.task) || !validOwner(ev.owner) || !criteria.length || !criteria.every(text))
      reject("missing_requirement", "a goal needs task, owner and criteria: record an Open question in BRIEF.md and hand off to Codex");
    Object.assign(s, idleState(), { goal: `g-${String(ctx.goalSeq).padStart(4, "0")}`, task: ev.task, owner: ev.owner,
      criteria: criteria.map((t, i) => ({ id: `c${i + 1}`, text: t, status: "not checked", evidence: [] })) });
    go(s, "INTAKE", trail); go(s, "TRIAGE", trail); go(s, "HANDOFF", trail);
  } else if (ev.type === "dispatch") {
    if (!COORDINATORS.includes(ev.actor)) reject("not_coordinator", "only the orchestrator, codex or the project owner dispatches work");
    if (ev.owner !== undefined && ev.owner !== s.owner) reject("duplicate_owner", `${s.owner} is the active owner; ${ev.owner} cannot also take this goal`);
    if (s.runs >= s.limits.maxRuns) {
      block(s, trail, "budget", `${s.runs} worker runs used, the limit is ${s.limits.maxRuns}`);
    } else {
      if (s.state === "RETRY") {
        const c = ev.change || {};
        if (!["input", "owner", "strategy"].includes(c.kind) || !text(c.value)) reject("retry_needs_change", "a retry needs change.kind (input|owner|strategy) and change.value");
        const fp = `${c.kind}:${c.value}`;
        if (s.changes.includes(fp)) reject("retry_repeats_change", "this change was already tried");
        if (c.kind === "owner") {
          if (!validOwner(c.value) || c.value === s.owner) reject("duplicate_owner", "an owner change must name a different valid owner");
          s.owner = c.value;
        }
        s.changes.push(fp);
      }
      go(s, "WORKING", trail);
      s.runs += 1;
    }
  } else if (ev.type === "report") {
    if (ev.actor !== s.owner) reject("duplicate_owner", `${ev.actor} is not the active owner (${s.owner})`);
    for (const r of Array.isArray(ev.results) ? ev.results : []) {
      const c = s.criteria.find((x) => x.id === r.id);
      if (!c) reject("unknown_criterion", `no criterion ${r.id}`);
      const refs = (Array.isArray(r.evidence) ? r.evidence : []).filter((e) => typeof e === "string" && EVIDENCE_REF.test(e));
      const claimed = ["pass", "fail"].includes(r.status) ? r.status : "not checked";
      c.status = refs.length ? claimed : "not checked";
      c.evidence = [...new Set([...c.evidence, ...refs])];
      evidence.push(...refs);
    }
    go(s, "EVIDENCE", trail); go(s, "GATE", trail);
    const open = s.criteria.filter((c) => !(c.status === "pass" && c.evidence.length));
    if (!open.length) {
      go(s, "DONE", trail);
    } else if (ev.reroute_to !== undefined) {
      if (!validOwner(ev.reroute_to) || ev.reroute_to === s.owner) reject("duplicate_owner", "reroute_to must name a different valid owner");
      s.owner = ev.reroute_to;
      go(s, "REROUTE", trail);
    } else {
      const spent = open.filter((c) => (s.retries[c.id] || 0) >= s.limits.maxRetriesPerGate);
      if (spent.length) {
        block(s, trail, "retry", `gate ${spent.map((c) => c.id).join(", ")} failed again after its one retry`);
      } else {
        for (const c of open) s.retries[c.id] = (s.retries[c.id] || 0) + 1;
        go(s, "RETRY", trail);
      }
    }
  } else if (ev.type === "block") {
    if (!RESUMABLE.includes(ev.kind) || !text(ev.reason)) reject("bad_event", `block needs kind (${RESUMABLE.join("|")}) and reason`);
    block(s, trail, ev.kind, ev.reason);
  } else if (ev.type === "unblock") {
    if (!REQUIREMENT_AUTHORITY.includes(ev.actor)) reject("not_requirements_owner", "only codex or the project owner may unblock");
    if (!RESUMABLE.includes(s.blocked && s.blocked.kind)) reject("not_resumable", `a ${s.blocked && s.blocked.kind} block cannot be lifted; stop and set a new goal`);
    if (!text(ev.note)) reject("bad_event", "unblock needs a note (the changed input)");
    s.blocked = null;
    go(s, "HANDOFF", trail);
  } else if (ev.type === "checkpoint") {
    if (!text(ev.note) || !text(ev.next)) reject("bad_event", "checkpoint needs note and next");
    s.checkpoint = { note: ev.note, next: ev.next };
  } else if (ev.type === "pr_opened") {
    if (s.pr) reject("wrong_state", "a PR is already recorded");
    if (!/^pr:\S/.test(ev.pr || "")) reject("bad_event", "pr_opened needs pr: <url or number>");
    s.pr = ev.pr;
    evidence = [ev.pr];
  }

  s.updated = ctx.now;
  const entry = { id: `e-${String(ctx.eventSeq).padStart(4, "0")}`, type: ev.type, actor: ev.actor, task: s.goal || "none",
    ts: ctx.now, evidence, from, to: s.state, transitions: trail, note: ev.note || ev.reason || null };
  // Set by workspace/authorize.js from the GitHub sender; only trust it in events written through the trigger.
  if (text(ev.sender)) entry.sender = ev.sender;
  return { state: s, entry };
}

// What the caller should do next. Pure read: it never changes a file.
function next(s) {
  switch (s.state) {
    case "HANDOFF": return { action: "dispatch", owner: s.owner, handoff: "docs/HANDOFF.md", runsLeft: s.limits.maxRuns - s.runs };
    case "RETRY": return { action: "dispatch", owner: s.owner, requires: "change", failed: s.criteria.filter((c) => c.status !== "pass").map((c) => c.id), runsLeft: s.limits.maxRuns - s.runs };
    case "REROUTE": return { action: "dispatch", owner: s.owner, handoff: "docs/HANDOFF.md", runsLeft: s.limits.maxRuns - s.runs };
    case "WORKING": return { action: "await_report", owner: s.owner };
    case "BLOCKED": return { action: "escalate", kind: s.blocked.kind, reason: s.blocked.reason };
    case "DONE": return s.pr ? { action: "none" } : { action: "open_pr" };
    default: return { action: "none" };
  }
}

function renderHandoff(s) {
  const tpl = fs.readFileSync(path.join(__dirname, "handoff.md"), "utf8");
  const vars = { status: s.state, goal: s.goal, owner: s.owner, surface: s.surface, runs: s.runs, maxRuns: s.limits.maxRuns, task: s.task,
    criteria: s.criteria.map((c) => `- [${c.status}] ${c.id}: ${c.text}${c.evidence.length ? ` (evidence: ${c.evidence.join(", ")})` : ""}`).join("\n"),
    next: JSON.stringify(next(s)) };
  return tpl.replace(/{{(\w+)}}/g, (_, k) => String(vars[k]));
}

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function paths(dir) {
  return { state: path.join(dir, "workspace/state.json"), events: path.join(dir, "workspace/events.jsonl"), handoff: path.join(dir, "docs/HANDOFF.md") };
}

function load(dir) {
  const p = paths(dir);
  const state = fs.existsSync(p.state) ? JSON.parse(fs.readFileSync(p.state, "utf8")) : idleState();
  const lines = fs.existsSync(p.events) ? fs.readFileSync(p.events, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { state, lines };
}

function record(dir, ev) {
  const p = paths(dir);
  const { state, lines } = load(dir);
  const ctx = { now: new Date().toISOString(), eventSeq: lines.length + 1, goalSeq: lines.filter((l) => l.type === "goal").length + 1 };
  const out = step(state, ev, ctx);
  if (out.noop) return { ok: true, state: state.state, noop: true };
  fs.mkdirSync(path.dirname(p.events), { recursive: true });
  fs.appendFileSync(p.events, JSON.stringify(out.entry) + "\n");
  writeAtomic(p.state, JSON.stringify(out.state, null, 2) + "\n");
  if (out.state.goal) writeAtomic(p.handoff, renderHandoff(out.state));
  return { ok: true, event: out.entry.id, state: out.state.state, next: next(out.state) };
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  const dir = path.resolve(opt("--dir") || process.cwd());
  const say = (o) => process.stdout.write(JSON.stringify(o) + "\n");
  try {
    if (cmd === "status") return say(load(dir).state);
    if (cmd === "next") return say(next(load(dir).state));
    if (cmd === "stop") return say(record(dir, { type: "stop", actor: opt("--actor") || "project-owner", reason: opt("--reason") || "stopped by user" }));
    if (cmd === "record") {
      const file = opt("--file");
      let ev;
      try { ev = JSON.parse(fs.readFileSync(file || 0, "utf8")); } catch { reject("bad_event", "event is not valid JSON"); }
      return say(record(dir, ev));
    }
    process.stderr.write("usage: orchestrator.js status | next | stop | record [--file event.json] [--dir path]\n");
    process.exit(1);
  } catch (e) {
    process.stderr.write(JSON.stringify({ ok: false, code: e.code || "error", message: e.message }) + "\n");
    process.exit(e.code ? 2 : 1);
  }
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { STATES, TRANSITIONS, LIMITS, OWNERS, idleState, step, next, go, record, load, paths };
