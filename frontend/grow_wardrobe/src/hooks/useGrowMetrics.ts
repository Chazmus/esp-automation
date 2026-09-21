import type { HassEntities } from 'home-assistant-js-websocket';
import type { EnvironmentMetrics, FanDynamicsData, FanDriver } from '../types';

export function useGrowMetrics(entities: HassEntities) {
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

  // Environment metrics bundle
  const environmentMetrics: EnvironmentMetrics = {
    canopy: {
      temp: canopyTemp,
      humidity: canopyHumidity,
      vpd: canopyVpd,
    },
    pot: {
      temp: potTemp,
      humidity: potHumidity,
      vpd: potVpd,
      moisture: potMoisture,
    },
    ambient: {
      temp: ambientTemp,
      humidity: ambientHumidity,
      vpd: ambientVpd,
    },
  };

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

  let fanDriver: FanDriver;

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

  const fanDynamics: FanDynamicsData = {
    fanSpeed,
    numFanSpeed,
    ventMode,
    fanDriver,
    fanReason,
    targetVpd,
    vpdTargetDiff,
    canopyVpd,
    canopyAvp,
    ambientAvp,
    avpDiff,
    vpdAmbientDiff,
    canopyTemp,
    ambientTemp,
    tempDiff,
  };

  return {
    isEspOnline,
    environmentMetrics,
    fanDynamics,
    controls: {
      ventMode,
      irrMode,
      fanSpeed,
      lightState,
      dripPumpState,
      agitationPumpState,
    },
  };
}
