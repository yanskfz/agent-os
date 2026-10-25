const test = require("node:test");
const assert = require("node:assert/strict");
const { route, estimateCost, authorizeRun } = require("../workspace/budget");

const policy = {
  enabled: true,
  autoApproveBelowUsd: 0.1,
  caps: { perRunUsd: 2, perGoalUsd: 5, perSessionUsd: 10, perMonthUsd: 25 },
  routes: { routing: "light", implementation: "standard", security: "high" },
  tiers: {
    light: { model: "l", maxInputTokens: 10000, maxOutputTokens: 5000 },
    standard: { model: "s", maxInputTokens: 10000, maxOutputTokens: 5000 },
    high: { model: "h", maxInputTokens: 10000, maxOutputTokens: 5000 }
  },
  rateCard: {
    l: { inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
    s: { inputUsdPerMillion: 10, outputUsdPerMillion: 20 },
    h: { inputUsdPerMillion: 100, outputUsdPerMillion: 200 }
  }
};

test("routes each task kind to the smallest declared tier", () => {
  assert.equal(route(policy, "routing").tier, "light");
  assert.equal(route(policy, "implementation").tier, "standard");
  assert.equal(route(policy, "security").tier, "high");
  assert.equal(route(policy, "routing", "high").tier, "high");
});

test("unknown work is rejected instead of guessed", () => {
  assert.throws(() => route(policy, "invented"), { code: "unmapped_task_kind" });
});

test("estimates from the configured rate card", () => {
  assert.equal(estimateCost(policy, "s", 100000, 50000), 2);
});

test("low-cost light work auto-approves below the threshold", () => {
  const r = authorizeRun({ kind: "routing", inputTokens: 1000, outputTokens: 1000 }, policy);
  assert.equal(r.approval, "auto");
  assert.equal(r.model, "l");
});

test("standard work requires approval at or above the threshold", () => {
  assert.throws(() => authorizeRun({ kind: "implementation", inputTokens: 10000, outputTokens: 5000 }, policy), { code: "approval_required" });
  const r = authorizeRun({ kind: "implementation", inputTokens: 10000, outputTokens: 5000, approved: true }, policy);
  assert.equal(r.approval, "approved");
  assert.equal(r.estimateUsd, 0.2);
});

test("high work always requires explicit approval", () => {
  assert.throws(() => authorizeRun({ kind: "security", inputTokens: 1, outputTokens: 1 }, policy), { code: "approval_required" });
});

test("caps fail closed before a model call", () => {
  assert.throws(() => authorizeRun({ kind: "implementation", inputTokens: 10000, outputTokens: 5000, approved: true, spentGoalUsd: 4.9 }, policy), { code: "goal_cap" });
  assert.throws(() => authorizeRun({ kind: "implementation", inputTokens: 10000, outputTokens: 5000, approved: true, spentSessionUsd: 9.9 }, policy), { code: "session_cap" });
  assert.throws(() => authorizeRun({ kind: "implementation", inputTokens: 10000, outputTokens: 5000, approved: true, spentMonthUsd: 24.9 }, policy), { code: "month_cap" });
  assert.throws(() => authorizeRun({ kind: "implementation", inputTokens: 10000, outputTokens: 5000, approved: true }, policy), { code: "approval_required" });
});
