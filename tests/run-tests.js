#!/usr/bin/env node
// Runs the agent-os verification tests A-F against isolated copies of fixtures/.
// Every check is based on what actually happened (files, exit codes, the session's event stream),
// never on what the model says it did.
//
// Usage:  node tests/run-tests.js [A B C ...]     (default: all)
// Env:    MODEL=claude-haiku-5-5 (default)  KEEP=1 keeps temp dirs
// Output: tests/results/latest.json and tests/results/latest.md, plus raw logs in tests/results/logs/
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PLUGIN = path.join(ROOT, "plugins/agent-os");
const FIXTURE = path.join(ROOT, "fixtures/sample-site");
const OUT = path.join(ROOT, "tests/results");
const LOGS = path.join(OUT, "logs");
const MODEL = process.env.MODEL || "claude-haiku-5-5";
const SKILLS = ["agent-routing", "project-planning", "web-development", "code-review", "testing-and-validation", "deployment-verification", "project-brief"];
const AGENTS = ["project-planner", "developer", "code-reviewer", "qa-agent", "deployment-assistant"];
// `echo *` lets QA print an exit code after `npm test; echo $?`; without it a compound command was blocked and
// the QA agent (correctly) reported PARTIAL because it could not observe the exit status.
const BASH_ALLOWED = ["npm test", "npm run *", "node *", "git *", "ls *", "cat *", "echo *"];
// The RTK hook rewrites e.g. `git diff` to `rtk git diff`, and permissions are checked on the rewritten
// command, so every allowed Bash pattern needs an `rtk`-prefixed twin (plus `rtk read`, RTK's cat).
const ALLOWED = ["Read", "Edit", "Write", "Grep", "Glob", "Agent", "Task",
  ...BASH_ALLOWED.flatMap((c) => [`Bash(${c})`, `Bash(rtk ${c})`]), "Bash(rtk read *)"];

fs.mkdirSync(LOGS, { recursive: true });

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", input: "", timeout: 15 * 60 * 1000, ...opts });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

// Copy the fixture to a temp git repo so the real fixture never changes.
function workspace(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `agentos-${name}-`));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  sh("git", ["init", "-q"], { cwd: dir });
  sh("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "add", "-A"], { cwd: dir });
  sh("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qm", "fixture"], { cwd: dir });
  return dir;
}

// Runs one headless Claude Code session and returns its parsed event stream.
// With `agent`, the whole session runs as that agent (`--agent`), so the prompt reaches it verbatim instead of
// being rewritten by a main session before delegation.
// `model: null` leaves out --model, so an agent's own `model:` frontmatter (or the session default) decides.
function claude(name, cwd, prompt, { pluginDir = PLUGIN, env = {}, maxTurns = 30, agent = null, model = MODEL } = {}) {
  const suffix = agent ? "" : "\n\nRun any subagent in the foreground (run_in_background: false) and wait for it to finish.";
  const args = ["-p", prompt + suffix, ...(model ? ["--model", model] : []), "--max-turns", String(maxTurns),
    "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--allowedTools", ...ALLOWED];
  if (pluginDir) args.push("--plugin-dir", pluginDir);
  if (agent) args.push("--agent", agent);
  const r = sh("claude", args, { cwd, env: { ...process.env, ...env } });
  fs.writeFileSync(path.join(LOGS, `${name}.jsonl`), r.out);
  const events = r.out.split("\n").filter((l) => l.startsWith("{")).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const init = events.find((e) => e.type === "system" && e.subtype === "init") || {};
  const toolUses = [];
  for (const e of events) {
    if (e.type !== "assistant") continue;
    for (const c of (e.message && e.message.content) || []) if (c.type === "tool_use") toolUses.push(c);
  }
  const hooks = events.filter((e) => e.subtype === "hook_response").map((e) => e.output || "");
  // A subagent may finish after the first reply (background agents), producing several result events.
  const result = events.filter((e) => e.type === "result").map((e) => e.result || "").join("\n");
  // Only the text a subagent returned (the tool_result of an Agent/Task call), never other tool output,
  // so a check cannot pass just because the main session printed a diff or a file.
  const agentIds = new Set(toolUses.filter((t) => t.name === "Agent" || t.name === "Task").map((t) => t.id));
  const agentResults = [];
  for (const e of events) {
    if (e.type !== "user") continue;
    for (const c of (e.message && e.message.content) || []) {
      if (c.type !== "tool_result" || !agentIds.has(c.tool_use_id)) continue;
      const text = typeof c.content === "string" ? c.content : (c.content || []).map((x) => x.text || "").join("\n");
      if (!/^Async agent launched/.test(text)) agentResults.push(text);
    }
  }
  // Background agents report back in a later turn; their text then only appears in the final result.
  // `modelUsage` (per model: tokens and cost) is the only place a subagent's model shows up; its messages are not streamed.
  const last = events.filter((e) => e.type === "result").pop() || {};
  return { code: r.code, init, toolUses, hooks, result, agentResults, raw: r.out,
    modelUsage: last.modelUsage || {}, cost: last.total_cost_usd, turns: last.num_turns };
}

