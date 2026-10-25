# How to use agent-os (from a phone)

Everything happens in GitHub (browser or app) and claude.ai/code. No laptop, no terminal on your side.

## 0. One-time setup (per Claude Code cloud environment)
This makes the plugin available in **every** repo you open in that environment.

1. claude.ai/code → open any session → environment menu (title bar) → **Edit**.
2. In **Setup script**, paste the contents of [`cloud-setup-script.sh`](cloud-setup-script.sh). Save.
3. Start a new session. The plugin is installed before the session starts.
   Check: type `/agent-os:` in the prompt box. You should see 6 skills.

Why a setup script: plugin installs live in the container, and every cloud session starts with a fresh container.
A `.claude/settings.json` that only names the plugin does **not** install it on its own in a fresh container
(tested: see `TEST-RESULTS.md`, note under Test F). The setup script runs before each session, so it does.

## 1. Create a new project
1. GitHub → **New repository** → name it (e.g. `budi-profile`), Private, create (empty is fine).
2. Claude GitHub App → Configure → add the new repo.
3. claude.ai/code → pick the new repo → paste:
   > Set up this repo from the agent-os template `company-profile` (https://github.com/yanskfz/agent-os, folder templates/company-profile). Copy the files to the repo root, then use the project-brief skill to start BRIEF.md with me. Open a PR.

   For a project with no template yet (web app, Sheets automation, API work), paste instead:
   > Use the agent-os project-brief skill to create BRIEF.md for this project, then the project-planner agent to plan it. Wait for "lanjut" before building.

## 2. Enable the skills in a project
Already done by step 0 for every repo. Optionally also commit this `.claude/settings.json` in the project
(the template has it). It tells Claude which marketplace and plugin the project expects:
```json
{
  "extraKnownMarketplaces": {
    "yansz-agent-os": { "source": { "source": "github", "repo": "yanskfz/agent-os" } }
  },
  "enabledPlugins": { "agent-os@yansz-agent-os": true }
}
```

## 3. Use the agents
Ask in plain words. Claude picks the agent, or you name it:

| You want | Say | Agent |
|----------|-----|-------|
| A plan | "Plan this with the project-planner agent" | `agent-os:project-planner` |
| A change | "Use the developer agent to ..." | `agent-os:developer` |
| A review | "Review this branch with the code-reviewer agent" | `agent-os:code-reviewer` |
| Testing | "Run QA" / "Use the qa-agent" | `agent-os:qa-agent` |
| Deploy check | "Is the preview up? Use the deployment-assistant" | `agent-os:deployment-assistant` |

Skills can be called directly too: `/agent-os:project-planning`, `/agent-os:code-review`, etc.
Not every task needs every agent. A typo fix needs none.

## 4. Run validation
- In a project: "Run the testing-and-validation skill." It runs the project's tests or, for static sites,
  screenshots at nine viewports (320 to 1920 px) with one OK/FAIL line each.
- For agent-os itself: "Run `node tests/run-tests.js` and update TEST-RESULTS.md." (takes ~10 minutes).

## 5. Update the shared library
1. Open a session on **agent-os** and describe the change ("make the code-reviewer also check X").
2. Claude edits `plugins/agent-os/...`, bumps `version` in `plugins/agent-os/.claude-plugin/plugin.json`,
   runs `claude plugin validate .` and the tests, and opens a PR.
3. You merge the PR on GitHub.

## 6. Spread updates to all projects
Nothing to do per project. The setup script runs `marketplace update` + `plugin update` before every new
session, so the next session in any repo gets the merged version.
To check which version a session has: ask "Which agent-os plugin version is loaded?"

## Where things live
```
.claude-plugin/marketplace.json    marketplace "yansz-agent-os" (lists the plugin)
plugins/agent-os/                  the plugin: skills/, agents/, hooks/, scripts/
templates/company-profile/         starter files for a company profile site
fixtures/sample-site/              isolated test project (never a real site)
tests/run-tests.js                 tests A-G; results in tests/results/ and TEST-RESULTS.md
docs/                              this guide and the cloud setup script
```

## Known limitations
- **Permission rules and RTK.** The RTK hook rewrites Bash commands (`git diff` → `rtk git diff`) and Claude Code
  checks permissions on the rewritten command. If a project allows specific commands in `.claude/settings.json`
  (e.g. `Bash(git *)`), add an `rtk` twin for each (`Bash(rtk git *)`). Do not allow `Bash(rtk *)`: that would allow any command.
  Found by Test D/E (first run): the subagents were denied until the twins were added.
- **Settings alone do not install the plugin** in a fresh cloud container; use the setup script (step 0).
  Not tested: whether the interactive claude.ai/code UI offers to install it from project settings.
- **Cowork** (the desktop/mobile Cowork app) is a separate product; this plugin setup covers Claude Code only.
- **Agent tests use a small model** (`claude-haiku-5-5`) to keep costs down. Results with larger models may differ;
  rerun with `MODEL=<model id> node tests/run-tests.js`.
- **Agent output is not deterministic.** A test that passed can fail on a rerun; the harness records each run.
- **Projects that already have their own RTK hooks** (e.g. `msj-profiles/.claude/`) will run RTK twice once the plugin
  is on. Remove the project copy when switching that project to the plugin.
