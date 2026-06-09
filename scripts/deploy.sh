#!/usr/bin/env bash

set -e

# Change directory to the project root (one level up from script's dir)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. Validate device argument
if [ -z "$1" ]; then
    echo "❌ Error: Please specify a device directory to deploy."
    echo "Usage: ./scripts/deploy.sh <device_directory>"
    echo -e "\nAvailable devices:"
    for dir in devices/*/; do
        if [ -d "$dir" ]; then
            echo "  * $(basename "$dir")"
        fi
    done
    exit 1
fi

DEVICE="$1"

if [ ! -d "devices/$DEVICE" ]; then
    echo "❌ Error: Device directory 'devices/$DEVICE' does not exist."
    echo -e "\nAvailable devices:"
    for dir in devices/*/; do
        if [ -d "$dir" ]; then
            echo "  * $(basename "$dir")"
        fi
    done
    exit 1
fi

echo "=== ESP32-C3 Selective Deployer ==="
echo "📱 Target Device: $DEVICE"

# 2. Auto-detect serial port
PORT=$(ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null | head -n 1 || true)

if [ -z "$PORT" ]; then
    echo "❌ Error: No connected ESP32 device found on /dev/ttyACM* or /dev/ttyUSB*"
    exit 1
fi

echo "🔍 Detected board on port: $PORT"

# 3. Dynamic permission checking
RUN_PREFIX=""
if [ ! -w "$PORT" ]; then
    echo "⚠️  Using sudo for permission to access serial port..."
    RUN_PREFIX="sudo env PATH=$PATH"
fi

# 4. Choose correct mpremote executable
if [ -f ".venv/bin/mpremote" ]; then
    MPREMOTE=".venv/bin/mpremote"
else
    MPREMOTE="mpremote"
fi

# 5. Create /lib directory on the microcontroller if it doesn't exist
echo "📁 Preparing /lib directory on microcontroller..."
$RUN_PREFIX $MPREMOTE connect "$PORT" resume exec "import os; 'lib' in os.listdir() or os.mkdir('lib')"

# 6. Upload shared libraries from lib/ folder to :lib/
if [ -d "lib" ] && [ "$(ls -A lib 2>/dev/null)" ]; then
    echo "📤 Synchronizing shared libraries to /lib on ESP32-C3..."
    for filepath in lib/*.py; do
        if [ -f "$filepath" ]; then
            filename=$(basename "$filepath")
            echo "   👉 Deploying shared $filepath to :lib/$filename..."
            $RUN_PREFIX $MPREMOTE connect "$PORT" resume cp "$filepath" ":lib/$filename"
        fi
    done
fi

# 7. Upload device-specific files from devices/$DEVICE/ folder to microcontroller root (/)
echo "📤 Synchronizing device-specific files to root..."
for filepath in devices/$DEVICE/*.py; do
    if [ -f "$filepath" ]; then
        filename=$(basename "$filepath")
        echo "   👉 Deploying device file $filepath to :$filename..."
        $RUN_PREFIX $MPREMOTE connect "$PORT" resume cp "$filepath" ":$filename"
    fi
done

# 8. Soft reset the board to launch the new code
echo "🔄 Soft resetting the board to execute new code..."
$RUN_PREFIX $MPREMOTE connect "$PORT" resume soft-reset

echo "✅ Deployment complete! Your $DEVICE code is now running."