function invoked(run, agent) {
  return run.toolUses.some((t) => (t.name === "Agent" || t.name === "Task") && String((t.input || {}).subagent_type || "").endsWith(agent));
}

const results = [];
function record(id, title, levels, evidence, status) {
  results.push({ id, title, status, levels, evidence });
  console.log(`${status.padEnd(7)} Test ${id}: ${title}`);
  for (const [k, v] of Object.entries(levels)) console.log(`         ${k}: ${v}`);
}

const tests = {
  A() {
    const v = sh("claude", ["plugin", "validate", ROOT]);
    const vp = sh("claude", ["plugin", "validate", PLUGIN]);
    const dir = workspace("A");
    const run = claude("A-discovery", dir, "Reply with exactly: OK", { maxTurns: 1 });
    const skills = (run.init.skills || []).filter((s) => s.startsWith("agent-os:"));
    const agents = (run.init.agents || []).filter((s) => s.startsWith("agent-os:"));
    const missingS = SKILLS.filter((s) => !skills.includes("agent-os:" + s));
    const missingA = AGENTS.filter((a) => !agents.includes("agent-os:" + a));
    const brief = run.hooks.some((h) => h.includes("Project brief") && h.includes("## Next step"));
    const ok = v.code === 0 && vp.code === 0 && !missingS.length && !missingA.length && brief;
    record("A", "Skill and agent discovery", {
      "Configuration validated": v.code === 0 && vp.code === 0 ? "yes (claude plugin validate)" : "NO",
      "Skills discovered": missingS.length ? "missing " + missingS.join(", ") : `yes (${skills.length})`,
      "Agents discovered": missingA.length ? "missing " + missingA.join(", ") : `yes (${agents.length})`,
      "Brief hook ran": brief ? "yes" : "NO"
    }, { skills, agents, briefHook: run.hooks.find((h) => h.includes("Project brief")) || null }, ok ? "PASS" : "FAIL");
  },

  B() {
    const dir = workspace("B");
    const req = "Company profile website for a building contractor in Klaten: one screen carousel with a hero, 4 project photos, a video slot and a WhatsApp contact card. Plain HTML/CSS/JS on Vercel. The phone number and company name are not known yet.";
    const run = claude("B-planner", dir, `Use the agent-os:project-planner subagent to plan this requirement. Then reply with the planner's plan exactly as it returned it, nothing else.\n\nRequirement: ${req}`);
    const text = run.agentResults.join("\n") + "\n" + run.result;
    const need = ["Tasks", "Dependencies", "Acceptance criteria", "Definition of done"];
    const missing = need.filter((h) => !new RegExp(h, "i").test(text));
    const inv = invoked(run, "project-planner");
    const filesChanged = sh("git", ["status", "--porcelain"], { cwd: dir }).out.trim();
    const ok = inv && !missing.length;
    record("B", "Planner produces tasks, dependencies, acceptance criteria, definition of done", {
      "Agent invoked": inv ? "yes (Agent tool, subagent_type agent-os:project-planner)" : "NO",
      "Task completed": missing.length ? "missing " + missing.join(", ") : "yes (all 4 sections present)",
      "Planner stayed read-only": filesChanged ? "NO: " + filesChanged : "yes"
    }, { planExcerpt: text.slice(0, 1500) }, ok ? "PASS" : "FAIL");
  },

  C() {
    const dir = workspace("C");
    const run = claude("C-developer", dir, "Use the agent-os:developer subagent for this task: add a function excerpt(text, maxWords) to src/text.js that returns the first maxWords words of text joined by single spaces, and appends \"…\" only when words were cut off. Export it, add tests for it in test/text.test.js, and run npm test. Then summarize in 3 lines.");
    // Compare against the fixture commit, not HEAD: the developer skill says to commit, and an agent that commits
    // would otherwise look like "no changes".
    const base = sh("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: dir }).out.trim();
    const diff = sh("git", ["diff", "--stat", base], { cwd: dir }).out.trim();
    const test = sh("npm", ["test", "--silent"], { cwd: dir });
    const check = sh("node", ["-e", `const {excerpt}=require('./src/text');const a=excerpt('one two three four',2),b=excerpt('one two',5);if(a!=='one two…'||b!=='one two'){console.log(JSON.stringify([a,b]));process.exit(1)}console.log('behaviour ok')`], { cwd: dir });
    const inv = invoked(run, "developer");
    const touched = /src\/text\.js/.test(diff) && /test\/text\.test\.js/.test(diff);
    const ok = inv && touched && test.code === 0 && check.code === 0;
    record("C", "Developer makes a real, tested change", {
      "Agent invoked": inv ? "yes (agent-os:developer)" : "NO",
      "Files changed": touched ? "yes: " + diff.split("\n").pop() : "NO: " + (diff || "no changes"),
      "Tests passed (re-run by harness)": test.code === 0 ? "yes" : "NO",
      "Behaviour checked by harness": check.code === 0 ? "yes" : "NO: " + check.out.trim()
    }, { diffStat: diff, npmTest: test.out.split("\n").filter((l) => /^# (pass|fail)/.test(l)) }, ok ? "PASS" : "FAIL");
  },

  D() {
    const dir = workspace("D");
    // Known defect: thousands grouped by 2 digits instead of 3 (1500000 -> "Rp 1.50.00.00").
    const file = path.join(dir, "src/text.js");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("(\\d{3})+(?!\\d)", "(\\d{2})+(?!\\d)"));
    sh("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qam", "Tweak price formatting"], { cwd: dir });
    const run = claude("D-reviewer", dir, "Use the agent-os:code-reviewer subagent to review the last commit (git diff HEAD~1). Then reply with its findings exactly as returned.");
    const text = run.agentResults.join("\n") + "\n" + run.result.split("\n").filter((l) => !/^[+-]\s/.test(l)).join("\n");
    // Detected = a severity-tagged finding that names the file/function and explains the grouping bug.
    const detected = /\[(critical|major|minor)\]/i.test(text) && /formatRupiah|text\.js/i.test(text) &&
      /(thousand|separator|group|1\.50|two digits|2 digits|every 2|pairs of)/i.test(text);
    const inv = invoked(run, "code-reviewer");
    const unchanged = sh("git", ["status", "--porcelain"], { cwd: dir }).out.trim() === "";
    // Correct the defect afterwards and confirm the suite is green again.
    sh("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "revert", "--no-edit", "HEAD"], { cwd: dir });
    const fixed = sh("npm", ["test", "--silent"], { cwd: dir });
    const ok = inv && detected && fixed.code === 0;
    record("D", "Code Reviewer finds a planted defect", {
      "Agent invoked": inv ? "yes (agent-os:code-reviewer)" : "NO",
      "Defect detected": detected ? "yes" : "NO",
      "Reviewer stayed read-only": unchanged ? "yes" : "NO",
      "Defect corrected, tests pass": fixed.code === 0 ? "yes (git revert, npm test)" : "NO"
    }, { findingsExcerpt: text.slice(0, 1500) }, ok ? "PASS" : "FAIL");
  },

  E() {
    const dir = workspace("E");
    const truth = sh("npm", ["test"], { cwd: dir });
    const run = claude("E-qa", dir, "Use the agent-os:qa-agent subagent to run this project's test suite and report. Then reply with its report exactly as returned.");
    const text = run.agentResults.join("\n") + "\n" + run.result;
    const verdict = (text.match(/\b(PASS|FAIL|PARTIAL)\b/g) || []).pop();
    const ranTests = run.raw.includes("npm test") || run.raw.includes("node --test");
    const inv = invoked(run, "qa-agent");
    const expected = truth.code === 0 ? "PASS" : "FAIL";
    const ok = inv && ranTests && verdict === expected;
    record("E", "QA Agent runs the suite and reports the real result", {
      "Agent invoked": inv ? "yes (agent-os:qa-agent)" : "NO",
      "Tests executed": ranTests ? "yes (npm test seen in session)" : "NO",
      "Verdict matches reality": verdict === expected ? `yes (${verdict})` : `NO (agent said ${verdict}, harness saw ${expected})`
    }, { harnessNpmTest: truth.out.split("\n").filter((l) => /^# (tests|pass|fail)/.test(l)), reportExcerpt: text.slice(0, 1000) }, ok ? "PASS" : "FAIL");
  },

  F() {
    // A second project with no application code, and a clean Claude config (nothing pre-installed).
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), "agentos-F-project-"));
    const cfg = fs.mkdtempSync(path.join(os.tmpdir(), "agentos-F-config-"));
    fs.writeFileSync(path.join(proj, "README.md"), "# Second project\nEmpty project that only enables the agent-os plugin.\n");
    sh("git", ["init", "-q"], { cwd: proj });
    const env = { CLAUDE_CONFIG_DIR: cfg };
    const source = process.env.MARKETPLACE_SOURCE || ROOT; // local path by default; set to yanskfz/agent-os after merge
    const add = sh("claude", ["plugin", "marketplace", "add", source, "--scope", "project"], { cwd: proj, env: { ...process.env, ...env } });
    const inst = sh("claude", ["plugin", "install", "agent-os@yansz-agent-os", "--scope", "project"], { cwd: proj, env: { ...process.env, ...env } });
    const settings = fs.existsSync(path.join(proj, ".claude/settings.json")) ? fs.readFileSync(path.join(proj, ".claude/settings.json"), "utf8") : "";
    const run = claude("F-reuse", proj, "Reply with exactly: OK", { pluginDir: null, env, maxTurns: 1 });
    const skills = (run.init.skills || []).filter((s) => s.startsWith("agent-os:"));
    const agents = (run.init.agents || []).filter((s) => s.startsWith("agent-os:"));
    const files = sh("git", ["ls-files", "--others", "--exclude-standard"], { cwd: proj }).out.trim().split("\n");
    const noAppCode = !files.some((f) => /^(src|test|index\.html|js|css)/.test(f));
    const ok = add.code === 0 && inst.code === 0 && skills.length === SKILLS.length && agents.length === AGENTS.length && noAppCode;
    record("F", "Reuse in a second project without copying code", {
      "Marketplace added": add.code === 0 ? `yes (source: ${source === ROOT ? "local checkout" : source})` : "NO: " + add.out.trim().slice(-200),
      "Plugin installed (project scope)": inst.code === 0 ? "yes" : "NO: " + inst.out.trim().slice(-200),
      "Skills discovered in project 2": `${skills.length}/${SKILLS.length}`,
      "Agents discovered in project 2": `${agents.length}/${AGENTS.length}`,
      "No app code copied": noAppCode ? "yes (files: " + files.join(", ") + ")" : "NO"
    }, { settingsJson: settings, apiKeySource: run.init.apiKeySource || null }, ok ? "PASS" : "FAIL");
  }
};

tests.G = function G() {
  // Runs the exact environment setup script from docs/ in a clean Claude config, then checks that a
  // brand-new session in an unrelated, empty repo has the plugin. This is how cloud sessions get it.
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), "agentos-G-config-"));
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "agentos-G-project-"));
  sh("git", ["init", "-q"], { cwd: proj });
  const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
  if (process.env.MARKETPLACE_SOURCE) env.AGENT_OS_SOURCE = process.env.MARKETPLACE_SOURCE;
  const setup = sh("sh", [path.join(ROOT, "docs/cloud-setup-script.sh")], { cwd: proj, env });
  const run = claude("G-setup-script", proj, "Reply with exactly: OK", { pluginDir: null, env: { CLAUDE_CONFIG_DIR: cfg }, maxTurns: 1 });
  const skills = (run.init.skills || []).filter((s) => s.startsWith("agent-os:"));
  const agents = (run.init.agents || []).filter((s) => s.startsWith("agent-os:"));
  const plugin = (run.init.plugins || []).find((p) => p.name === "agent-os");
  const ok = setup.code === 0 && skills.length === SKILLS.length && agents.length === AGENTS.length;
  record("G", "Cloud setup script installs the plugin for any repo", {
    "Setup script ran": setup.code === 0 ? "yes" : "NO: " + setup.out.trim().slice(-300),
    "Source": env.AGENT_OS_SOURCE || "yanskfz/agent-os (GitHub)",
    "Plugin loaded in new session": plugin ? `yes (${plugin.source} v${plugin.version})` : "NO",
    "Skills / agents discovered": `${skills.length}/${SKILLS.length} skills, ${agents.length}/${AGENTS.length} agents`
  }, { setupOutput: setup.out.trim().slice(-800) }, ok ? "PASS" : "FAIL");
};

