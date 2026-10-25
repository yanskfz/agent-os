#!/usr/bin/env node
// Validates what the orchestrator wrote: state.json and every events.jsonl line against their schemas, sequential event
// ids, and that docs/HANDOFF.md still carries the original task verbatim. No dependencies, no network.
//
// Usage: node workspace/validate.js [--dir <project root>]      Exit: 0 valid, 1 invalid (errors as JSON on stderr)
const fs = require("fs");
const path = require("path");

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

function validateDir(dir) {
  const read = (f) => path.join(dir, f);
  const schema = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), "utf8"));
  const errs = [];
  if (!fs.existsSync(read("workspace/state.json"))) return ["workspace/state.json is missing"];
  const state = JSON.parse(fs.readFileSync(read("workspace/state.json"), "utf8"));
  errs.push(...check(schema("state.schema.json"), state, "state"));
  const lines = fs.existsSync(read("workspace/events.jsonl")) ? fs.readFileSync(read("workspace/events.jsonl"), "utf8").split("\n").filter(Boolean) : [];
  const eventSchema = schema("events.schema.json");
  lines.forEach((l, i) => {
    let e;
    try { e = JSON.parse(l); } catch { errs.push(`events.jsonl line ${i + 1}: not JSON`); return; }
    errs.push(...check(eventSchema, e, `events[${i}]`));
    if (e.id !== `e-${String(i + 1).padStart(4, "0")}`) errs.push(`events[${i}]: id ${e.id} is not sequential`);
  });
  if (state.state !== "IDLE" && !lines.length) errs.push("state is not IDLE but events.jsonl has no events");
  if (state.goal) {
    const handoff = fs.existsSync(read("docs/HANDOFF.md")) ? fs.readFileSync(read("docs/HANDOFF.md"), "utf8") : "";
    if (!handoff.includes(state.task)) errs.push("docs/HANDOFF.md does not contain the original task verbatim");
    if (!handoff.includes(`Status: ${state.state}`)) errs.push(`docs/HANDOFF.md status does not match state ${state.state}`);
  }
  return errs;
}

if (require.main === module) {
  const i = process.argv.indexOf("--dir");
  const dir = path.resolve(i >= 0 ? process.argv[i + 1] : process.cwd());
  let errs;
  try { errs = validateDir(dir); } catch (e) { errs = [String(e.message)]; }
  if (errs.length) { process.stderr.write(JSON.stringify({ ok: false, errors: errs }) + "\n"); process.exit(1); }
  process.stdout.write(JSON.stringify({ ok: true }) + "\n");
}
module.exports = { check, validateDir };
