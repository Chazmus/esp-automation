#!/usr/bin/env python3
import os
import sys
import glob
import subprocess
import time

def find_serial_port():
    ports = glob.glob('/dev/ttyACM*') + glob.glob('/dev/ttyUSB*')
    if not ports:
        return None
    return sorted(ports)[0]

def main():
    print("=== ESP32-C3 Status Check ===")
    
    port = find_serial_port()
    if not port:
        print("❌ Error: No connected ESP32 device found on /dev/ttyACM* or /dev/ttyUSB*", file=sys.stderr)
        print("Please ensure your ESP32-C3 is plugged into a USB port.", file=sys.stderr)
        sys.exit(1)
        
    print(f"🔍 Detected board on port: {port}")
    
    has_write_permission = os.access(port, os.W_OK)
    cmd_prefix = []
    if not has_write_permission:
        print(f"⚠️  Note: Current user doesn't have write permissions to {port} yet.")
        print("   Using sudo to execute commands (this won't be needed once you log out & back in).")
        cmd_prefix = ["sudo"]
        
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    venv_mpremote = os.path.join(project_root, ".venv", "bin", "mpremote")
    venv_esptool = os.path.join(project_root, ".venv", "bin", "esptool")
    mpremote = venv_mpremote if os.path.isfile(venv_mpremote) else "mpremote"
    esptool = venv_esptool if os.path.isfile(venv_esptool) else "esptool"
    
    # 1. Query board chip information
    print("\n--- 1. Querying Chip Information ---")
    esptool_cmd = cmd_prefix + [esptool, "--port", port, "chip-id"]
    try:
        subprocess.run(esptool_cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: esptool command failed: {e}", file=sys.stderr)
        sys.exit(e.returncode)
        
    # Give the USB-CDC port a moment to re-enumerate after hardware reset
    time.sleep(1)
    
    # 2. List files on the board
    print("\n--- 2. Listing Files on Board ---")
    mpremote_cmd = cmd_prefix + [mpremote, "connect", port, "ls"]
    try:
        subprocess.run(mpremote_cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: mpremote command failed: {e}", file=sys.stderr)
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()
