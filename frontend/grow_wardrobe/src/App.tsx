import { useState, useEffect } from 'react';
import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import {
  getHaConnection,
  getStoredHaConfig,
  saveHaConfig,
  sendMqttCommand,
  setEntityState,
  subscribeMqttTopic,
} from './ha';
import {
  Sprout,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  CalendarClock,
  Gauge,
  Timer,
  ShieldCheck,
} from 'lucide-react';

export function App() {
  const [haConfig, setHaConfig] = useState(getStoredHaConfig());
  const [connection, setConnection] = useState<Connection | null>(null);
  const [entities, setEntities] = useState<HassEntities>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Grow Customization State
  const [growMedium, setGrowMedium] = useState<'coco' | 'soil'>('coco');
  const [cocoIntervalHours, setCocoIntervalHours] = useState(4);
  const [cocoDurationSec, setCocoDurationSec] = useState(25);
  const [soilTargetMoisture, setSoilTargetMoisture] = useState(45);
  const [soilTriggerMoisture, setSoilTriggerMoisture] = useState(28);
  const [soilMaxWaterSec, setSoilMaxWaterSec] = useState(60);
  const [soilSoakWaitMin, setSoilSoakWaitMin] = useState(60);
  const [lightPreset, setLightPreset] = useState<'18/6' | '12/12' | '24/0'>('18/6');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Helper to calculate upcoming feedings
  const getUpcomingFeedings = (intervalHours: number, count = 3) => {
    const now = new Date();
    const feeds: { timeStr: string; relStr: string }[] = [];
    for (let i = 1; i <= count; i++) {
      const feedTime = new Date(now.getTime() + i * intervalHours * 60 * 60 * 1000);
      const hours = String(feedTime.getHours()).padStart(2, '0');
      const mins = String(feedTime.getMinutes()).padStart(2, '0');
      const diffHours = i * intervalHours;
      feeds.push({
        timeStr: `${hours}:${mins}`,
        relStr: `in ~${diffHours} hrs`,
      });
    }
    return feeds;
  };

  // Connect to HA
  useEffect(() => {
    setIsConnecting(true);
    setErrorMessage(null);

    getHaConnection(
      (newEntities) => {
        setEntities(newEntities);
        setIsConnecting(false);
      },
      () => {
        setConnection(null);
        setIsConnecting(false);
      }
    )
      .then(({ connection: conn }) => {
        setConnection(conn);
        setIsConnecting(false);
        setShowSettings(false);

        // Subscribe to live config states from the ESP32
        subscribeMqttTopic(conn, 'wardrobe/config/+/state', (msg) => {
          const parts = msg.topic.split('/');
          const param = parts[parts.length - 2];
          const val = msg.payload;

          if (param === 'medium') {
            setGrowMedium(val.toLowerCase() === 'soil' ? 'soil' : 'coco');
          } else if (param === 'coco_interval' || param === 'coco_interval_hours') {
            setCocoIntervalHours(Number(val));
          } else if (param === 'coco_duration' || param === 'coco_duration_secs') {
            setCocoDurationSec(Number(val));
          } else if (param === 'soil_trigger' || param === 'soil_trigger_pct') {
            setSoilTriggerMoisture(Number(val));
          } else if (param === 'soil_target' || param === 'soil_target_pct') {
            setSoilTargetMoisture(Number(val));
          } else if (param === 'soil_max_water' || param === 'soil_max_water_secs') {
            setSoilMaxWaterSec(Number(val));
          } else if (param === 'soil_soak_wait' || param === 'soil_soak_wait_mins') {
            setSoilSoakWaitMin(Number(val));
          } else if (param === 'light_preset') {
            if (val === '18/6' || val === '12/12' || val === '24/0') {
              setLightPreset(val);
            }
          }
        }).catch((err) => {
          console.warn('MQTT config subscription error:', err);
        });
      })
      .catch((err) => {
        setIsConnecting(false);
        if (err?.message === 'AUTH_REQUIRED') {
          // Only prompt if not embedded in HA and no token saved
          setShowSettings(true);
        } else {
          console.error('Failed to connect to Home Assistant:', err);
          setErrorMessage('Failed to connect. Please check your HA URL and Access Token.');
        }
      });
  }, [haConfig.url, haConfig.token]);

  // Helper getters for entities
  const getState = (id: string, fallback = '--') => entities[id]?.state ?? fallback;

  const isEspOnline = getState('binary_sensor.esp32_growdrobe_status') === 'on';
  const canopyTemp = getState('sensor.esp32_growdrobe_canopy_temp', getState('sensor.esp32_growdrobe_ambient_temp'));
  const canopyHumidity = getState('sensor.esp32_growdrobe_canopy_humidity', getState('sensor.esp32_growdrobe_ambient_humidity'));
  const canopyVpd = getState('sensor.esp32_growdrobe_canopy_vpd', getState('sensor.esp32_growdrobe_vpd'));
  const potMoisture = getState('sensor.esp32_growdrobe_moisture');
  const fanSpeed = getState('sensor.esp32_growdrobe_fan_speed', getState('number.ventilation_fan_speed'));
  const ventMode = getState('select.ventilation_mode', 'AUTO');
  const irrMode = getState('select.irrigation_mode', 'AUTO');
  const lightState = getState('switch.grow_light') === 'on';
  const dripPumpState = getState('switch.drip_pump') === 'on';
  const agitationPumpState = getState('switch.agitation_pump') === 'on';

  // Actuator Handlers
  const handleToggleLight = async () => {
    if (!connection) return;
    const service = lightState ? 'turn_off' : 'turn_on';
    await setEntityState(connection, 'switch', service, 'switch.grow_light');
  };

  const handleToggleDripPump = async () => {
    if (!connection) return;
    const service = dripPumpState ? 'turn_off' : 'turn_on';
    await setEntityState(connection, 'switch', service, 'switch.drip_pump');
  };

  const handleToggleAgitationPump = async () => {
    if (!connection) return;
    const service = agitationPumpState ? 'turn_off' : 'turn_on';
    await setEntityState(connection, 'switch', service, 'switch.agitation_pump');
  };

  const handleToggleVentMode = async () => {
    if (!connection) return;
    const nextMode = ventMode === 'AUTO' ? 'MANUAL' : 'AUTO';
    await setEntityState(connection, 'select', 'select_option', 'select.ventilation_mode', {
      option: nextMode,
    });
  };

  const handleToggleIrrMode = async () => {
    if (!connection) return;
    const nextMode = irrMode === 'AUTO' ? 'MANUAL' : 'AUTO';
    await setEntityState(connection, 'select', 'select_option', 'select.irrigation_mode', {
      option: nextMode,
    });
  };

  const handleFanSpeedChange = async (val: number) => {
    if (!connection) return;
    await setEntityState(connection, 'number', 'set_value', 'number.ventilation_fan_speed', {
      value: val,
    });
  };

  const handleSaveGrowConfig = async () => {
    if (!connection) return;
    // Send grow customisation config directly via MQTT
    await sendMqttCommand(connection, 'wardrobe/config/medium/set', growMedium.toUpperCase());
    if (growMedium === 'coco') {
      await sendMqttCommand(connection, 'wardrobe/config/coco_interval/set', String(cocoIntervalHours));
      await sendMqttCommand(connection, 'wardrobe/config/coco_duration/set', String(cocoDurationSec));
    } else {
      await sendMqttCommand(connection, 'wardrobe/config/soil_target/set', String(soilTargetMoisture));
      await sendMqttCommand(connection, 'wardrobe/config/soil_trigger/set', String(soilTriggerMoisture));
      await sendMqttCommand(connection, 'wardrobe/config/soil_max_water/set', String(soilMaxWaterSec));
      await sendMqttCommand(connection, 'wardrobe/config/soil_soak_wait/set', String(soilSoakWaitMin));
    }
    await sendMqttCommand(connection, 'wardrobe/config/light_preset/set', lightPreset);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Sprout className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Grow Wardrobe
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-medium">
                  PoC
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Interactive Environment & Custom Grow Manager
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ESP32 Status */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                isEspOnline
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isEspOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              ESP32: {isEspOnline ? 'Online' : 'Offline'}
            </div>

            {/* HA Connection */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 text-slate-400" />
              )}
              {isConnecting ? 'Connecting...' : connection ? 'HA Connected' : 'Connect HA'}
            </button>
          </div>
        </header>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Metrics Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Canopy Temp</span>
              <Thermometer className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {canopyTemp} <span className="text-base font-normal text-slate-400">°C</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Canopy Humidity</span>
              <Droplets className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {canopyHumidity} <span className="text-base font-normal text-slate-400">%</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Canopy VPD</span>
              <Wind className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {canopyVpd} <span className="text-base font-normal text-slate-400">kPa</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Soil Moisture</span>
              <Sprout className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {potMoisture} <span className="text-base font-normal text-slate-400">%</span>
            </div>
          </div>
        </section>

        {/* Main Content: Grow Customization & Quick Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grow Customization Card (2 cols) */}
          <section className="lg:col-span-2 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Grow Customization</h2>
                <p className="text-xs text-slate-400">
                  Select your medium and configure automated feeding & light routines
                </p>
              </div>
              <span className="text-xs px-3 py-1 bg-purple-950/60 border border-purple-800/80 text-purple-300 rounded-full font-medium">
                Dynamic Strategy
              </span>
            </div>

            {/* Medium Selector */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                1. Growing Medium
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setGrowMedium('coco')}
                  className={`p-4 rounded-xl border text-left transition flex flex-col gap-1 ${
                    growMedium === 'coco'
                      ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/40 text-white'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Coco Coir</span>
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-xs text-slate-400">
                    High-frequency fertigation on a timed schedule with runoff monitoring
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGrowMedium('soil')}
                  className={`p-4 rounded-xl border text-left transition flex flex-col gap-1 ${
                    growMedium === 'soil'
                      ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/40 text-white'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Organic Soil</span>
                    <Droplets className="w-4 h-4 text-teal-400" />
                  </div>
                  <span className="text-xs text-slate-400">
                    Moisture sensor triggered watering cycle based on drying curve
                  </span>
                </button>
              </div>
            </div>

            {/* Dynamic Medium Parameters */}
            {growMedium === 'coco' ? (
              <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                <div className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Coco Fertigation Settings
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Feed Interval (Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={cocoIntervalHours}
                      onChange={(e) => setCocoIntervalHours(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Pump Duration (Seconds)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={cocoDurationSec}
                      onChange={(e) => setCocoDurationSec(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                <div className="text-xs font-medium text-teal-400 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5" />
                  Soil Moisture Trigger & Safety Settings
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Water Trigger Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="60"
                      value={soilTriggerMoisture}
                      onChange={(e) => setSoilTriggerMoisture(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Target Moisture Level (%)
                    </label>
                    <input
                      type="number"
                      min="20"
                      max="80"
                      value={soilTargetMoisture}
                      onChange={(e) => setSoilTargetMoisture(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Soak Cooldown (Minutes)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="240"
                      value={soilSoakWaitMin}
                      onChange={(e) => setSoilSoakWaitMin(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Safety Max Water Cutoff (Seconds)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={soilMaxWaterSec}
                      onChange={(e) => setSoilMaxWaterSec(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Strategy Overview & Schedule Panel */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Active Strategy Overview & Schedule</h3>
                    <p className="text-[11px] text-slate-400">
                      {growMedium === 'coco'
                        ? 'Coco Coir • High-Frequency Timed Fertigation'
                        : 'Organic Soil • Demand-Driven Moisture Loop'}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                    growMedium === 'coco'
                      ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                      : 'bg-teal-950/70 border-teal-800/80 text-teal-300'
                  }`}
                >
                  {growMedium === 'coco' ? 'Timed Cycles' : 'Sensor Driven'}
                </span>
              </div>

              {growMedium === 'coco' ? (
                <div className="space-y-4">
                  {/* Schedule Chips */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                      Estimated Upcoming Feedings (Every {cocoIntervalHours}h)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {getUpcomingFeedings(cocoIntervalHours).map((feed, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-1 relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Feed #{idx + 1}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded font-medium">
                              {cocoDurationSec}s drip
                            </span>
                          </div>
                          <div className="text-lg font-bold text-white tracking-tight">
                            {feed.timeStr}
                          </div>
                          <div className="text-[11px] text-slate-500">{feed.relStr}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fertigation Cycle Sequence */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Automated Cycle Sequence
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-900/50 border border-slate-800/70 rounded-lg">
                        <div className="text-slate-400 text-[11px]">1. Agitate</div>
                        <div className="font-semibold text-white mt-0.5">5 mins</div>
                        <div className="text-[10px] text-slate-500 mt-1">Mix & aerate nutrients</div>
                      </div>
                      <div className="p-2.5 bg-slate-900/50 border border-slate-800/70 rounded-lg">
                        <div className="text-slate-400 text-[11px]">2. Drip Feed</div>
                        <div className="font-semibold text-emerald-400 mt-0.5">{cocoDurationSec} secs</div>
                        <div className="text-[10px] text-slate-500 mt-1">Saturate root zone</div>
                      </div>
                      <div className="p-2.5 bg-slate-900/50 border border-slate-800/70 rounded-lg">
                        <div className="text-slate-400 text-[11px]">3. Drain Wait</div>
                        <div className="font-semibold text-white mt-0.5">10 mins</div>
                        <div className="text-[10px] text-slate-500 mt-1">Collect runoff</div>
                      </div>
                      <div className="p-2.5 bg-slate-900/50 border border-slate-800/70 rounded-lg">
                        <div className="text-slate-400 text-[11px]">4. Runoff Drain</div>
                        <div className="font-semibold text-blue-400 mt-0.5">60 secs</div>
                        <div className="text-[10px] text-slate-500 mt-1">Pump out waste</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Moisture Dynamics Visual */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-teal-400" />
                        Soil Moisture Dynamics
                      </span>
                      <span className="text-slate-300 font-medium">
                        Current: <strong className="text-white">{potMoisture}%</strong>
                      </span>
                    </div>

                    {/* Horizontal Range Visualization */}
                    <div className="relative h-6 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                      {/* Trigger zone (dry) */}
                      <div
                        className="absolute top-0 bottom-0 left-0 bg-rose-500/20 border-r border-rose-500/40 flex items-center justify-center text-[10px] text-rose-300 font-medium"
                        style={{ width: `${Math.min(100, Math.max(0, soilTriggerMoisture))}%` }}
                      >
                        Trigger: {soilTriggerMoisture}%
                      </div>
                      {/* Target zone */}
                      <div
                        className="absolute top-0 bottom-0 bg-emerald-500/20 border-r border-emerald-500/40 flex items-center justify-center text-[10px] text-emerald-300 font-medium"
                        style={{
                          left: `${Math.min(100, Math.max(0, soilTriggerMoisture))}%`,
                          width: `${Math.min(100 - Math.min(100, Math.max(0, soilTriggerMoisture)), Math.max(0, soilTargetMoisture - soilTriggerMoisture))}%`,
                        }}
                      >
                        Target: {soilTargetMoisture}%
                      </div>
                      {/* Current marker */}
                      {potMoisture !== '--' && !isNaN(Number(potMoisture)) && (
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg shadow-white z-10"
                          style={{
                            left: `${Math.min(100, Math.max(0, Number(potMoisture)))}%`,
                          }}
                        />
                      )}
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>0% (Bone Dry)</span>
                      <span>Trigger: {soilTriggerMoisture}%</span>
                      <span>Target: {soilTargetMoisture}%</span>
                      <span>100% (Saturated)</span>
                    </div>
                  </div>

                  {/* Safety & Cooldown Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-900/70 border border-slate-800/80 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                        <Timer className="w-3.5 h-3.5 text-amber-400" />
                        Soak Cooldown
                      </div>
                      <div className="text-base font-bold text-white">{soilSoakWaitMin} mins</div>
                      <div className="text-[11px] text-slate-500">
                        Enforced delay after watering to let water disperse through root zone
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900/70 border border-slate-800/80 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Safety Runoff Cutoff
                      </div>
                      <div className="text-base font-bold text-white">{soilMaxWaterSec} secs</div>
                      <div className="text-[11px] text-slate-500">
                        Hardware safety cutoff prevents flooding if sensor is disconnected
                      </div>
                    </div>
                  </div>

                  {/* Current Status Badge */}
                  <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Current Irrigation Decision</span>
                    {potMoisture !== '--' && Number(potMoisture) <= soilTriggerMoisture ? (
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        💧 Below Trigger ({potMoisture}% ≤ {soilTriggerMoisture}%) — Watering Eligible
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        🌱 Moisture Optimal ({potMoisture}% &gt; {soilTriggerMoisture}%) — Idling
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Lighting Schedule Preset */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                2. Photoperiod (Light Schedule)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['18/6', '12/12', '24/0'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLightPreset(preset)}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition ${
                      lightPreset === preset
                        ? 'bg-amber-500/10 border-amber-500/60 text-amber-300'
                        : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {preset} {preset === '18/6' ? '(Veg)' : preset === '12/12' ? '(Flower)' : '(Auto)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleSaveGrowConfig}
                disabled={!connection}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950"
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply Strategy to Wardrobe
              </button>

              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                  ✓ Commands dispatched to MQTT broker!
                </span>
              )}
            </div>
          </section>

          {/* Quick Actuator Overrides (1 col) */}
          <section className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-semibold text-white">Manual Overrides</h2>
              <p className="text-xs text-slate-400">Direct hardware relays & loops</p>
            </div>

            {/* Mode Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                <div>
                  <div className="text-sm font-medium text-white">Ventilation</div>
                  <div className="text-xs text-slate-400">PI VPD Loop Control</div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleVentMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    ventMode === 'AUTO'
                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                      : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  }`}
                >
                  {ventMode}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
                <div>
                  <div className="text-sm font-medium text-white">Irrigation</div>
                  <div className="text-xs text-slate-400">State Machine</div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleIrrMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    irrMode === 'AUTO'
                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                      : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  }`}
                >
                  {irrMode}
                </button>
              </div>
            </div>

            {/* Fan Speed Slider */}
            <div className="space-y-2 p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Fan Speed Override</span>
                <span className="text-white font-medium">{fanSpeed}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Number(fanSpeed) || 0}
                onChange={(e) => handleFanSpeedChange(Number(e.target.value))}
                disabled={ventMode === 'AUTO'}
                className="w-full accent-emerald-500 disabled:opacity-40 cursor-pointer"
              />
              {ventMode === 'AUTO' && (
                <div className="text-[11px] text-slate-500">
                  Switch ventilation to MANUAL to adjust speed
                </div>
              )}
            </div>

            {/* Relays */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleToggleLight}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition ${
                  lightState
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800/30 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sun className="w-4 h-4" />
                  <span>Grow Light</span>
                </div>
                <span>{lightState ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleDripPump}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition ${
                  dripPumpState
                    ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800/30 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Droplets className="w-4 h-4" />
                  <span>Drip Feed Pump</span>
                </div>
                <span>{dripPumpState ? 'RUNNING' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleAgitationPump}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition ${
                  agitationPumpState
                    ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800/30 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4" />
                  <span>Agitation Pump</span>
                </div>
                <span>{agitationPumpState ? 'RUNNING' : 'OFF'}</span>
              </button>
            </div>
          </section>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  Home Assistant Connection
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">HA Base URL</label>
                  <input
                    type="text"
                    value={haConfig.url}
                    onChange={(e) =>
                      setHaConfig((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="http://homeassistant.local:8123"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    Long-Lived Access Token
                  </label>
                  <input
                    type="password"
                    value={haConfig.token}
                    onChange={(e) =>
                      setHaConfig((prev) => ({ ...prev, token: e.target.value }))
                    }
                    placeholder="Paste HA Token here..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="mt-1 text-slate-500">
                    Generate in HA: Click your Profile (bottom-left) → Security → Long-Lived Access Tokens → Create Token.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    saveHaConfig(haConfig.url, haConfig.token);
                    setShowSettings(false);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition"
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
