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
const BASH_ALLOWED = ["npm test", "npm run *", "node *", "git *", "ls *", "cat *"];
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
function claude(name, cwd, prompt, { pluginDir = PLUGIN, env = {}, maxTurns = 30 } = {}) {
  const args = ["-p", prompt + "\n\nRun any subagent in the foreground (run_in_background: false) and wait for it to finish.", "--model", MODEL, "--max-turns", String(maxTurns),
    "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
    "--allowedTools", ...ALLOWED];
  if (pluginDir) args.push("--plugin-dir", pluginDir);
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
  return { code: r.code, init, toolUses, hooks, result, agentResults, raw: r.out };
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
    const diff = sh("git", ["diff", "--stat"], { cwd: dir }).out.trim();
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
