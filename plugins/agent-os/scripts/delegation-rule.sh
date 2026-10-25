#!/bin/sh
# SessionStart hook: tell the main session how to delegate. The agent preambles cannot do this, because the main
# session decides what a subagent is told (a main session rewrote a vague task into steps before delegating).
cat <<'RULE'
agent-os delegation rule:
- When you delegate, pass the user's task to the subagent word for word. Add nothing except the project path.
  Do not add steps, acceptance criteria, file names or design choices the user did not give.
- If the user names an agent, delegate to it even if the task looks outside its role. Do not do the work yourself instead;
  the agent decides whether to hand off.
- If the task has no checkable acceptance criteria, do not invent them. Return a handoff (Scope, Owner, Unresolved) that
  names Codex or the project owner for the missing decision.
- One owner per concern. If asked to have two agents do the same work, use one and say why.
RULE
