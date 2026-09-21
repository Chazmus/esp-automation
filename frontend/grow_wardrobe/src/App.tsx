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
import type { GrowMedium, LightPreset } from './types';
import { useGrowMetrics } from './hooks/useGrowMetrics';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Header';
import { EnvironmentOverview } from './components/EnvironmentOverview';
import { FanDynamicsPanel } from './components/FanDynamicsPanel';
import { GrowCustomization } from './components/GrowCustomization';
import { QuickControls } from './components/QuickControls';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const { theme, setTheme } = useTheme();
  const [haConfig, setHaConfig] = useState(getStoredHaConfig());
  const [connection, setConnection] = useState<Connection | null>(null);
  const [entities, setEntities] = useState<HassEntities>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Grow Customization State
  const [growMedium, setGrowMedium] = useState<GrowMedium>('coco');
  const [cocoIntervalHours, setCocoIntervalHours] = useState(4);
  const [cocoDurationSec, setCocoDurationSec] = useState(25);
  const [soilTargetMoisture, setSoilTargetMoisture] = useState(45);
  const [soilTriggerMoisture, setSoilTriggerMoisture] = useState(28);
  const [soilMaxWaterSec, setSoilMaxWaterSec] = useState(60);
  const [soilSoakWaitMin, setSoilSoakWaitMin] = useState(60);
  const [lightPreset, setLightPreset] = useState<LightPreset>('18/6');
  const [lightStartTime, setLightStartTime] = useState('06:00');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Next Cycle Scheduling State
  const [nextFeedTargetTimestamp, setNextFeedTargetTimestamp] = useState<number | null>(null);
  const [irrigationPhase, setIrrigationPhase] = useState<string>('IDLE');

  // Metrics, Physics & Actuator states from custom hook
  const { isEspOnline, environmentMetrics, fanDynamics, controls } = useGrowMetrics(entities);

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
          } else if (param === 'light_start_time') {
            if (typeof val === 'string' && val.includes(':')) {
              setLightStartTime(val);
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
          setShowSettings(true);
        } else {
          console.error('Failed to connect to Home Assistant:', err);
          setErrorMessage('Failed to connect. Please check your HA URL and Access Token.');
        }
      });
  }, [haConfig.url, haConfig.token]);

  // Actuator Handlers
  const handleToggleWastePump = async () => {
    if (!connection) return;
    const service = controls.wastePumpState ? 'turn_off' : 'turn_on';
    await setEntityState(connection, 'switch', service, 'switch.waste_pump');
  };

  const handleToggleDripPump = async () => {
    if (!connection) return;
    const service = controls.dripPumpState ? 'turn_off' : 'turn_on';
    await setEntityState(connection, 'switch', service, 'switch.drip_pump');
  };

  const handleToggleAgitationPump = async () => {
    if (!connection) return;
    const service = controls.agitationPumpState ? 'turn_off' : 'turn_on';
    await setEntityState(connection, 'switch', service, 'switch.agitation_pump');
  };

  const handleToggleVentMode = async () => {
    if (!connection) return;
    const nextMode = controls.ventMode === 'AUTO' ? 'MANUAL' : 'AUTO';
    await setEntityState(connection, 'select', 'select_option', 'select.ventilation_mode', {
      option: nextMode,
    });
  };

  const handleToggleIrrMode = async () => {
    if (!connection) return;
    const nextMode = controls.irrMode === 'AUTO' ? 'MANUAL' : 'AUTO';
    await setEntityState(connection, 'select', 'select_option', 'select.irrigation_mode', {
      option: nextMode,
    });
  };

  const handleTriggerFeedNow = async () => {
    if (!connection) return;
    if (controls.irrMode === 'MANUAL') {
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
    if (controls.irrMode === 'MANUAL') {
      await setEntityState(connection, 'select', 'select_option', 'select.irrigation_mode', {
        option: 'AUTO',
      });
    }
    await sendMqttCommand(connection, 'wardrobe/irrigation/next_cycle/set', String(delaySeconds));
    setNextFeedTargetTimestamp(Date.now() + delaySeconds * 1000);
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
    await sendMqttCommand(connection, 'wardrobe/config/light_start_time/set', lightStartTime);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-theme-base text-theme-text p-4 md:p-8 font-sans transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Header
          isEspOnline={isEspOnline}
          isConnecting={isConnecting}
          isConnected={Boolean(connection)}
          errorMessage={errorMessage}
          currentTheme={theme}
          onSelectTheme={setTheme}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Multi-Zone Climate Overview */}
        <EnvironmentOverview metrics={environmentMetrics} />

        {/* Fan Dynamics & Intelligence Panel */}
        <FanDynamicsPanel dynamics={fanDynamics} />

        {/* Main Content: Grow Customization & Quick Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GrowCustomization
            growMedium={growMedium}
            setGrowMedium={setGrowMedium}
            cocoIntervalHours={cocoIntervalHours}
            setCocoIntervalHours={setCocoIntervalHours}
            cocoDurationSec={cocoDurationSec}
            setCocoDurationSec={setCocoDurationSec}
            soilTriggerMoisture={soilTriggerMoisture}
            setSoilTriggerMoisture={setSoilTriggerMoisture}
            soilTargetMoisture={soilTargetMoisture}
            setSoilTargetMoisture={setSoilTargetMoisture}
            soilSoakWaitMin={soilSoakWaitMin}
            setSoilSoakWaitMin={setSoilSoakWaitMin}
            soilMaxWaterSec={soilMaxWaterSec}
            setSoilMaxWaterSec={setSoilMaxWaterSec}
            lightPreset={lightPreset}
            setLightPreset={setLightPreset}
            lightStartTime={lightStartTime}
            setLightStartTime={setLightStartTime}
            potMoisture={environmentMetrics.pot.moisture ?? '--'}
            irrigationPhase={irrigationPhase}
            nextFeedTargetTimestamp={nextFeedTargetTimestamp}
            isConnected={Boolean(connection)}
            saveSuccess={saveSuccess}
            onTriggerFeedNow={handleTriggerFeedNow}
            onScheduleNextCycle={handleScheduleNextCycle}
            onScheduleSpecificTime={handleScheduleSpecificTime}
            onSaveGrowConfig={handleSaveGrowConfig}
          />

          <QuickControls
            ventMode={controls.ventMode}
            irrMode={controls.irrMode}
            fanSpeed={controls.fanSpeed}
            dripPumpState={controls.dripPumpState}
            agitationPumpState={controls.agitationPumpState}
            wastePumpState={controls.wastePumpState}
            onToggleVentMode={handleToggleVentMode}
            onToggleIrrMode={handleToggleIrrMode}
            onFanSpeedChange={handleFanSpeedChange}
            onToggleDripPump={handleToggleDripPump}
            onToggleAgitationPump={handleToggleAgitationPump}
            onToggleWastePump={handleToggleWastePump}
          />
        </div>

        {/* Settings Modal */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          haConfig={haConfig}
          setHaConfig={setHaConfig}
          onSave={(url, token) => saveHaConfig(url, token)}
        />
      </div>
    </div>
  );
}

export default App;
