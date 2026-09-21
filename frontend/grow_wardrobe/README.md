# Grow Wardrobe Web Dashboard

A responsive, real-time control and monitoring dashboard for the **Grow Wardrobe Automation System**, built with React, TypeScript, Tailwind CSS, and Vite.

The dashboard integrates directly with Home Assistant over WebSockets and MQTT to provide live telemetry, intelligent environmental control, automated irrigation management, and photoperiod schedule tracking.

---

## 🌟 Key Features

### 1. 🌡️ Multi-Zone Environmental Monitoring
- **Canopy, Pot, and Ambient Zones**: Live temperature and relative humidity readings from three independent AHT20 sensors.
- **Calculated VPD (Vapor Pressure Deficit)**: Real-time leaf vapor pressure deficit calculation for canopy transpiration management.
- **Intake Differentials**: Live calculation of $\Delta T$ and $\Delta RH$ comparing ambient intake air against canopy air to visualize venting effectiveness.

### 2. 🌀 Intelligent Ventilation & Fan Dynamics
- **Dual Mode Control**: Toggle between `AUTO` and `MANUAL` ventilation modes.
- **AUTO Intelligence**: Real-time display of the MicroPython PI controller's rationale (error signal, proportional/integral contributions, and intake air limits).
- **MANUAL Control**: Interactive fan speed slider (10% to 100%) with instant optimistic UI response and server feedback reconciliation.
- **Safety Interlocks**: Slider is automatically locked with clear visual feedback when running in `AUTO` mode to prevent conflicting manual overrides.

### 3. 💧 Dual-Medium Irrigation Automation
- **Coco Coir Strategy**:
  - High-frequency timed fertigation schedule (e.g. every 4 hours).
  - Configurable drip duration and interval.
  - Automated 4-phase sequence: *Agitate (5m) → Drip Feed → Drain Wait (10m) → Runoff Drain (60s)*.
  - Interactive "Water Now" trigger and "Schedule Next Feed" modal with quick delay presets (+15m, +30m, +1h, +2h) or custom time-of-day scheduling.
- **Organic Soil Strategy**:
  - Demand-driven closed-loop moisture control based on drying curves.
  - Configurable Water Trigger Threshold (%), Target Moisture Level (%), Soak Cooldown (mins), and Safety Max Water Cutoff (secs).
  - Live horizontal range bar showing dry trigger zone, optimal target zone, and current moisture probe position.
  - **Explanatory Tooltips**: Interactive info tooltips (`?`) explaining parameter functions (soak cooldown, safety cutoff, triggers, targets).

### 4. ☀️ 24-Hour Photoperiod Schedule Graphic
- **Visual Day/Night Timeline**: 24-hour timeline bar (00:00 to 24:00) with golden glowing daytime segments and deep slate night cycle.
- **Overnight Wrap-Around Support**: Accurately splits and renders schedules that span midnight (e.g. running lights overnight to combat daytime heat).
- **Live "NOW" Marker**: Real-time pulsating cyan indicator marking the current time of day.
- **Preset Selection**: Instant switching between `18/6` (Vegetative), `12/12` (Flowering), and `24/0` (Continuous).
- **Configurable Start Time**: Interactive time picker (default `06:00`) with automatic calculation of lights-off time.
- **Cycle Countdown**: Live status badge with real-time countdown (e.g. `☀️ Day Active • 2h 15m remaining` or `🌙 Night Cycle • 6h 30m remaining`).

### 5. 🎨 Built-in Theming System
Switch seamlessly between 5 custom crafted themes with instant preview and persistent storage in `localStorage`:
- **Emerald Dark** (Default): Cyberpunk botanical neon green & slate.
- **Forest Dark**: Organic deep moss, earthy sage, and muted forest greens.
- **Cyber Neon**: High-contrast synthwave with vivid cyan, electric violet, and magenta.
- **Deep Slate**: Minimalist monochrome graphite and cool industrial blue.
- **Amber Sunset**: Warm cozy amber, terracotta, and soft golden accents.

---

## 🛠️ Technology Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with semantic theme CSS variables (`data-theme`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Home Assistant Client**: [`home-assistant-js-websocket`](https://github.com/home-assistant/home-assistant-js-websocket)
- **Testing**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/)

---

## 🚀 Development & Deployment

### Prerequisites
Node.js 18+ and npm installed.

### Install Dependencies
```bash
npm install
```

### Local Development Server
Starts the Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```

### Run Unit Tests
Runs the Vitest test suite with jsdom:
```bash
npm test -- --run
```

### Production Build
Type-checks TypeScript and compiles production assets to `dist/`:
```bash
npm run build
```

### Deploy to Home Assistant
Builds the production bundle and securely copies (`scp`) the assets directly to Home Assistant's `www/` directory:
```bash
npm run deploy
```
*Destination on Home Assistant*: `/homeassistant/www/grow_wardrobe/`
*Accessible in Home Assistant via*: `/local/grow_wardrobe/index.html` (or embedded in a Lovelace Webpage / Iframe card).

---

## 📡 MQTT Topic Contract

The dashboard communicates with the ESP32-C3 firmware over Home Assistant's MQTT integration:

| Parameter | State Topic | Command Topic | Payload / Options |
| :--- | :--- | :--- | :--- |
| **Ventilation Mode** | `wardrobe/ventilation/mode/state` | `wardrobe/ventilation/mode/set` | `AUTO`, `MANUAL` |
| **Fan Speed** | `wardrobe/ventilation/fan/state` | `wardrobe/ventilation/fan/set` | `10` – `100` (integer %) |
| **Irrigation Mode** | `wardrobe/irrigation/mode/state` | `wardrobe/irrigation/mode/set` | `AUTO`, `MANUAL` |
| **Irrigation Phase** | `wardrobe/irrigation/state` | `wardrobe/irrigation/trigger` | `IDLE`, `AGITATE`, `WATER`, `DRAIN`, `EMERGENCY_STOP` |
| **Growing Medium** | `wardrobe/config/grow_medium/state` | `wardrobe/config/grow_medium/set` | `coco`, `soil` |
| **Coco Feed Interval** | `wardrobe/config/coco_interval/state` | `wardrobe/config/coco_interval/set` | Hours (`1` – `24`) |
| **Coco Pump Duration** | `wardrobe/config/coco_duration/state` | `wardrobe/config/coco_duration/set` | Seconds (`5` – `120`) |
| **Soil Trigger Moisture** | `wardrobe/config/soil_trigger/state` | `wardrobe/config/soil_trigger/set` | Percentage (`10` – `60`) |
| **Soil Target Moisture** | `wardrobe/config/soil_target/state` | `wardrobe/config/soil_target/set` | Percentage (`20` – `80`) |
| **Soil Soak Cooldown** | `wardrobe/config/soil_soak_wait/state` | `wardrobe/config/soil_soak_wait/set` | Minutes (`10` – `240`) |
| **Safety Max Water** | `wardrobe/config/soil_max_water/state` | `wardrobe/config/soil_max_water/set` | Seconds (`10` – `300`) |
| **Light Preset** | `wardrobe/config/light_preset/state` | `wardrobe/config/light_preset/set` | `18/6`, `12/12`, `24/0` |
| **Light Start Time** | `wardrobe/config/light_start_time/state` | `wardrobe/config/light_start_time/set` | Time string `HH:MM` (e.g. `06:00`) |
| **Next Feed Timestamp** | `wardrobe/irrigation/next_feed/state` | `wardrobe/irrigation/next_feed/set` | Epoch timestamp (seconds) |
