#!/usr/bin/env node
// Decides whether the GitHub user who sent an event may speak as the `actor` named inside it.
// The payload's `actor` is only a claim. Authority comes from the sender GitHub reports (github.actor and
// github.triggering_actor), checked against workspace/allowed-senders.json. Fails closed: a missing sender, a missing or
// malformed allowlist, an unknown sender or an actor the sender may not claim all reject the event.
// On success the event is printed with `sender` set to the verified login, replacing any `sender` the payload carried.
//
// Usage: node workspace/authorize.js --allow <file> --sender <login> [--triggering <login>]   (event JSON on stdin)
// Exit:  0 authorized   2 event is not a JSON object with an actor   6 sender or actor not authorized
const fs = require("fs");

function deny(code, message) { return { ok: false, code, message }; }

function authorize(allowlist, senders, ev) {
  if (!ev || typeof ev !== "object" || Array.isArray(ev) || typeof ev.actor !== "string" || !ev.actor.trim())
    return deny("bad_event", "event must be a JSON object with an actor");
  const map = allowlist && allowlist.version === 1 && allowlist.senders && typeof allowlist.senders === "object" ? allowlist.senders : null;
  if (!map) return deny("allowlist_invalid", "workspace/allowed-senders.json is missing or malformed");
  const known = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
  const who = senders.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
  if (!who.length) return deny("no_sender", "GitHub did not report who sent this event");
  for (const s of who) {
    const entry = known[s.toLowerCase()];
    if (!entry || !Array.isArray(entry.actors)) return deny("sender_not_allowed", `${s} is not on the sender allowlist`);
    if (!entry.actors.includes(ev.actor)) return deny("actor_not_allowed", `${s} may not act as ${ev.actor}`);
  }
  return { ok: true, event: { ...ev, sender: who[0] } };
}

function main(argv) {
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const fail = (r, exit) => { process.stderr.write(JSON.stringify({ ok: false, code: r.code, message: r.message }) + "\n"); process.exit(exit); };
  let ev;
  try { ev = JSON.parse(fs.readFileSync(0, "utf8")); } catch { return fail(deny("bad_event", "event is not valid JSON"), 2); }
  let allowlist = null;
  try { allowlist = JSON.parse(fs.readFileSync(opt("--allow"), "utf8")); } catch { /* handled as allowlist_invalid */ }
  const sender = opt("--sender") || "";
  const r = authorize(allowlist, [sender, opt("--triggering") || sender], ev);
  if (!r.ok) return fail(r, r.code === "bad_event" ? 2 : 6);
  process.stdout.write(JSON.stringify(r.event));
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { authorize };