tests.H = function H() {
  // Routing behaviour: a task outside the agent's role, or without checkable criteria, must come back as a
  // compact handoff (Owner, Unresolved) and must not change any file. The session runs AS the agent (`--agent`)
  // so the task arrives verbatim (a first version delegated through a main session, which rewrote the vague
  // task into detailed steps and made the test invalid). Judged from the returned text and the repo state.
  const cases = [
    { key: "qa-agent given an implementation task", agent: "qa-agent",
      task: "add a function excerpt(text, maxWords) to src/text.js that returns the first maxWords words" },
    { key: "developer given a vague task with no criteria", agent: "developer",
      task: "make the site better" }
  ];
  const levels = {};
  const evidence = {};
  let allOk = true;
  cases.forEach((c, i) => {
    const dir = workspace("H" + (i + 1));
    const base = sh("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: dir }).out.trim();
    const run = claude(`H${i + 1}-${c.agent}`, dir, c.task, { maxTurns: 10, agent: `agent-os:${c.agent}` });
    const text = run.result;
    const inv = run.code === 0 && text.trim().length > 0;
    // Clean = no uncommitted changes and no commit that changed files since the fixture.
    const clean = sh("git", ["status", "--porcelain"], { cwd: dir }).out.trim() === "" &&
      sh("git", ["diff", "--stat", base], { cwd: dir }).out.trim() === "";
    const handoff = /owner/i.test(text) && /unresolved/i.test(text);
    const ok = inv && clean && handoff;
    if (!ok) allOk = false;
    levels[`${c.key}: session ran as the agent`] = inv ? "yes (--agent)" : "NO";
    levels[`${c.key}: no file changed`] = clean ? "yes" : "NO";
    levels[`${c.key}: handoff returned (Owner, Unresolved)`] = handoff ? "yes" : "NO";
    evidence[`case${i + 1}`] = text.slice(0, 800);
  });
  record("H", "Out-of-scope tasks produce a handoff, not action", levels, evidence, allOk ? "PASS" : "FAIL");
};

tests.I = function I() {
  // Delegation routing: a MAIN session (no `--agent`) delegates to an agent. What is judged is what the subagent was
  // actually sent (the Agent tool call's prompt) and what changed in the repo, never only the agent's own words.
  // The invented-criteria check is a heuristic: after removing the user's task from the delegated prompt, what is left
  // must be short and must not contain list steps, criteria headings or file names the user never mentioned.
  const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();
  const extras = (prompt, task) => {
    const rest = String(prompt).split(task).join(" ");
    const hits = [];
    if (/^\s*([-*]|\d+[.)])\s/m.test(rest)) hits.push("list steps");
    if (/acceptance criteria|success criteria|definition of done|criteria:/i.test(rest)) hits.push("criteria heading");
    const files = (rest.match(/[\w./-]+\.(js|css|html|json|md)\b|\bsrc\/|\btest\//g) || []).filter((f) => !task.includes(f));
    if (files.length) hits.push(`file names (${files.slice(0, 3).join(", ")})`);
    if (rest.trim().length > 300) hits.push(`${rest.trim().length} chars of added text`);
    return hits;
  };
  const isHandoff = (s) => /owner/i.test(s) && /unresolved/i.test(s);
  const cases = [
    { key: "vague task", agent: "developer", task: "make the site better", expect: "handoff", ambiguous: true },
    { key: "out-of-scope task (QA asked to implement)", agent: "qa-agent",
      task: "add a function excerpt(text, maxWords) to src/text.js that returns the first maxWords words", expect: "handoff" },
    { key: "explicit task with explicit criteria", agent: "developer", expect: "work",
      keep: ["excerpt('a b c', 2)", "'a b'", "excerpt('a', 5)", "'a'", "npm test"],
      task: "In src/text.js add excerpt(text, maxWords) that returns the first maxWords words joined by one space. Criteria: excerpt('a b c', 2) returns 'a b'; excerpt('a', 5) returns 'a'; npm test passes." },
    { key: "duplicate ownership", agent: null, expect: "one-owner",
      task: "Have both the developer agent and the qa-agent add excerpt(text, maxWords) to src/text.js, each in their own way." }
  ];
  const levels = {};
  const evidence = {};
  let allOk = true;
  const mark = (k, ok) => { levels[k] = ok ? "yes" : "NO"; return ok; };
  cases.forEach((c, i) => {
    const dir = workspace("I" + (i + 1));
    const base = sh("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: dir }).out.trim();
    const ask = c.agent ? `Use the agent-os ${c.agent} agent for this task: ${c.task}` : c.task;
    const run = claude(`I${i + 1}-${c.key.split(" ")[0]}`, dir, ask, { maxTurns: 20 });
    const calls = run.toolUses.filter((t) => t.name === "Agent" || t.name === "Task");
    const prompts = calls.map((t) => String((t.input || {}).prompt || ""));
    const changed = [sh("git", ["diff", "--name-only", base], { cwd: dir }).out.trim(), sh("git", ["status", "--porcelain"], { cwd: dir }).out.trim()].filter(Boolean).join("\n");
    const k = (s) => `${c.key}: ${s}`;
    let ok = true;
    if (c.expect === "one-owner") {
      const working = run.agentResults.filter((r) => !isHandoff(r));
      ok = mark(k("delegated to at least one agent"), calls.length > 0) && ok;
      ok = mark(k("at most one agent did the work; the other handed off or was not used"), working.length <= 1) && ok;
      evidence[`case${i + 1}`] = { agentCalls: calls.map((t) => (t.input || {}).subagent_type), prompts: prompts.map((p) => p.slice(0, 400)), results: run.agentResults.map((r) => r.slice(0, 300)) };
    } else {
      const sent = calls.find((t) => String((t.input || {}).subagent_type || "").endsWith(c.agent));
      const prompt = sent ? String(sent.input.prompt || "") : "";
      ok = mark(k(`delegated to ${c.agent}`), !!sent) && ok;
      // A vague or out-of-scope task must arrive word for word. An explicit task may be reworded, but every criterion
      // the user gave must survive in the delegated prompt.
      const kept = c.keep ? c.keep.every((x) => norm(prompt).includes(norm(x))) : !!sent && norm(prompt).includes(norm(c.task));
      ok = mark(k(c.keep ? "every user-given criterion is in the delegated prompt" : "delegated prompt contains the user's task unchanged"), kept) && ok;
      const hits = sent ? extras(prompt, c.task) : ["not delegated"];
      if (c.expect === "handoff") ok = mark(k("no invented criteria or steps in the delegated prompt"), hits.length === 0) && ok;
      if (c.expect === "handoff") {
        const text = run.agentResults.join("\n");
        ok = mark(k("worker returned a handoff (Owner, Unresolved)"), isHandoff(text)) && ok;
        ok = mark(k("no repository file changed"), changed === "") && ok;
        // An ambiguous requirement must go back to a decider (Codex, the project owner, or the user asking) and not be settled
        // by Claude Code: the answer names Codex or the owner, or asks the user to choose (a question or "tell me").
        if (c.ambiguous) ok = mark(k("ambiguity routed to Codex or the project owner, not decided by Claude Code"), /codex|project owner|\?|tell me|let me know/i.test(run.result)) && ok;
      } else {
        const npm = sh("npm", ["test"], { cwd: dir });
        ok = mark(k("worker changed the code and npm test passes (run by the harness)"), changed !== "" && npm.code === 0) && ok;
      }
      evidence[`case${i + 1}`] = { delegatedPrompt: prompt.slice(0, 600), extras: hits, workerText: run.agentResults.join("\n").slice(0, 500), changedFiles: changed };
    }
    if (!ok) allOk = false;
  });
  record("I", "A main session delegates without rewriting the task", levels, evidence, allOk ? "PASS" : "FAIL");
};

tests.J = function J() {
  // Does an agent's `model:` frontmatter decide which model serves it? Judged from the init event and the result's
  // modelUsage (the models that actually produced tokens), never from what an agent says. Uses a throwaway plugin so no
  // repo agent file changes. The main session runs on MODEL; it must be a cheaper model than the probes use, otherwise a
  // subagent on the same model cannot be told apart in modelUsage.
  if (/sonnet|opus/i.test(MODEL)) return record("J", "Agent model field is honoured", { MODEL }, {}, "BLOCKED");
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), "agentos-probe-"));
  fs.mkdirSync(path.join(probe, ".claude-plugin"));
  fs.mkdirSync(path.join(probe, "agents"));
  fs.writeFileSync(path.join(probe, ".claude-plugin/plugin.json"), JSON.stringify({ name: "probe", version: "0.0.1", description: "Throwaway probe agents for the model field test." }));
  for (const [name, model] of [["sonnet", "sonnet"], ["opus", "opus"], ["inherit", null]]) {
    fs.writeFileSync(path.join(probe, "agents", `probe-${name}.md`),
      `---\nname: probe-${name}\ndescription: Probe agent${model ? ` that requests the ${model} model` : " with no model field"}. Replies with one word.\n${model ? `model: ${model}\n` : ""}tools: Read\n---\nReply with the single word ok and nothing else.\n`);
  }
  const keys = (run) => Object.keys(run.modelUsage);
  const only = (run, re) => keys(run).length > 0 && keys(run).every((k) => re.test(k));
  const has = (run, re) => keys(run).some((k) => re.test(k));
  const cases = [
    { key: "subagent model: sonnet", via: "subagent", agent: "sonnet", ok: (r) => has(r, /sonnet/i) && has(r, new RegExp(MODEL, "i")) },
    { key: "subagent model: opus", via: "subagent", agent: "opus", ok: (r) => has(r, /opus/i) && has(r, new RegExp(MODEL, "i")) },
    { key: "subagent without model: inherits the session model", via: "subagent", agent: "inherit", ok: (r) => only(r, new RegExp(MODEL, "i")) },
    { key: "--agent with model: opus and no --model flag", via: "direct", agent: "opus", model: null, ok: (r) => /opus/i.test(r.init.model || "") && only(r, /opus/i) },
    { key: "--model flag overrides the agent's model: opus", via: "direct", agent: "opus", model: "claude-sonnet-5-5", ok: (r) => /sonnet/i.test(r.init.model || "") && only(r, /sonnet/i) }
  ];
  const levels = {};
  const evidence = {};
  let allOk = true;
  cases.forEach((c, i) => {
    const dir = workspace("J" + (i + 1));
    const opts = { pluginDir: probe, maxTurns: 6 };
    if (c.via === "direct") Object.assign(opts, { agent: `probe:probe-${c.agent}`, model: c.model });
    const prompt = c.via === "direct" ? "go" : `Use the probe:probe-${c.agent} agent to do its task, run it in the foreground, then tell me what it said.`;
    const run = claude(`J${i + 1}-${c.via}-${c.agent}`, dir, prompt, opts);
    const ok = run.code === 0 && c.ok(run);
    if (!ok) allOk = false;
    levels[`${c.key}: served by`] = `${keys(run).join(" + ") || "nothing"} ${ok ? "(as expected)" : "(UNEXPECTED)"}`;
    evidence[`case${i + 1}`] = { sessionModel: run.init.model, modelUsage: run.modelUsage, cost: run.cost, turns: run.turns };
  });
  record("J", "Agent model field is honoured", levels, evidence, allOk ? "PASS" : "FAIL");
};

