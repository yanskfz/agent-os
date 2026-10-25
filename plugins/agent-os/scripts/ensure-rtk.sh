#!/bin/sh
# SessionStart hook: make sure RTK (token-saving output filter) is installed.
# If it is missing, install it in the background so the session is not blocked.
# Until it is ready, commands simply run unfiltered.
RTK_VERSION="v0.49.0"
BIN_DIR="$HOME/.local/bin"
LOG="$HOME/.cache/rtk-install.log"
LOCK="$HOME/.cache/rtk-install.lock"

# Quiet, privacy-friendly defaults (only written if the user has no RTK config yet).
CONF="$HOME/.config/rtk/config.toml"
if [ ! -f "$CONF" ]; then
  mkdir -p "$(dirname "$CONF")"
  printf '[hooks]\nsuppress_hook_warning = true\n\n[telemetry]\nenabled = false\n' > "$CONF"
fi

if command -v rtk >/dev/null 2>&1 || [ -x "$BIN_DIR/rtk" ]; then
  echo "RTK ready."
  exit 0
fi

mkdir -p "$HOME/.cache" "$BIN_DIR"
if [ -e "$LOCK" ]; then
  echo "RTK install already running (log: $LOG)."
  exit 0
fi
touch "$LOCK"

(
  set -e
  trap 'rm -f "$LOCK"' EXIT
  # 1) Official installer: prebuilt binary for the pinned version, checksum-verified.
  if curl -fsSL "https://raw.githubusercontent.com/rtk-ai/rtk/refs/tags/$RTK_VERSION/install.sh" \
       | RTK_VERSION="$RTK_VERSION" RTK_INSTALL_DIR="$BIN_DIR" sh; then
    exit 0
  fi
  # 2) Fallback when release downloads are blocked: build the same tag from source (~5 min).
  command -v cargo >/dev/null 2>&1 || { echo "no cargo, giving up"; exit 1; }
  SRC="$HOME/.cache/rtk-src"
  rm -rf "$SRC"
  git clone -q --depth 1 --branch "$RTK_VERSION" https://github.com/rtk-ai/rtk "$SRC"
  cargo build -q --release --locked --manifest-path "$SRC/Cargo.toml"
  install -m755 "$SRC/target/release/rtk" "$BIN_DIR/rtk"
) >"$LOG" 2>&1 &

echo "RTK is installing in the background (seconds; up to ~5 min if it has to build). Commands run unfiltered until then."
