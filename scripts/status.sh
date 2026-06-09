#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Change directory to the project root (one level up from script's dir)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== ESP32-C3 Status Check ==="

# 1. Auto-detect serial port
PORT=$(ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null | head -n 1 || true)

if [ -z "$PORT" ]; then
    echo "❌ Error: No connected ESP32 device found on /dev/ttyACM* or /dev/ttyUSB*"
    echo "Please ensure your ESP32-C3 is plugged into a USB port."
    exit 1
fi

echo "🔍 Detected board on port: $PORT"

# 2. Dynamic permission checking (fallback to sudo if not writable)
RUN_PREFIX=""
if [ ! -w "$PORT" ]; then
    echo "⚠️  Note: Current user doesn't have write permissions to $PORT yet."
    echo "   Using sudo to execute commands (this won't be needed once you log out & back in)."
    RUN_PREFIX="sudo env PATH=$PATH"
fi

# 3. Choose the correct Python/pip executables (prefer local venv)
if [ -f ".venv/bin/mpremote" ]; then
    MPREMOTE=".venv/bin/mpremote"
    ESPTOOL=".venv/bin/esptool"
else
    MPREMOTE="mpremote"
    ESPTOOL="esptool"
fi

# 4. Query board chip information
echo -e "\n--- 1. Querying Chip Information ---"
$RUN_PREFIX $ESPTOOL --port "$PORT" chip-id

# Give the USB-CDC port a moment to re-enumerate on the host after the hardware reset
sleep 1

# 5. List files on the board
echo -e "\n--- 2. Listing Files on Board ---"
$RUN_PREFIX $MPREMOTE connect "$PORT" ls
