#!/usr/bin/env python3
import os
import sys
import glob
import subprocess

def find_serial_port():
    ports = glob.glob('/dev/ttyACM*') + glob.glob('/dev/ttyUSB*')
    if not ports:
        return None
    return sorted(ports)[0]

def main():
    print("=== ESP32-C3 MicroPython REPL ===")
    print("💡 Press Ctrl + ] to exit the REPL.")
    print("💡 Press Ctrl + D inside the REPL to trigger a soft-reboot.")
    print("------------------------------------------------------------")
    
    port = find_serial_port()
    if not port:
        print("❌ Error: No connected ESP32 device found on /dev/ttyACM* or /dev/ttyUSB*", file=sys.stderr)
        sys.exit(1)
        
    has_write_permission = os.access(port, os.W_OK)
    cmd_prefix = []
    if not has_write_permission:
        cmd_prefix = ["sudo"]
        
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    venv_mpremote = os.path.join(project_root, ".venv", "bin", "mpremote")
    mpremote = venv_mpremote if os.path.isfile(venv_mpremote) else "mpremote"
    
    repl_cmd = cmd_prefix + [mpremote, "connect", port, "resume", "repl"]
    try:
        subprocess.run(repl_cmd, check=True)
    except subprocess.CalledProcessError as e:
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()
