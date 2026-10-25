# Test results

Updated: 2026-10-25T04:56:44.699Z

| Test | Status | Evidence | Run |
|------|--------|----------|-----|
| A. Skill and agent discovery | **PASS** | Configuration validated: yes (claude plugin validate)<br>Skills discovered: yes (7)<br>Agents discovered: yes (5)<br>Brief hook ran: yes | 2026-10-25T04:56:44.699Z · `claude-haiku-5-5` |
| B. Planner produces tasks, dependencies, acceptance criteria, definition of done | **PASS** | Agent invoked: yes (Agent tool, subagent_type agent-os:project-planner)<br>Task completed: yes (all 4 sections present)<br>Planner stayed read-only: yes | 2026-10-25T04:56:44.699Z · `claude-haiku-5-5` |
| C. Developer makes a real, tested change | **PASS** | Agent invoked: yes (agent-os:developer)<br>Files changed: yes:  2 files changed, 30 insertions(+), 2 deletions(-)<br>Tests passed (re-run by harness): yes<br>Behaviour checked by harness: yes | 2026-10-25T04:56:44.699Z · `claude-haiku-5-5` |
| D. Code Reviewer finds a planted defect | **PASS** | Agent invoked: yes (agent-os:code-reviewer)<br>Defect detected: yes<br>Reviewer stayed read-only: yes<br>Defect corrected, tests pass: yes (git revert, npm test) | 2026-10-25T04:56:44.699Z · `claude-haiku-5-5` |
| E. QA Agent runs the suite and reports the real result | **PASS** | Agent invoked: yes (agent-os:qa-agent)<br>Tests executed: yes (npm test seen in session)<br>Verdict matches reality: yes (PASS) | 2026-10-25T04:56:44.699Z · `claude-haiku-5-5` |
| F. Reuse in a second project without copying code | **PASS** | Marketplace added: yes (source: local checkout)<br>Plugin installed (project scope): yes<br>Skills discovered in project 2: 6/6<br>Agents discovered in project 2: 5/5<br>No app code copied: yes (files: .claude/settings.json, README.md) | 2026-10-25T04:21:27.792Z · `claude-haiku-5-5` |
| G. Cloud setup script installs the plugin for any repo | **PASS** | Setup script ran: yes<br>Source: yanskfz/agent-os#feat/initial-agent-os<br>Plugin loaded in new session: yes (agent-os@yansz-agent-os v0.1.0)<br>Skills / agents discovered: 6/6 skills, 5/5 agents | 2026-10-25T04:20:20.885Z · `claude-haiku-5-5` |

Raw session logs: `tests/results/logs/`. Details: `tests/results/latest.json`.
