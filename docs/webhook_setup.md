# Remote Sensor Webhook Setup Guide (Cloudflare + Home Assistant)

This guide explains how to deploy a remote, off-network ESP32 temperature/humidity sensor (e.g. at a friend's house) that securely reports data back to your home Home Assistant instance over the internet with maximum battery efficiency.

---

## 1. Why Webhooks via Cloudflare Tunnel?

1. **Security & Restricted Access:**
   - Webhooks in Home Assistant use a secret, random endpoint (e.g., `/api/webhook/friend_house_sensor_8a9f3b7c2e`).
   - Unlike full Home Assistant access tokens (`HA_TOKEN`), Webhooks **cannot** read your home state, control smart devices, or access your network. If the physical sensor is stolen, the finder only gets a single endpoint URL that accepts temperature numbers.
2. **Battery Life (Single Request):**
   - Standard REST API posting sends multiple HTTP requests sequentially (temperature, humidity, status, battery voltage, battery percentage).
   - Webhook posting bundles all sensor metrics into **1 single JSON payload**, cutting active Wi-Fi transmission time from ~4s down to ~0.8s and extending battery life by up to 300%.

---

## 2. Step 1: Cloudflare Tunnel & Security Rules

### A. Expose Home Assistant Hostname
Ensure your Home Assistant instance is reachable externally via Cloudflare Tunnel (e.g., `https://ha.yourdomain.com`).

### B. Cloudflare Zero Trust (Access Bypass)
If you use Cloudflare Access (SSO login screen) for `ha.yourdomain.com`:
1. Go to **Cloudflare Zero Trust** → **Access** → **Applications**.
2. Edit your Home Assistant application and add a **Bypass Policy**:
   - **Path:** `/api/webhook/*`
   - **Action:** Bypass
   - *This allows your ESP32 board to POST to the webhook endpoint directly without requiring browser OAuth login.*

### C. Cloudflare WAF Rate Limiting
To protect your webhook endpoint against spam or automated scanning:
1. Go to **Cloudflare Dashboard** → **Security** → **WAF** → **Rate limiting rules**.
2. Create a rule for URI Path `/api/webhook/*`:
   - **Threshold:** Max 10 requests per 1 minute per IP.
   - **Action:** Block.

---

## 3. Step 2: Home Assistant Automation Setup

Add the following automation to your Home Assistant `automations.yaml` to parse incoming single-payload JSON webhooks:

```yaml
- alias: "Receive Friend House Remote Sensor Telemetry"
  trigger:
    - platform: webhook
      webhook_id: "friend_house_sensor_secret_8a9f3b7c2e" # Unique secret string
      allowed_methods:
        - POST
      local_only: false
  action:
    # Update or publish states via template sensors or state events
    - action: persistent_notification.create
      data:
        title: "Remote Sensor Ping"
        message: >
          Received data from {{ trigger.json.device_name }}:
          Temp: {{ trigger.json.temp }} °C,
          Humidity: {{ trigger.json.humidity }} %,
          Battery: {{ trigger.json.battery_percent }} % ({{ trigger.json.battery_voltage }} V)
```

---

## 4. Step 3: ESP32 Node Configuration

Edit `lib/secrets.py` on your ESP32 board:

```python
# lib/secrets.py

# Friend's Wi-Fi credentials
WIFI_SSID = "Friend_WiFi_Name"
WIFI_PASSWORD = "Friend_WiFi_Password"

# HTTPS Webhook Endpoint
HA_WEBHOOK_URL = "https://ha.yourdomain.com/api/webhook/friend_house_sensor_secret_8a9f3b7c2e"

# Physical board name
DEVICE_NAME = "friend_house_sensor"
```

When `HA_WEBHOOK_URL` is set, `esp-automation` automatically defaults to Webhook mode, transmitting all metrics in a single HTTPS payload.
