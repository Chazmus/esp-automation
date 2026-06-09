import network
import time
import secrets

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
        
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if wlan.isconnected():
        print("✅ Already connected to WiFi!")
        print("   IP Address:", wlan.ifconfig()[0])
        return True
        
    print(f"Connecting to WiFi network '{ssid}'", end="")
    wlan.connect(ssid, password)
    
    # Wait for connection or timeout (15 seconds)
    timeout = 15
    start_time = time.time()
    
    while not wlan.isconnected():
        if time.time() - start_time > timeout:
            print("\n❌ Failed to connect: WiFi connection timeout.")
            return False
        print(".", end="")
        time.sleep(0.5)
        
    print("\n✅ Connected successfully!")
    print("   IP Configuration:", wlan.ifconfig())
    return True