const pick = process.argv.slice(2).map((s) => s.toUpperCase());
for (const id of Object.keys(tests)) {
  if (pick.length && !pick.includes(id)) continue;
  try { tests[id](); } catch (e) { record(id, "crashed", { error: String(e).slice(0, 300) }, {}, "BLOCKED"); }
}

// Merge with earlier runs so running a subset (e.g. `node tests/run-tests.js D`) keeps the other results.
const stamp = new Date().toISOString();
const latestFile = path.join(OUT, "latest.json");
const previous = fs.existsSync(latestFile) ? JSON.parse(fs.readFileSync(latestFile, "utf8")).results || [] : [];
for (const r of results) { r.ranAt = stamp; r.model = MODEL; }
const merged = [...previous.filter((p) => !results.some((r) => r.id === p.id)), ...results].sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(latestFile, JSON.stringify({ updated: stamp, results: merged }, null, 2));
const md = [`# Test results`, ``, `Updated: ${stamp}`, ``, `| Test | Status | Evidence | Run |`, `|------|--------|----------|-----|`,
  ...merged.map((r) => `| ${r.id}. ${r.title} | **${r.status}** | ${Object.entries(r.levels).map(([k, v]) => `${k}: ${v}`).join("<br>")} | ${r.ranAt || ""} · \`${r.model || ""}\` |`),
  ``, `Raw session logs: \`tests/results/logs/\`. Details: \`tests/results/latest.json\`.`].join("\n");
fs.writeFileSync(path.join(OUT, "latest.md"), md + "\n");
process.exit(results.every((r) => r.status === "PASS") ? 0 : 1);
