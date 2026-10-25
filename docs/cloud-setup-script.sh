#!/bin/sh
# Claude Code cloud environment setup script for agent-os.
# Paste this into claude.ai/code → environment menu → Edit → Setup script (once per environment).
# It runs before every new session, so every repo in that environment gets the plugin, latest version.
# Safe to re-run. Set AGENT_OS_SOURCE to test another source (a local path or owner/repo).
SOURCE="${AGENT_OS_SOURCE:-yanskfz/agent-os}"
claude plugin marketplace add "$SOURCE" >/dev/null 2>&1 || claude plugin marketplace update yansz-agent-os >/dev/null 2>&1
claude plugin install agent-os@yansz-agent-os >/dev/null 2>&1 || claude plugin update agent-os@yansz-agent-os >/dev/null 2>&1
claude plugin list 2>/dev/null | grep -q "agent-os@yansz-agent-os" && echo "agent-os plugin ready" || { echo "agent-os plugin NOT installed"; exit 1; }
