#!/usr/bin/env python3
import os
import sys
import glob
import time
import subprocess

def find_serial_port():
    ports = glob.glob('/dev/ttyACM*') + glob.glob('/dev/ttyUSB*')
    if not ports:
        return None
    return sorted(ports)[0]

def main():
    print("==========================================")
    print(" 🔌 ESP32-C3 USB Diagnostics & Status ")
    print("==========================================")
    
    port = find_serial_port()
    if not port:
        print("❌ Error: No connected ESP32 device found on /dev/ttyACM* or /dev/ttyUSB*", file=sys.stderr)
        print("Please ensure your ESP32-C3 is plugged into a USB port.", file=sys.stderr)
        sys.exit(1)
        
    print(f"🔍 Detected board on port: {port}")
    
    has_write_permission = os.access(port, os.W_OK)
    cmd_prefix = []
    if not has_write_permission:
        print(f"⚠️  Note: Current user lacks direct write permissions to {port}.")
        print("   Executing with sudo permissions...")
        cmd_prefix = ["sudo"]
        
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    venv_esptool = os.path.join(project_root, ".venv", "bin", "esptool")
    esptool = venv_esptool if os.path.isfile(venv_esptool) else "esptool"
    
    # 1. Hardware & MAC Information
    print("\n--- 1. Hardware & MAC Information ---")
    esptool_cmd = cmd_prefix + [esptool, "--port", port, "read_mac"]
    try:
        res = subprocess.run(esptool_cmd, capture_output=True, text=True)
        for line in res.stdout.splitlines():
            if any(k in line for k in ["MAC:", "Chip type:", "Features:", "Crystal frequency:"]):
                print("  ", line.strip())
    except Exception as e:
        print(f"⚠️ Could not read MAC via esptool: {e}")
        
    time.sleep(0.5)
    
    # 2. Query MicroPython Runtime Status over Serial
    print("\n--- 2. MicroPython Runtime & Network Status ---")
    py_code = (
        "import network, gc, os; w=network.WLAN(network.STA_IF); "
        "cfg=w.ifconfig() if w.isconnected() else ('DISCONNECTED', 'N/A', 'N/A', 'N/A'); "
        "print('===DIAG===', w.isconnected(), cfg[0], cfg[1], cfg[2], cfg[3], gc.mem_free(), os.listdir('/'))"
    )
    
    ser_script = (
        f"import serial, time\n"
        f"ser = serial.Serial('{port}', 115200, timeout=2)\n"
        f"ser.write(b'\\x03')\n"
        f"time.sleep(0.3)\n"
        f"ser.write(b'{py_code}\\r\\n')\n"
        f"time.sleep(1.0)\n"
        f"out = ser.read_all().decode('utf-8', errors='replace')\n"
        f"ser.write(b'import main\\r\\n')\n"
        f"ser.close()\n"
        f"for line in out.splitlines():\n"
        f"    if '===DIAG===' in line:\n"
        f"        parts = line.split('===DIAG===')[1].strip().split()\n"
        f"        print('   WiFi Connected :', parts[0])\n"
        f"        print('   IP Address     :', parts[1])\n"
        f"        print('   Subnet Mask    :', parts[2])\n"
        f"        print('   Gateway IP     :', parts[3])\n"
        f"        print('   DNS Server     :', parts[4])\n"
        f"        print('   Free RAM       :', parts[5], 'bytes')\n"
        f"        print('   Root Files     :', ' '.join(parts[6:]))\n"
    )
    
    try:
        if cmd_prefix:
            run_cmd = ["sudo", sys.executable, "-c", ser_script]
        else:
            run_cmd = [sys.executable, "-c", ser_script]
        res = subprocess.run(run_cmd, capture_output=True, text=True, timeout=5)
        if res.stdout.strip():
            print(res.stdout)
        else:
            print("  ⚠️ Could not parse REPL status response.")
    except Exception as e:
        print(f"  ⚠️ Error querying MicroPython status: {e}")
        
    # 3. Live Log Stream (5 Seconds)
    print("--- 3. Live Device Logs (5 Second Stream) ---")
    log_script = (
        f"import serial, time\n"
        f"ser = serial.Serial('{port}', 115200, timeout=1)\n"
        f"start = time.time()\n"
        f"while time.time() - start < 5:\n"
        f"    line = ser.readline().decode('utf-8', errors='replace').rstrip()\n"
        f"    if line:\n"
        f"        print('  [LOG]', line)\n"
        f"ser.close()\n"
    )
    try:
        if cmd_prefix:
            run_cmd = ["sudo", sys.executable, "-c", log_script]
        else:
            run_cmd = [sys.executable, "-c", log_script]
        res = subprocess.run(run_cmd, capture_output=True, text=True, timeout=7)
        if res.stdout.strip():
            print(res.stdout)
        else:
            print("  (No log output received during stream period)")
    except Exception as e:
        print(f"  ⚠️ Stream error: {e}")

    print("==========================================")

if __name__ == "__main__":
    main()
