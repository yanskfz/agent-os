#!/bin/sh
# SessionStart hook: print the top of the project's BRIEF.md (Status, Open questions, Next step)
# so a new session knows where the project stands without the user re-explaining.
BRIEF="${CLAUDE_PROJECT_DIR:-.}/BRIEF.md"
if [ ! -f "$BRIEF" ]; then
  echo "No BRIEF.md in this project. Use the agent-os project-brief skill to create one before starting work."
  exit 0
fi
echo "Project brief (top of BRIEF.md; full file has requirements and decisions):"
# From "## Status" up to (not including) the next section after "## Next step". Capped at 40 lines.
awk '/^## Status/{on=1} on && /^## / && !/^## (Status|Open questions|Next step)/{exit} on' "$BRIEF" | head -40
