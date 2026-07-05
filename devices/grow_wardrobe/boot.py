# boot.py -- Startup configuration for grow_wardrobe node
import gc
import esp
import machine
import wifi
import secrets

# Disable OS debug info
esp.osdebug(None)

# Run garbage collection
gc.collect()

print("========================================")
print("ESP32-C3 Grow Wardrobe Boot Process")
print("========================================")

# 1. Connect to WiFi
wifi_connected = wifi.connect()

# 2. Check and configure WebREPL
if wifi_connected:
    webrepl_configured = False
    try:
        import webrepl_cfg
        if webrepl_cfg.PASS == secrets.WEBREPL_PASSWORD:
            webrepl_configured = True
        else:
            print("⚠️ WebREPL password mismatch. Updating password...")
    except Exception:
        print("⚠️ WebREPL config not found. Creating webrepl_cfg.py...")
        
    if not webrepl_configured:
        try:
            with open("webrepl_cfg.py", "w") as f:
                f.write(f"PASS = {repr(secrets.WEBREPL_PASSWORD)}\n")
            print("✅ WebREPL password written successfully.")
            print("🔄 Resetting board to apply WebREPL configurations...")
            machine.reset()
        except Exception as e:
            print(f"❌ Failed to write WebREPL config: {e}")
            
    # 3. Start WebREPL
    try:
        import webrepl
        webrepl.start()
        print("✅ WebREPL server started successfully.")
    except Exception as e:
        print(f"❌ Failed to start WebREPL: {e}")
else:
    print("❌ WiFi connection failed. WebREPL could not be started.")

print("--- boot.py executed successfully ---")
