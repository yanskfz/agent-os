#!/usr/bin/env node
// Pure budget and model-routing policy. It never calls a provider.
// A future worker adapter must call authorizeRun before invoking any model.
const fs = require("fs");
const path = require("path");
const DEFAULT_POLICY = path.join(__dirname, "model-policy.json");
function loadPolicy(file = DEFAULT_POLICY) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function text(v) { return typeof v === "string" && v.trim() !== ""; }
function code(name, message) { const e = new Error(message); e.code = name; return e; }
function route(policy, kind, complexity = "normal") {
  if (!text(kind)) throw code("missing_task_kind", "task kind is required");
  const tierName = policy.routes[kind];
  if (!tierName) throw code("unmapped_task_kind", "no model route for task kind: " + kind);
  const tier = policy.tiers[tierName];
  if (!tier) throw code("missing_model_tier", "route points to missing model tier: " + tierName);
  if (complexity === "high" && tierName === "light") return { tier: "high", model: policy.tiers.high.model, reason: "high complexity escalates a light route" };
  return { tier: tierName, model: tier.model, reason: "policy route" };
}
function estimateCost(policy, model, inputTokens, outputTokens) {
  if (!Number.isInteger(inputTokens) || inputTokens < 0) throw code("bad_token_count", "inputTokens must be a non-negative integer");
  if (!Number.isInteger(outputTokens) || outputTokens < 0) throw code("bad_token_count", "outputTokens must be a non-negative integer");
  const rate = policy.rateCard[model];
  if (!rate) throw code("missing_rate_card", "no rate card for model: " + model);
  return (inputTokens * rate.inputUsdPerMillion + outputTokens * rate.outputUsdPerMillion) / 1000000;
}
function authorizeRun(input, policy = loadPolicy()) {
  if (typeof policy.enabled !== "boolean") throw code("bad_policy", "policy.enabled must be boolean");
  const selected = route(policy, input.kind, input.complexity || "normal");
  const tier = policy.tiers[selected.tier];
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  if (inputTokens > tier.maxInputTokens || outputTokens > tier.maxOutputTokens) throw code("token_cap", selected.tier + " token cap exceeded");
  const estimateUsd = estimateCost(policy, selected.model, inputTokens, outputTokens);
  const spentGoalUsd = input.spentGoalUsd || 0;
  const spentSessionUsd = input.spentSessionUsd || 0;
  const spentMonthUsd = input.spentMonthUsd || 0;
  if (estimateUsd > policy.caps.perRunUsd) throw code("run_cap", "estimated run cost exceeds per-run cap");
  if (spentGoalUsd + estimateUsd > policy.caps.perGoalUsd) throw code("goal_cap", "estimated run would exceed per-goal cap");
  if (spentSessionUsd + estimateUsd > policy.caps.perSessionUsd) throw code("session_cap", "estimated run would exceed per-session cap");
  if (spentMonthUsd + estimateUsd > policy.caps.perMonthUsd) throw code("month_cap", "estimated run would exceed per-month cap");
  const manual = selected.tier === "high" || estimateUsd >= policy.autoApproveBelowUsd;
  if (manual && input.approved !== true) throw code("approval_required", "model " + selected.model + " estimated at $" + estimateUsd.toFixed(4) + " requires approval");
  return { ok: true, enabled: policy.enabled, kind: input.kind, tier: selected.tier, model: selected.model, estimateUsd: Number(estimateUsd.toFixed(6)), caps: policy.caps, approval: manual ? "approved" : "auto" };
}
if (require.main === module) {
  try { const input = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(JSON.stringify(authorizeRun(input)) + "\n"); }
  catch (e) { process.stderr.write(JSON.stringify({ ok: false, code: e.code || "error", message: e.message }) + "\n"); process.exit(2); }
}
module.exports = { loadPolicy, route, estimateCost, authorizeRun };
