#!/bin/sh
# PreToolUse hook for Bash: let RTK rewrite the command so its output is compressed.
# Does nothing (exit 0) when RTK is not installed yet.
RTK="$(command -v rtk 2>/dev/null)"
[ -z "$RTK" ] && [ -x "$HOME/.local/bin/rtk" ] && RTK="$HOME/.local/bin/rtk"
[ -n "$RTK" ] || exit 0
exec "$RTK" hook claude
