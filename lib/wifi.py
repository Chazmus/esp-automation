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
        
    # 1. Set country code (GB based on timezone BST +01:00)
    try:
        network.country('GB')
        print("✅ Country code set to GB")
    except Exception as e:
        print(f"⚠️ Could not set country code: {e}")
        
    # 2. Initialize the Station Interface
    wlan = network.WLAN(network.STA_IF)
    
    # 3. Toggle the interface to ensure a clean stack state
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
    wlan.connect(ssid, password)

    
    # 6. Wait for connection or timeout (15 seconds)
    timeout = 15
    start_time = time.time()
    
    while not wlan.isconnected():
        if time.time() - start_time > timeout:
            print(f"\n❌ Failed to connect: WiFi connection timeout. Final Status: {get_status_desc(wlan.status())}")
            return False
            
        print(f"  Status: {get_status_desc(wlan.status())}")
        time.sleep(1.0)
        
    print("\n✅ Connected successfully!")
    print("   IP Configuration:", wlan.ifconfig())
    return True
