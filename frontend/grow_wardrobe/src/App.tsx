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
  ShieldAlert,
  Activity,
  HelpCircle,
  Sliders,
  Flame,
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

  // Next Cycle Scheduling State
  const [nextFeedTargetTimestamp, setNextFeedTargetTimestamp] = useState<number | null>(null);
  const [irrigationPhase, setIrrigationPhase] = useState<string>('IDLE');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [customFeedTime, setCustomFeedTime] = useState('');

  // Helper to calculate upcoming feedings based on scheduled next cycle
  const getScheduledFeedings = (intervalHours: number, targetTimestamp: number | null, count = 3) => {
    const now = Date.now();
    // Anchor to fixed target timestamp, or default to interval from now
    const baseTime = targetTimestamp !== null ? targetTimestamp : now + intervalHours * 3600 * 1000;
    const feeds: { timeStr: string; relStr: string; isNext: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      const feedTime = new Date(baseTime + i * intervalHours * 3600 * 1000);
      const hours = String(feedTime.getHours()).padStart(2, '0');
      const mins = String(feedTime.getMinutes()).padStart(2, '0');
      const diffMinutes = Math.round((feedTime.getTime() - now) / (60 * 1000));
      let relStr = '';
      if (diffMinutes <= 0) {
        relStr = 'imminent / due now';
      } else if (diffMinutes < 60) {
        relStr = `in ~${diffMinutes} mins`;
      } else {
        const h = (diffMinutes / 60).toFixed(1);
        relStr = `in ~${h} hrs`;
      }
      feeds.push({
        timeStr: `${hours}:${mins}`,
        relStr,
        isNext: i === 0,
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

        // Subscribe to next cycle countdown state from the ESP32
        subscribeMqttTopic(conn, 'wardrobe/irrigation/next_cycle/state', (msg) => {
          const sec = Number(msg.payload);
          if (!isNaN(sec) && sec > 0) {
            const incomingTarget = Date.now() + sec * 1000;
            setNextFeedTargetTimestamp((prev) => {
              if (!prev) return incomingTarget;
              const diff = Math.abs(prev - incomingTarget);
              // Only adjust if incoming target differs by more than 45 seconds to prevent 1s jitter drift
              if (diff > 45000) {
                return incomingTarget;
              }
              return prev;
            });
          }
        }).catch((err) => {
          console.warn('MQTT next_cycle subscription error:', err);
        });

        // Subscribe to irrigation phase
        subscribeMqttTopic(conn, 'wardrobe/irrigation/phase/state', (msg) => {
          setIrrigationPhase(msg.payload.toUpperCase());
        }).catch((err) => {
          console.warn('MQTT phase subscription error:', err);
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

  // Canopy Zone
  const canopyTemp = getState('sensor.esp32_growdrobe_canopy_temp', getState('sensor.canopy_temp'));
  const canopyHumidity = getState('sensor.esp32_growdrobe_canopy_humidity', getState('sensor.canopy_humidity'));
  const canopyVpd = getState('sensor.esp32_growdrobe_canopy_vpd', getState('sensor.canopy_vpd'));

  // Pot & Root Zone
  const potTemp = getState('sensor.esp32_growdrobe_pot_temp', getState('sensor.pot_temp'));
  const potHumidity = getState('sensor.esp32_growdrobe_pot_humidity', getState('sensor.pot_humidity'));
  const potVpd = getState('sensor.esp32_growdrobe_pot_vpd', getState('sensor.pot_vpd'));
  const potMoisture = getState('sensor.esp32_growdrobe_moisture', getState('sensor.soil_moisture'));

  // Physics & VPD calculation helpers
  const calculateSvp = (temp: number) => {
    return 0.61078 * Math.exp((17.27 * temp) / (temp + 237.3));
  };

  const calculateAvp = (temp: number, humidity: number) => {
    return calculateSvp(temp) * (humidity / 100.0);
  };

  const calculateVpd = (temp: number, humidity: number, leafOffset = 0.0) => {
    const leafTemp = temp - leafOffset;
    const svpLeaf = calculateSvp(leafTemp);
    const avpAir = calculateAvp(temp, humidity);
    return Math.max(0.0, svpLeaf - avpAir);
  };

  // Ambient / Intake Zone
  const ambientTemp = getState('sensor.esp32_growdrobe_ambient_temp', getState('sensor.ambient_temp'));
  const ambientHumidity = getState('sensor.esp32_growdrobe_ambient_humidity', getState('sensor.ambient_humidity'));
  let ambientVpd = getState('sensor.esp32_growdrobe_ambient_vpd', getState('sensor.ambient_vpd'));
  if (ambientVpd === '--' && ambientTemp !== '--' && ambientHumidity !== '--') {
    const t = Number(ambientTemp);
    const h = Number(ambientHumidity);
    if (!isNaN(t) && !isNaN(h)) {
      ambientVpd = calculateVpd(t, h, 0.0).toFixed(2);
    }
  }

  // Controls & Actuators
  const fanSpeed = getState('sensor.esp32_growdrobe_fan_speed', getState('number.ventilation_fan_speed'));
  const ventMode = getState('select.ventilation_mode', 'AUTO');
  const irrMode = getState('select.irrigation_mode', 'AUTO');
  const lightState = getState('switch.grow_light') === 'on';
  const dripPumpState = getState('switch.drip_pump') === 'on';
  const agitationPumpState = getState('switch.agitation_pump') === 'on';
  const fanReason = getState('sensor.esp32_growdrobe_ventilation_reason', getState('sensor.ventilation_reason'));

  // Fan Dynamics & Airflow Physics Engine
  const numCanopyT = Number(canopyTemp);
  const numCanopyH = Number(canopyHumidity);
  const numCanopyVpd = Number(canopyVpd);
  const numAmbientT = Number(ambientTemp);
  const numAmbientH = Number(ambientHumidity);
  const numAmbientVpd = Number(ambientVpd);
  const numFanSpeed = Number(fanSpeed) || 0;

  const canopyAvp = !isNaN(numCanopyT) && !isNaN(numCanopyH) ? calculateAvp(numCanopyT, numCanopyH) : null;
  const ambientAvp = !isNaN(numAmbientT) && !isNaN(numAmbientH) ? calculateAvp(numAmbientT, numAmbientH) : null;

  const targetVpd = 1.2;
  const maxSafeTemp = 30.0;
  const minSafeTemp = 16.0;
  const maxSafeHum = 65.0;
  const targetTemp = 28.0;
  const minFanSpeed = 30;

  const vpdTargetDiff = !isNaN(numCanopyVpd) ? targetVpd - numCanopyVpd : null;
  const vpdAmbientDiff = !isNaN(numAmbientVpd) && !isNaN(numCanopyVpd) ? numAmbientVpd - numCanopyVpd : null;
  const tempDiff = !isNaN(numAmbientT) && !isNaN(numCanopyT) ? numAmbientT - numCanopyT : null;
  const avpDiff = ambientAvp !== null && canopyAvp !== null ? ambientAvp - canopyAvp : null;

  let fanDriver: {
    category: 'override' | 'clamp' | 'vpd' | 'temp' | 'manual' | 'optimal';
    title: string;
    badge: string;
    badgeColor: string;
    explanation: string;
    isClampActive: boolean;
  };

  if (ventMode === 'MANUAL') {
    fanDriver = {
      category: 'manual',
      title: 'Manual Override Active',
      badge: 'Manual Control',
      badgeColor: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
      explanation: `The fan is locked at ${numFanSpeed}% by manual user command. Closed-loop VPD regulation and thermal safeguards are bypassed.`,
      isClampActive: false,
    };
  } else if (!isNaN(numCanopyT) && numCanopyT > maxSafeTemp) {
    fanDriver = {
      category: 'override',
      title: 'Thermal Emergency Failsafe',
      badge: 'Failsafe: 100% Emergency',
      badgeColor: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
      explanation: `Canopy temperature (${numCanopyT.toFixed(1)}°C) exceeds safety limit (${maxSafeTemp.toFixed(1)}°C). Fan is forced to 100% maximum speed to prevent thermal stress.`,
      isClampActive: false,
    };
  } else if (!isNaN(numCanopyH) && numCanopyH > maxSafeHum) {
    fanDriver = {
      category: 'override',
      title: 'Bud Rot & Mold Failsafe',
      badge: 'Failsafe: 100% Emergency',
      badgeColor: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
      explanation: `Canopy relative humidity (${numCanopyH.toFixed(1)}%) exceeds safety ceiling (${maxSafeHum.toFixed(1)}%). Fan is forced to 100% to purge moisture and prevent fungal pathogens.`,
      isClampActive: false,
    };
  } else if (!isNaN(numCanopyT) && numCanopyT < minSafeTemp) {
    fanDriver = {
      category: 'override',
      title: 'Low Temperature Protection',
      badge: 'Failsafe: Min Speed',
      badgeColor: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
      explanation: `Canopy temperature (${numCanopyT.toFixed(1)}°C) is below minimum safe threshold (${minSafeTemp.toFixed(1)}°C). Fan is restricted to baseline (${minFanSpeed}%) to prevent chilling the crop.`,
      isClampActive: false,
    };
  } else {
    const isTooHumid = vpdTargetDiff !== null && vpdTargetDiff > 0.05;
    const isAmbientWetter = avpDiff !== null && avpDiff >= 0.0;

    if (isTooHumid && isAmbientWetter) {
      fanDriver = {
        category: 'clamp',
        title: 'Ambient Moisture Clamp Active',
        badge: 'Physics Guard: Clamped',
        badgeColor: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
        explanation: `The tent needs drying (Canopy VPD ${numCanopyVpd.toFixed(2)} kPa < target 1.20 kPa), but outside room air contains MORE water vapor (${ambientAvp?.toFixed(2)} kPa vs ${canopyAvp?.toFixed(2)} kPa). Ramping up the fan would suck in MORE moisture! The controller clamps the fan to baseline (${minFanSpeed}%) unless cooling is required.`,
        isClampActive: true,
      };
    } else if (!isNaN(numCanopyT) && numCanopyT > targetTemp) {
      fanDriver = {
        category: 'temp',
        title: 'Thermal Proportional Regulation',
        badge: 'Thermal Cooling',
        badgeColor: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
        explanation: `Canopy temperature (${numCanopyT.toFixed(1)}°C) exceeds comfort target (${targetTemp.toFixed(1)}°C). Fan speed is proportionally increased to draw in cooler room air (${!isNaN(numAmbientT) ? numAmbientT.toFixed(1) + '°C' : 'ambient'}).`,
        isClampActive: false,
      };
    } else if (isTooHumid) {
      fanDriver = {
        category: 'vpd',
        title: 'VPD Deficit Closed-Loop (PI)',
        badge: 'VPD Transpiration Drive',
        badgeColor: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
        explanation: `Canopy VPD (${numCanopyVpd.toFixed(2)} kPa) is below target (${targetVpd.toFixed(2)} kPa). Intake air is drier (${ambientAvp?.toFixed(2)} kPa vs ${canopyAvp?.toFixed(2)} kPa), so the PI loop is running the fan at ${numFanSpeed}% to exhaust humid boundary air and stimulate transpiration.`,
        isClampActive: false,
      };
    } else {
      fanDriver = {
        category: 'optimal',
        title: 'Optimal VPD Sweet Spot',
        badge: 'In Target Band',
        badgeColor: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
        explanation: `Canopy VPD (${!isNaN(numCanopyVpd) ? numCanopyVpd.toFixed(2) : '--'} kPa) is in the sweet spot (~1.20 kPa). Fan operates at steady baseline circulation (${numFanSpeed}%) with minimal energy consumption.`,
        isClampActive: false,
      };
    }
  }

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

  const handleTriggerFeedNow = async () => {
    if (!connection) return;
    if (irrMode === 'MANUAL') {
      await setEntityState(connection, 'select', 'select_option', 'select.irrigation_mode', {
        option: 'AUTO',
      });
    }
    await sendMqttCommand(connection, 'wardrobe/irrigation/next_cycle/set', '0');
    // Anchor next scheduled feed to current time + interval
    setNextFeedTargetTimestamp(Date.now() + cocoIntervalHours * 3600 * 1000);
  };

  const handleScheduleNextCycle = async (delaySeconds: number) => {
    if (!connection) return;
    if (irrMode === 'MANUAL') {
      await setEntityState(connection, 'select', 'select_option', 'select.irrigation_mode', {
        option: 'AUTO',
      });
    }
    await sendMqttCommand(connection, 'wardrobe/irrigation/next_cycle/set', String(delaySeconds));
    setNextFeedTargetTimestamp(Date.now() + delaySeconds * 1000);
    setShowScheduleModal(false);
  };

  const handleScheduleSpecificTime = async (timeStr: string) => {
    if (!connection || !timeStr) return;
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const delaySeconds = Math.max(0, Math.round((target.getTime() - now.getTime()) / 1000));
    await handleScheduleNextCycle(delaySeconds);
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

        {/* Multi-Zone Climate Overview (All 3 Sensors) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Canopy Zone Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Canopy Zone</div>
                  <div className="text-[11px] text-slate-400">Foliage & Transpiration</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-medium">
                Primary
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>Temp</span>
                  <Thermometer className="w-3 h-3 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {canopyTemp}<span className="text-xs font-normal text-slate-400">°C</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>Humidity</span>
                  <Droplets className="w-3 h-3 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {canopyHumidity}<span className="text-xs font-normal text-slate-400">%</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>VPD</span>
                  <Wind className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {canopyVpd}<span className="text-xs font-normal text-slate-400">kPa</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pot & Root Zone Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-500/10 border border-teal-500/30 rounded-lg text-teal-400">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Pot & Root Zone</div>
                  <div className="text-[11px] text-slate-400">Substrate Microclimate</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950 border border-teal-800 text-teal-300 font-medium">
                Moisture: {potMoisture}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>Temp</span>
                  <Thermometer className="w-3 h-3 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {potTemp}<span className="text-xs font-normal text-slate-400">°C</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>Humidity</span>
                  <Droplets className="w-3 h-3 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {potHumidity}<span className="text-xs font-normal text-slate-400">%</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>VPD</span>
                  <Wind className="w-3 h-3 text-teal-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {potVpd}<span className="text-xs font-normal text-slate-400">kPa</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ambient / Intake Zone Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
                  <Wind className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Ambient / Room</div>
                  <div className="text-[11px] text-slate-400">Intake Air Reference</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 font-medium">
                Reference
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>Temp</span>
                  <Thermometer className="w-3 h-3 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {ambientTemp}<span className="text-xs font-normal text-slate-400">°C</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>Humidity</span>
                  <Droplets className="w-3 h-3 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {ambientHumidity}<span className="text-xs font-normal text-slate-400">%</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
                  <span>VPD</span>
                  <Wind className="w-3 h-3 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-white">
                  {ambientVpd}<span className="text-xs font-normal text-slate-400">kPa</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fan Dynamics & Intelligence Panel */}
        <section className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 md:p-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  Fan Dynamics & Intelligence
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 font-normal">
                    {ventMode === 'AUTO' ? 'PI Closed-Loop' : 'Manual Lock'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Real-time control rationale, VPD differentials & airflow physics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-slate-950/60 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                <Gauge className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-400">Current Speed:</span>
                <span className="text-sm font-bold text-white">{fanSpeed}%</span>
              </div>
            </div>
          </div>

          {/* Fan Speed Visual Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                Modulation Gauge
              </span>
              <span className="font-medium text-slate-300">{fanSpeed}% Active Output</span>
            </div>
            <div className="h-3 w-full bg-slate-950 rounded-full border border-slate-800/80 overflow-hidden relative">
              {/* Baseline marker 30% */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-700 z-10"
                style={{ left: '30%' }}
                title="Min Safe Speed (30%)"
              />
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  fanDriver.category === 'override'
                    ? 'bg-rose-500'
                    : fanDriver.category === 'clamp'
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-indigo-500 via-emerald-500 to-teal-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, numFanSpeed))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0% (Off)</span>
              <span>30% (Baseline Floor)</span>
              <span>100% (Max CFM)</span>
            </div>
          </div>

          {/* Active Driving Factor / Live Rationale Card */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {fanDriver.category === 'override' && <ShieldAlert className="w-4 h-4 text-rose-400" />}
                {fanDriver.category === 'clamp' && <ShieldCheck className="w-4 h-4 text-amber-400" />}
                {fanDriver.category === 'temp' && <Flame className="w-4 h-4 text-orange-400" />}
                {fanDriver.category === 'vpd' && <Wind className="w-4 h-4 text-emerald-400" />}
                {fanDriver.category === 'optimal' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {fanDriver.category === 'manual' && <Sliders className="w-4 h-4 text-amber-400" />}
                <span className="text-sm font-semibold text-white">
                  Why is the fan set to {fanSpeed}%?
                </span>
              </div>
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${fanDriver.badgeColor}`}>
                {fanDriver.badge}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {fanDriver.explanation}
            </p>

            {/* Hardware confirmation if published by ESP32 */}
            {fanReason && fanReason !== '--' && (
              <div className="pt-1 text-[11px] text-slate-400 border-t border-slate-800/60 flex items-center gap-2">
                <span className="text-slate-500 font-mono">Firmware Decision:</span>
                <span className="font-mono text-emerald-300/90">{fanReason}</span>
              </div>
            )}
          </div>

          {/* 3-Card Differential Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: VPD Demand (Canopy vs Target) */}
            <div className="bg-slate-950/40 border border-slate-800/70 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">1. Target VPD Demand</span>
                <Wind className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-lg font-bold text-white">{canopyVpd} kPa</div>
                  <div className="text-[10px] text-slate-500">Canopy Leaf VPD</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-400">Target: {targetVpd.toFixed(2)} kPa</div>
                  <div className="text-[10px] text-slate-500">
                    {vpdTargetDiff !== null
                      ? vpdTargetDiff > 0.05
                        ? `Deficit: +${vpdTargetDiff.toFixed(2)} kPa`
                        : vpdTargetDiff < -0.05
                        ? `Surplus: ${vpdTargetDiff.toFixed(2)} kPa`
                        : 'Balanced In Band'
                      : '--'}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal border-t border-slate-800/60 pt-2">
                Defines <strong className="text-slate-200">ventilation demand</strong>. Lower VPD means stagnant humid air, prompting the PI loop to increase airflow.
              </p>
            </div>

            {/* Card 2: Intake vs Canopy Moisture (Effectiveness & Clamp) */}
            <div className="bg-slate-950/40 border border-slate-800/70 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">2. Intake Moisture Δ</span>
                <Droplets className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-lg font-bold text-white">
                    {canopyAvp !== null ? `${canopyAvp.toFixed(2)} kPa` : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500">Canopy Vapor Press.</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-400">
                    Room: {ambientAvp !== null ? `${ambientAvp.toFixed(2)} kPa` : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {avpDiff !== null
                      ? avpDiff >= 0
                        ? `Intake Wetter (+${avpDiff.toFixed(2)} kPa)`
                        : `Intake Drier (${avpDiff.toFixed(2)} kPa)`
                      : '--'}
                    {vpdAmbientDiff !== null && ` • ΔVPD: ${vpdAmbientDiff >= 0 ? '+' : ''}${vpdAmbientDiff.toFixed(2)}`}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal border-t border-slate-800/60 pt-2">
                Defines <strong className="text-slate-200">drying effectiveness</strong>. If intake air is wetter than the canopy, the moisture clamp prevents fan speed-up.
              </p>
            </div>

            {/* Card 3: Thermal Differential (Cooling Potential) */}
            <div className="bg-slate-950/40 border border-slate-800/70 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">3. Thermal Differential ΔT</span>
                <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-lg font-bold text-white">{canopyTemp}°C</div>
                  <div className="text-[10px] text-slate-500">Canopy Temp</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-400">Room: {ambientTemp}°C</div>
                  <div className="text-[10px] text-slate-500">
                    {tempDiff !== null
                      ? tempDiff < 0
                        ? `${Math.abs(tempDiff).toFixed(1)}°C Cooler Outside`
                        : `${tempDiff.toFixed(1)}°C Warmer Outside`
                      : '--'}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal border-t border-slate-800/60 pt-2">
                Defines <strong className="text-slate-200">cooling capability</strong>. When canopy temp exceeds 28°C, thermal loop ramps speed to draw in cooler room air.
              </p>
            </div>
          </div>

          {/* Educational Callout: "Does the difference in VPD define fan speed?" */}
          <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold">
              <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>Does the difference in VPD define fan speed?</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong className="text-white">Yes, through two distinct VPD differentials:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed pl-1">
              <li>
                <strong className="text-slate-200">Target vs Canopy VPD (Demand):</strong> The PI loop measures <code className="text-emerald-300">Target (1.20 kPa) - Canopy VPD</code>. If canopy VPD is low (high humidity), this difference creates the proportional & integral demand that accelerates the fan.
              </li>
              <li>
                <strong className="text-slate-200">Ambient vs Canopy Vapor Pressure (The Physics Guard):</strong> If the ambient room air is <em className="text-amber-300">wetter</em> than the wardrobe air, drawing in outside air would make humidity worse. The controller clamps the fan to baseline ({minFanSpeed}%) unless thermal cooling is needed.
              </li>
              <li>
                <strong className="text-slate-200">Safety Limits:</strong> Hard overrides immediately force 100% speed if canopy temp &gt; 30°C or relative humidity &gt; 65%.
              </li>
            </ul>
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
                  {/* Schedule Chips & Interactive Timing Controls */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                        Fertigation Schedule (Every {cocoIntervalHours}h)
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTriggerFeedNow}
                          disabled={!connection}
                          className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1 transition shadow-sm"
                          title="Trigger an immediate watering cycle"
                        >
                          ⚡ Water Now
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowScheduleModal(true)}
                          disabled={!connection}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                          title="Configure the time for the next scheduled feeding"
                        >
                          <Clock className="w-3 h-3 text-indigo-400" />
                          Schedule Next Feed
                        </button>
                      </div>
                    </div>

                    {/* Active Cycle Status Banner */}
                    {irrigationPhase !== 'IDLE' && (
                      <div className="p-3 bg-blue-950/40 border border-blue-800/80 rounded-xl flex items-center justify-between text-xs mb-3 animate-pulse">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-blue-400" />
                          <span className="text-white font-medium">
                            Cycle In Progress: <span className="text-blue-300 font-bold">{irrigationPhase}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded-full border border-blue-700">
                          Active Relay Output
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {getScheduledFeedings(cocoIntervalHours, nextFeedTargetTimestamp).map((feed, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl flex flex-col gap-1 relative overflow-hidden border transition ${
                            feed.isNext
                              ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-950/40'
                              : 'bg-slate-900/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${feed.isNext ? 'text-emerald-300 font-semibold' : 'text-slate-400'}`}>
                              {feed.isNext ? 'Next Feed (#1)' : `Feed #${idx + 1}`}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded font-medium">
                              {cocoDurationSec}s drip
                            </span>
                          </div>
                          <div className="text-lg font-bold text-white tracking-tight">
                            {feed.timeStr}
                          </div>
                          <div className={`text-[11px] font-mono ${feed.isNext ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                            {feed.relStr}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Schedule Next Feed Modal */}
                  {showScheduleModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <h3 className="text-base font-semibold text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-400" />
                            Schedule Next Feeding
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowScheduleModal(false)}
                            className="text-slate-400 hover:text-white text-sm"
                          >
                            ✕
                          </button>
                        </div>

                        <p className="text-xs text-slate-400">
                          Set when the next watering cycle will run. All subsequent waterings will automatically follow your every <strong className="text-slate-200">{cocoIntervalHours}-hour</strong> schedule from that time.
                        </p>

                        {/* Quick Presets */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-300 block">
                            Quick Delay Presets
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button
                              type="button"
                              onClick={() => handleScheduleNextCycle(15 * 60)}
                              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition"
                            >
                              In 15m
                            </button>
                            <button
                              type="button"
                              onClick={() => handleScheduleNextCycle(30 * 60)}
                              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition"
                            >
                              In 30m
                            </button>
                            <button
                              type="button"
                              onClick={() => handleScheduleNextCycle(60 * 60)}
                              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition"
                            >
                              In 1h
                            </button>
                            <button
                              type="button"
                              onClick={() => handleScheduleNextCycle(2 * 60 * 60)}
                              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition"
                            >
                              In 2h
                            </button>
                          </div>
                        </div>

                        {/* Custom Time of Day */}
                        <div className="space-y-2 pt-2 border-t border-slate-800/80">
                          <label className="text-xs font-semibold text-slate-300 block">
                            Or Set Specific Time Today / Tomorrow
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="time"
                              value={customFeedTime}
                              onChange={(e) => setCustomFeedTime(e.target.value)}
                              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleScheduleSpecificTime(customFeedTime)}
                              disabled={!customFeedTime}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium text-xs rounded-xl transition"
                            >
                              Apply Time
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            If the time selected is earlier than right now, it will be scheduled for tomorrow.
                          </p>
                        </div>

                        {/* Immediate Action */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              handleTriggerFeedNow();
                              setShowScheduleModal(false);
                            }}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                          >
                            ⚡ Or Start Watering Right Now
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowScheduleModal(false)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

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
