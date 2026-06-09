#!/usr/bin/env bash

set -e

# Change directory to the project root (one level up from script's dir)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== ESP32-C3 MicroPython REPL ==="
echo "💡 Press Ctrl + ] to exit the REPL."
echo "💡 Press Ctrl + D inside the REPL to trigger a soft-reboot."
echo "------------------------------------------------------------"

# 1. Auto-detect serial port
PORT=$(ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null | head -n 1 || true)

if [ -z "$PORT" ]; then
    echo "❌ Error: No connected ESP32 device found on /dev/ttyACM* or /dev/ttyUSB*"
    exit 1
fi

# 2. Dynamic permission checking
RUN_PREFIX=""
if [ ! -w "$PORT" ]; then
    RUN_PREFIX="sudo env PATH=$PATH"
fi

# 3. Choose correct mpremote executable
if [ -f ".venv/bin/mpremote" ]; then
    MPREMOTE=".venv/bin/mpremote"
else
    MPREMOTE="mpremote"
fi

# 4. Connect to REPL (using resume to avoid soft-reset on connect)
$RUN_PREFIX $MPREMOTE connect "$PORT" resume repl
