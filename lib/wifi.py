import network
import time
import secrets

STATUS_MAP = {
    1000: "STAT_IDLE",
    1001: "STAT_CONNECTING",
    202: "STAT_WRONG_PASSWORD",
    201: "STAT_NO_AP_FOUND",
    203: "STAT_ASSOC_FAIL",
    204: "STAT_HANDSHAKE_TIMEOUT",
    1010: "STAT_GOT_IP"
}

def get_status_desc(status):
    return STATUS_MAP.get(status, f"UNKNOWN ({status})")

def connect():
    """
    Connects to the WiFi network configured in secrets.py.
    Returns True if connection is successful, False otherwise.
    """
    ssid = secrets.WIFI_SSID
    password = secrets.WIFI_PASSWORD
    
    # Ensure credentials are configured
    if ssid == "your-wifi-ssid":
        print("⚠️  WiFi SSID is still set to placeholder values. Please update lib/secrets.py.")
        return False
        
    # 2. Initialize the Station Interface
    wlan = network.WLAN(network.STA_IF)
    
    # If already connected, skip resetting and reconnecting to keep connections (like WebREPL) alive
    if wlan.isconnected():
        print("✅ Already connected to WiFi!")
        print("   IP Configuration:", wlan.ifconfig())
        return True

    # 3. Set country code (GB based on timezone BST +01:00)
    try:
        network.country('GB')
        print("✅ Country code set to GB")
    except Exception as e:
        print(f"⚠️ Could not set country code: {e}")

    # 4. Toggle the interface to ensure a clean stack state
    print("🔄 Resetting WLAN interface...")
    wlan.active(False)
    time.sleep(0.5)
    wlan.active(True)
    time.sleep(0.5)
    
    # 4. Disable power management and adjust txpower for ESP32-C3 stability
    try:
        pm_none = getattr(wlan, "PM_NONE", 0)
        wlan.config(pm=pm_none)
        print("✅ Power management disabled")
    except Exception as e:
        print(f"⚠️ Could not set PM: {e}")
        
    try:
        # Lower txpower to 12 to avoid current draw spikes while maintaining range
        wlan.config(txpower=12)
        print("✅ Tx power set to 12")
    except Exception as e:
        print(f"⚠️ Could not set txpower: {e}")
        
    # 5. Connect
    if hasattr(secrets, "WIFI_STATIC_IP") and secrets.WIFI_STATIC_IP:
        try:
            wlan.ifconfig(secrets.WIFI_STATIC_IP)
            print(f"✅ Configured static IP: {secrets.WIFI_STATIC_IP[0]}")
        except Exception as e:
            print(f"⚠️ Could not set static IP configuration: {e}")
            
    print(f"Connecting to WiFi network '{ssid}'...")
    
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        print(f"📡 WiFi Connection Attempt {attempt}/{max_retries}...")
        try:
            wlan.disconnect()
            time.sleep(0.2)
            wlan.connect(ssid, password)
        except Exception as e:
            print(f"  Connect notice: {e}")

            
        timeout = 8
        start_time = time.time()
        while not wlan.isconnected():
            status = wlan.status()
            if time.time() - start_time > timeout:
                print(f"  Attempt {attempt} timed out. Status: {get_status_desc(status)}")
                break
            
            # If ESP32 reports transient handshake failure, re-trigger attempt
            if status in (201, 202, 203, 204) and (time.time() - start_time) > 2:
                print(f"  Transient status: {get_status_desc(status)}. Retrying...")
                break
                
            print(f"  Status: {get_status_desc(status)}")
            time.sleep(1.0)
            
        if wlan.isconnected():
            break
        time.sleep(1.0)
        
    if not wlan.isconnected():
        print(f"\n❌ Failed to connect after {max_retries} attempts. Final Status: {get_status_desc(wlan.status())}")
        return False

    print("\n✅ Connected successfully!")
    print("   IP Configuration:", wlan.ifconfig())
    try:
        import webrepl
        webrepl.start()
    except Exception as e:
        print(f"⚠️ Could not start WebREPL: {e}")
    return True


