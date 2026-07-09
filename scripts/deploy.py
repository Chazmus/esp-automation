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

def webrepl_soft_reset(project_root, ip, password):
    sys.path.insert(0, os.path.join(project_root, "scripts"))
    import webrepl_cli
    import socket
    try:
        s = socket.socket()
        s.settimeout(3)
        s.connect((ip, 8266))
        webrepl_cli.client_handshake(s)
        ws = webrepl_cli.websocket(s)
        webrepl_cli.login(ws, password)
        # Send Ctrl+C to interrupt any running script
        ws.write(b"\x03", frame=0x81)
        time.sleep(0.5)
        # Send Ctrl+D (soft reboot) using text frame (0x81)
        ws.write(b"\x04", frame=0x81)
        print("🔄 WebREPL soft-reset command sent successfully.")
        return True
    except Exception as e:
        print(f"⚠️ WebREPL soft-reset failed: {e}")
        return False



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
    # Add local lib folder to python path to resolve local secrets
    sys.path.insert(0, os.path.join(project_root, "lib"))
    
    # 1. Parse arguments (check for --ip <ip_address>)
    ip_addr = None
    args = sys.argv[1:]
    
    # Check for --ip flag
    if "--ip" in args:
        try:
            ip_idx = args.index("--ip")
            ip_addr = args[ip_idx + 1]
            # Remove --ip and the ip address from the args list
            args.pop(ip_idx + 1)
            args.pop(ip_idx)
        except IndexError:
            print("❌ Error: --ip option requires an IP address argument.", file=sys.stderr)
            sys.exit(1)

    available_devices = get_available_devices(project_root)
    
    if len(args) < 1:
        print("❌ Error: Please specify a device directory to deploy.", file=sys.stderr)
        print("Usage: python3 scripts/deploy.py <device_directory> [--ip <ip_address>]", file=sys.stderr)
        print("\nAvailable devices:", file=sys.stderr)
        for dev in available_devices:
            print(f"  * {dev}", file=sys.stderr)
        sys.exit(1)
        
    device = args[0]
    
    if device not in available_devices:
        print(f"❌ Error: Device directory 'devices/{device}' does not exist.", file=sys.stderr)
        print("\nAvailable devices:", file=sys.stderr)
        for dev in available_devices:
            print(f"  * {dev}", file=sys.stderr)
        sys.exit(1)
        
    print("=== ESP32-C3 Selective Deployer ===")
    print(f"📱 Target Device: {device}")
    
    # 2. Set port & setup connection details
    is_remote = ip_addr is not None
    cmd_prefix = []
    
    # Choose correct mpremote/esptool executables
    venv_mpremote = os.path.join(project_root, ".venv", "bin", "mpremote")
    venv_esptool = os.path.join(project_root, ".venv", "bin", "esptool")
    mpremote = venv_mpremote if os.path.isfile(venv_mpremote) else "mpremote"
    esptool = venv_esptool if os.path.isfile(venv_esptool) else "esptool"
    
    if is_remote:
        port = f"webrepl:{ip_addr}"
        print(f"📡 Remote WebREPL deployment selected: {port}")
    else:
        # Auto-detect serial port
        port = find_serial_port()
        if not port:
            print("❌ Error: No connected ESP32 device found on /dev/ttyACM* or /dev/ttyUSB*", file=sys.stderr)
            sys.exit(1)
            
        print(f"🔍 Detected board on port: {port}")
        
        # Dynamic permission checking
        has_write_permission = os.access(port, os.W_OK)
        if not has_write_permission:
            print("⚠️  Using sudo for permission to access serial port...")
            cmd_prefix = ["sudo"]
            
        # Hard-reset the board to break any frozen print loops (common with native USB CDC on ESP32-C3)
        print("🔄 Resetting the board to prepare for deployment...")
        esptool_cmd = cmd_prefix + [esptool, "--port", port, "chip-id"]
        subprocess.run(esptool_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1)

    
    # 5. Create /lib directory on the microcontroller if it doesn't exist (Only for serial)
    if not is_remote:
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
            print(f"📤 Synchronizing shared libraries to /lib on {device}...")
            import secrets
            for filepath in sorted(lib_files):
                filename = os.path.basename(filepath)
                print(f"   👉 Deploying shared {os.path.relpath(filepath, project_root)} to :lib/{filename}...")
                if is_remote:
                    try:
                        webrepl_cli = os.path.join(project_root, "scripts", "webrepl_cli.py")
                        subprocess.run([
                            sys.executable, webrepl_cli, "-p", secrets.WEBREPL_PASSWORD,
                            filepath, f"{ip_addr}:lib/{filename}"
                        ], check=True)
                    except subprocess.CalledProcessError as e:
                        print(f"❌ Error copying {filename}: {e}", file=sys.stderr)
                        sys.exit(e.returncode)
                else:
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
        import secrets
        for filepath in sorted(device_files):
            filename = os.path.basename(filepath)
            print(f"   👉 Deploying device file {os.path.relpath(filepath, project_root)} to :{filename}...")
            if is_remote:
                try:
                    webrepl_cli = os.path.join(project_root, "scripts", "webrepl_cli.py")
                    subprocess.run([
                        sys.executable, webrepl_cli, "-p", secrets.WEBREPL_PASSWORD,
                        filepath, f"{ip_addr}:{filename}"
                    ], check=True)
                except subprocess.CalledProcessError as e:
                    print(f"❌ Error copying {filename}: {e}", file=sys.stderr)
                    sys.exit(e.returncode)
            else:
                mpremote_cmd_cp_dev = cmd_prefix + [mpremote, "connect", port, "resume", "cp", filepath, f":{filename}"]
                try:
                    subprocess.run(mpremote_cmd_cp_dev, check=True)
                except subprocess.CalledProcessError as e:
                    print(f"❌ Error copying {filename}: {e}", file=sys.stderr)
                    sys.exit(e.returncode)
                
    # 8. Soft reset the board to launch the new code
    print("🔄 Soft resetting the board to execute new code...")
    if is_remote:
        import secrets
        webrepl_soft_reset(project_root, ip_addr, secrets.WEBREPL_PASSWORD)
    else:
        mpremote_cmd_reset = cmd_prefix + [mpremote, "connect", port, "resume", "soft-reset"]
        try:
            subprocess.run(mpremote_cmd_reset, check=True)
        except subprocess.CalledProcessError as e:
            print(f"❌ Error during soft reset: {e}", file=sys.stderr)
            sys.exit(e.returncode)
        
    print(f"✅ Deployment complete! Your {device} code is now running.")

if __name__ == "__main__":
    main()
