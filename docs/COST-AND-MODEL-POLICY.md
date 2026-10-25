# Cost caps and model mapping

## Status

This policy is implemented as a dependency-free preflight for a future worker adapter.
It is disabled by default and makes no model calls. Enabling a provider requires a reviewed
change to the rate card and an explicit approval of the provider credentials.

## Routing

The worker receives a task kind before invocation. The smallest suitable logical tier is selected:

| Task kind | Tier | Intended use |
|---|---|---|
| routing, extraction, formatting, routine documentation, deployment verification | light | bounded, low-judgment work |
| planning, implementation, review, QA, design | standard | normal repository or product work |
| ambiguity, architecture, debugging, security, conflicting evidence | high | only when the quality gate justifies escalation |

configured-light, configured-standard, and configured-high are aliases, not provider
model names. A provider adapter maps them to actual model IDs. This avoids silently assuming
that a vendor's model names or prices remain current.

A high-complexity task escalates a light route to high. The policy rejects unmapped task
kinds rather than guessing a model.

## Default caps

These are conservative MVP defaults and are measured in USD:

- per run: $2
- per goal: $5
- per session: $10
- per month: $25
- automatic approval threshold: below $0.25

A run must provide estimated input/output token counts. It is rejected if it exceeds a
token cap, any dollar cap, or the per-run estimate. High-tier work always needs explicit
approval. Other work needs approval when the estimate reaches the automatic threshold.

The current rate card is deliberately marked as example data. Before enabling a live
provider, replace it with the provider's current published rates and review the cap values.
The preflight uses only the configured rate card; it does not fetch prices from the network.

## Safety rules

- No API key is read by this policy or committed to the repository.
- The worker adapter must call authorizeRun before creating a model request.
- Approval must be explicit in the event or executor input; the policy never infers approval
  from a user's ordinary task text.
- A cap failure is a stop/block condition, not an automatic retry.
- The orchestrator's existing structural limits remain: at most three worker runs per goal
  and one focused retry per failed gate.
- Budget accounting must be persisted with the worker report: model alias, token counts, estimate, actual cost if available, and cap decision.
- A person merges PRs; budget approval never grants merge or deploy permission.

## Not in this slice

This slice does not add a provider SDK, API secret, Claude Code invocation, billing API,
or automatic spend telemetry. Those belong to the worker-adapter slice and require a
separate approval.
