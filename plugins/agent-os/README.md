# agent-os

Yansz's reusable AI agent library for Claude Code: skills, subagents, hooks and project templates,
packaged as one Claude Code plugin and managed from a phone.

- **Plugin** `agent-os` (in `plugins/agent-os/`), published through the marketplace `yansz-agent-os` in this repo.
  - Skills: `project-planning`, `web-development`, `code-review`, `testing-and-validation`, `deployment-verification`, `project-brief`.
  - Agents: `project-planner`, `developer`, `code-reviewer`, `qa-agent`, `deployment-assistant`.
  - Hooks: RTK token saving for Bash output; prints the project's `BRIEF.md` status at session start.
- **Templates**: `templates/company-profile/` (one-screen carousel site, plain HTML/CSS/JS, Vercel-ready).
- **Proof**: `TEST-RESULTS.md` (what was actually run and what passed).

Install and usage: see docs/HOW-TO.md in https://github.com/yanskfz/agent-os.
