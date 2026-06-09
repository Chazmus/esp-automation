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

def get_available_devices(project_root):
    devices_dir = os.path.join(project_root, "devices")
    if not os.path.isdir(devices_dir):
        return []
    return sorted([
        name for name in os.listdir(devices_dir)
        if os.path.isdir(os.path.join(devices_dir, name))
    ])

def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 1. Validate device argument
    available_devices = get_available_devices(project_root)
    
    if len(sys.argv) < 2:
        print("❌ Error: Please specify a device directory to deploy.", file=sys.stderr)
        print("Usage: python3 scripts/deploy.py <device_directory>", file=sys.stderr)
        print("\nAvailable devices:", file=sys.stderr)
        for dev in available_devices:
            print(f"  * {dev}", file=sys.stderr)
        sys.exit(1)
        
    device = sys.argv[1]
    
    if device not in available_devices:
        print(f"❌ Error: Device directory 'devices/{device}' does not exist.", file=sys.stderr)
        print("\nAvailable devices:", file=sys.stderr)
        for dev in available_devices:
            print(f"  * {dev}", file=sys.stderr)
        sys.exit(1)
        
    print("=== ESP32-C3 Selective Deployer ===")
    print(f"📱 Target Device: {device}")
    
    # 2. Auto-detect serial port
    port = find_serial_port()
    if not port:
        print("❌ Error: No connected ESP32 device found on /dev/ttyACM* or /dev/ttyUSB*", file=sys.stderr)
        sys.exit(1)
        
    print(f"🔍 Detected board on port: {port}")
    
    # 3. Dynamic permission checking
    has_write_permission = os.access(port, os.W_OK)
    cmd_prefix = []
    if not has_write_permission:
        print("⚠️  Using sudo for permission to access serial port...")
        cmd_prefix = ["sudo"]
        
    # 4. Choose correct mpremote/esptool executables
    venv_mpremote = os.path.join(project_root, ".venv", "bin", "mpremote")
    venv_esptool = os.path.join(project_root, ".venv", "bin", "esptool")
    mpremote = venv_mpremote if os.path.isfile(venv_mpremote) else "mpremote"
    esptool = venv_esptool if os.path.isfile(venv_esptool) else "esptool"
    
    # Hard-reset the board to break any frozen print loops (common with native USB CDC on ESP32-C3)
    print("🔄 Resetting the board to prepare for deployment...")
    esptool_cmd = cmd_prefix + [esptool, "--port", port, "chip-id"]
    subprocess.run(esptool_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    
    # 5. Create /lib directory on the microcontroller if it doesn't exist
    print("📁 Preparing /lib directory on microcontroller...")
    mpremote_cmd_mkdir = cmd_prefix + [
        mpremote, "connect", port, "resume", "exec", 
        "import os; 'lib' in os.listdir() or os.mkdir('lib')"
    ]
    try:
        subprocess.run(mpremote_cmd_mkdir, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error preparing /lib: {e}", file=sys.stderr)
        sys.exit(e.returncode)
        
    # 6. Upload shared libraries from lib/ folder to :lib/
    shared_lib_dir = os.path.join(project_root, "lib")
    if os.path.isdir(shared_lib_dir):
        lib_files = glob.glob(os.path.join(shared_lib_dir, "*.py"))
        if lib_files:
            print("📤 Synchronizing shared libraries to /lib on ESP32-C3...")
            for filepath in sorted(lib_files):
                filename = os.path.basename(filepath)
                print(f"   👉 Deploying shared {os.path.relpath(filepath, project_root)} to :lib/{filename}...")
                mpremote_cmd_cp = cmd_prefix + [mpremote, "connect", port, "resume", "cp", filepath, f":lib/{filename}"]
                try:
                    subprocess.run(mpremote_cmd_cp, check=True)
                except subprocess.CalledProcessError as e:
                    print(f"❌ Error copying {filename}: {e}", file=sys.stderr)
                    sys.exit(e.returncode)
                    
    # 7. Upload device-specific files from devices/$DEVICE/ folder to microcontroller root (/)
    device_dir = os.path.join(project_root, "devices", device)
    device_files = glob.glob(os.path.join(device_dir, "*.py"))
    if device_files:
        print("📤 Synchronizing device-specific files to root...")
        for filepath in sorted(device_files):
            filename = os.path.basename(filepath)
            print(f"   👉 Deploying device file {os.path.relpath(filepath, project_root)} to :{filename}...")
            mpremote_cmd_cp_dev = cmd_prefix + [mpremote, "connect", port, "resume", "cp", filepath, f":{filename}"]
            try:
                subprocess.run(mpremote_cmd_cp_dev, check=True)
            except subprocess.CalledProcessError as e:
                print(f"❌ Error copying {filename}: {e}", file=sys.stderr)
                sys.exit(e.returncode)
                
    # 8. Soft reset the board to launch the new code
    print("🔄 Soft resetting the board to execute new code...")
    mpremote_cmd_reset = cmd_prefix + [mpremote, "connect", port, "resume", "soft-reset"]
    try:
        subprocess.run(mpremote_cmd_reset, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error during soft reset: {e}", file=sys.stderr)
        sys.exit(e.returncode)
        
    print(f"✅ Deployment complete! Your {device} code is now running.")

if __name__ == "__main__":
    main()
