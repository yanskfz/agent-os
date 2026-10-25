---
name: deployment-verification
description: Check whether a project is ready to deploy, diagnose build or deployment errors, and verify what is actually live, using only the access available. Use for "is it deployed", "why did the build fail", "check Vercel", "cek preview", "is production up", or before and after merging to the production branch.
---

# Deployment verification

Read-only by default. Never deploy to production, change domains, or change protection settings
unless the user explicitly asks in this session.

## Inputs
- The project, the branch or PR, and the expected deploy target (Vercel by default).

## Steps
1. **Config**: read the deploy config that exists (`vercel.json`, `.vercelignore`, framework config, `package.json` build script).
   For static sites, confirm the output is the repo root and nothing private is published (docs, scripts, `.claude/`).
2. **Status on GitHub** (works without Vercel login):
   `gh api repos/<owner>/<repo>/commits/<sha>/statuses --jq '.[] | .context+" "+.state+" "+.target_url'`
   and the Vercel bot comment on the PR (`gh api repos/<owner>/<repo>/issues/<n>/comments`) for the preview link.
3. **Reachability**: `curl -s -o /dev/null -w '%{http_code}' <url>`.
   `200` = public, `302`/`401` = protected (expected for previews), `404` = nothing deployed at that path.
4. **Build errors**: if the status is `failure`/`error`, open the target URL from the status if accessible,
   or ask the user to copy the build log from the Vercel dashboard (Deployments → the failed one → Build Logs).
5. Report what is live where, and what is blocked.

## Output
```
Target: <url>   HTTP: <code>   Meaning: <public|protected|missing|error>
GitHub status: <context> <state> (<sha>)
Ready to deploy: yes|no - <reason>
```

## Validation
- Every status comes from a command run in this session, with the commit it refers to.
- Production state is reported but never changed without an explicit request.
