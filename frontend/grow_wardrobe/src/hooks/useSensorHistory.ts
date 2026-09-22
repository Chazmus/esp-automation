import { useState, useEffect, useCallback, useRef } from 'react';
import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { fetchSensorHistory, type HaHistoryResponse } from '../ha';
import type { HistoryDataPoint, SensorSeriesKey, SensorSeriesMeta } from '../types';

export const SENSOR_SERIES: SensorSeriesMeta[] = [
  // Canopy Zone
  {
    key: 'canopyTemp',
    name: 'Canopy Temp',
    zone: 'canopy',
    type: 'temp',
    unit: '°C',
    color: '#f59e0b', // Amber 500
    yAxisId: 'temp',
    strokeWidth: 2.5,
  },
  {
    key: 'canopyHumidity',
    name: 'Canopy RH',
    zone: 'canopy',
    type: 'humidity',
    unit: '%',
    color: '#06b6d4', // Cyan 500
    yAxisId: 'hum',
    strokeWidth: 2.5,
  },
  // Pot & Root Zone
  {
    key: 'potTemp',
    name: 'Pot Temp',
    zone: 'pot',
    type: 'temp',
    unit: '°C',
    color: '#fb923c', // Orange 400
    yAxisId: 'temp',
    strokeDasharray: '4 3',
    strokeWidth: 2,
  },
  {
    key: 'potHumidity',
    name: 'Pot RH',
    zone: 'pot',
    type: 'humidity',
    unit: '%',
    color: '#2dd4bf', // Teal 400
    yAxisId: 'hum',
    strokeDasharray: '4 3',
    strokeWidth: 2,
  },
  {
    key: 'soilMoisture',
    name: 'Soil Moisture',
    zone: 'pot',
    type: 'moisture',
    unit: '%',
    color: '#10b981', // Emerald 500
    yAxisId: 'hum',
    strokeDasharray: '2 2',
    strokeWidth: 2,
  },
  // Ambient / Room Zone
  {
    key: 'ambientTemp',
    name: 'Ambient Temp',
    zone: 'ambient',
    type: 'temp',
    unit: '°C',
    color: '#c084fc', // Purple 400
    yAxisId: 'temp',
    strokeDasharray: '6 3',
    strokeWidth: 2,
  },
  {
    key: 'ambientHumidity',
    name: 'Ambient RH',
    zone: 'ambient',
    type: 'humidity',
    unit: '%',
    color: '#818cf8', // Indigo 400
    yAxisId: 'hum',
    strokeDasharray: '6 3',
    strokeWidth: 2,
  },
];

export function formatTimeLabel(timestamp: number, hours: number): string {
  const d = new Date(timestamp);
  if (hours <= 24) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export function generateMockHistory(
  hours: number,
  baseReadings: Record<SensorSeriesKey, number>
): HistoryDataPoint[] {
  const points: HistoryDataPoint[] = [];
  const numPoints = Math.min(100, Math.max(50, hours * 3));
  const now = Date.now();
  const start = now - hours * 3600 * 1000;
  const step = (now - start) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const t = start + i * step;
    const dayCycle = Math.sin((t / (1000 * 3600 * 24)) * 2 * Math.PI - Math.PI / 2);
    const fastWiggle = Math.sin(i * 0.4) * 0.3;

    const cTemp = +(baseReadings.canopyTemp + dayCycle * 2.2 + fastWiggle).toFixed(1);
    const cHum = +(baseReadings.canopyHumidity - dayCycle * 4.5 + Math.cos(i * 0.3) * 1.2).toFixed(1);

    const svpLeaf = 0.61078 * Math.exp((17.27 * (cTemp - 2.0)) / (cTemp - 2.0 + 237.3));
    const avpAir = 0.61078 * Math.exp((17.27 * cTemp) / (cTemp + 237.3)) * (cHum / 100);
    const cVpd = +Math.max(0, svpLeaf - avpAir).toFixed(2);

    const pTemp = +(baseReadings.potTemp + dayCycle * 1.1 + Math.sin(i * 0.2) * 0.2).toFixed(1);
    const pHum = +(baseReadings.potHumidity - dayCycle * 1.5 + Math.cos(i * 0.2) * 0.8).toFixed(1);

    const dryDown = (1 - (i % 30) / 30) * 8 - 4;
    const sMoist = +Math.max(10, Math.min(80, baseReadings.soilMoisture + dryDown)).toFixed(1);

    const aTemp = +(baseReadings.ambientTemp + dayCycle * 1.8 + Math.sin(i * 0.3) * 0.2).toFixed(1);
    const aHum = +(baseReadings.ambientHumidity - dayCycle * 3.0 + Math.cos(i * 0.25) * 1.0).toFixed(1);

    points.push({
      timestamp: t,
      timeLabel: formatTimeLabel(t, hours),
      canopyTemp: cTemp,
      canopyHumidity: cHum,
      canopyVpd: cVpd,
      potTemp: pTemp,
      potHumidity: pHum,
      soilMoisture: sMoist,
      ambientTemp: aTemp,
      ambientHumidity: aHum,
    });
  }

  return points;
}

export function processHaHistory(
  response: HaHistoryResponse,
  entityMap: Record<SensorSeriesKey, string>,
  hours: number,
  baseReadings: Record<SensorSeriesKey, number>
): HistoryDataPoint[] {
  const now = Date.now();
  const start = now - hours * 3600 * 1000;
  const numPoints = Math.min(100, Math.max(50, hours * 3));
  const step = (now - start) / (numPoints - 1);

  const parsedSeries: Record<SensorSeriesKey, Array<{ t: number; v: number }>> = {
    canopyTemp: [],
    canopyHumidity: [],
    potTemp: [],
    potHumidity: [],
    soilMoisture: [],
    ambientTemp: [],
    ambientHumidity: [],
  };

  let hasAnyRealData = false;

  for (const [key, entId] of Object.entries(entityMap) as [SensorSeriesKey, string][]) {
    const list = response[entId] || [];
    for (const item of list) {
      const rawVal = item.s ?? item.state;
      if (!rawVal || rawVal === 'unavailable' || rawVal === 'unknown') continue;
      const num = parseFloat(rawVal);
      if (isNaN(num)) continue;

      let t = 0;
      if (item.lu) {
        t = item.lu * 1000;
      } else if (item.last_changed) {
        t = new Date(item.last_changed).getTime();
      } else if (item.last_updated) {
        t = new Date(item.last_updated).getTime();
      }
      if (t > 0) {
        parsedSeries[key].push({ t, v: num });
        hasAnyRealData = true;
      }
    }
    parsedSeries[key].sort((a, b) => a.t - b.t);
  }

  if (!hasAnyRealData) {
    return generateMockHistory(hours, baseReadings);
  }

  const points: HistoryDataPoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    const targetT = start + i * step;
    const pt: HistoryDataPoint = {
      timestamp: targetT,
      timeLabel: formatTimeLabel(targetT, hours),
      canopyTemp: null,
      canopyHumidity: null,
      canopyVpd: null,
      potTemp: null,
      potHumidity: null,
      soilMoisture: null,
      ambientTemp: null,
      ambientHumidity: null,
    };

    for (const key of Object.keys(parsedSeries) as SensorSeriesKey[]) {
      const arr = parsedSeries[key];
      if (arr.length === 0) {
        pt[key] = !isNaN(baseReadings[key]) ? baseReadings[key] : null;
        continue;
      }

      let lastVal: number | null = null;
      for (let j = 0; j < arr.length; j++) {
        if (arr[j].t <= targetT) {
          lastVal = arr[j].v;
        } else {
          break;
        }
      }

      if (lastVal === null && arr.length > 0) {
        lastVal = arr[0].v;
      }
      pt[key] = lastVal !== null ? +lastVal.toFixed(1) : null;
    }

    if (pt.canopyTemp !== null && pt.canopyHumidity !== null) {
      const svpLeaf = 0.61078 * Math.exp((17.27 * (pt.canopyTemp - 2.0)) / (pt.canopyTemp - 2.0 + 237.3));
      const avpAir = 0.61078 * Math.exp((17.27 * pt.canopyTemp) / (pt.canopyTemp + 237.3)) * (pt.canopyHumidity / 100);
      pt.canopyVpd = +Math.max(0, svpLeaf - avpAir).toFixed(2);
    }

    points.push(pt);
  }

  return points;
}

export function useSensorHistory(
  connection: Connection | null,
  entities: HassEntities,
  timeRangeHours = 24
) {
  const [data, setData] = useState<HistoryDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Keep references to connection and entities so fetch function doesn't constantly invalidate
  const connectionRef = useRef<Connection | null>(connection);
  connectionRef.current = connection;

  const entitiesRef = useRef<HassEntities>(entities);
  entitiesRef.current = entities;

  // Extract individual sensor values for real-time tail appending
  const getStateNum = (primary: string, fallback: string) => {
    const raw = entities[primary]?.state ?? entities[fallback]?.state;
    if (!raw || raw === 'unavailable' || raw === 'unknown') return NaN;
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? NaN : parsed;
  };

  const canopyTemp = getStateNum('sensor.esp32_growdrobe_canopy_temp', 'sensor.canopy_temp');
  const canopyHumidity = getStateNum('sensor.esp32_growdrobe_canopy_humidity', 'sensor.canopy_humidity');
  const potTemp = getStateNum('sensor.esp32_growdrobe_pot_temp', 'sensor.pot_temp');
  const potHumidity = getStateNum('sensor.esp32_growdrobe_pot_humidity', 'sensor.pot_humidity');
  const soilMoisture = getStateNum('sensor.esp32_growdrobe_moisture', 'sensor.soil_moisture');
  const ambientTemp = getStateNum('sensor.esp32_growdrobe_ambient_temp', 'sensor.ambient_temp');
  const ambientHumidity = getStateNum('sensor.esp32_growdrobe_ambient_humidity', 'sensor.ambient_humidity');

  // Load historical batch from Home Assistant (only on mount, time range change, or explicit user refresh)
  const loadHistory = useCallback(
    async (isSilent = false) => {
      if (!isSilent) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const currentEntities = entitiesRef.current;
        const currentConn = connectionRef.current;

        const resolve = (primary: string, fallback: string) =>
          currentEntities[primary] ? primary : fallback;

        const entityMap: Record<SensorSeriesKey, string> = {
          canopyTemp: resolve('sensor.esp32_growdrobe_canopy_temp', 'sensor.canopy_temp'),
          canopyHumidity: resolve('sensor.esp32_growdrobe_canopy_humidity', 'sensor.canopy_humidity'),
          potTemp: resolve('sensor.esp32_growdrobe_pot_temp', 'sensor.pot_temp'),
          potHumidity: resolve('sensor.esp32_growdrobe_pot_humidity', 'sensor.pot_humidity'),
          soilMoisture: resolve('sensor.esp32_growdrobe_moisture', 'sensor.soil_moisture'),
          ambientTemp: resolve('sensor.esp32_growdrobe_ambient_temp', 'sensor.ambient_temp'),
          ambientHumidity: resolve('sensor.esp32_growdrobe_ambient_humidity', 'sensor.ambient_humidity'),
        };

        const getNum = (id: string, fallback: number) => {
          const v = parseFloat(currentEntities[id]?.state);
          return !isNaN(v) ? v : fallback;
        };

        const baseReadings: Record<SensorSeriesKey, number> = {
          canopyTemp: getNum(entityMap.canopyTemp, 24.5),
          canopyHumidity: getNum(entityMap.canopyHumidity, 58.2),
          potTemp: getNum(entityMap.potTemp, 21.0),
          potHumidity: getNum(entityMap.potHumidity, 65.4),
          soilMoisture: getNum(entityMap.soilMoisture, 38.0),
          ambientTemp: getNum(entityMap.ambientTemp, 19.8),
          ambientHumidity: getNum(entityMap.ambientHumidity, 51.0),
        };

        if (!currentConn) {
          const mock = generateMockHistory(timeRangeHours, baseReadings);
          setData(mock);
          setLastFetched(new Date());
          setIsLoading(false);
          return;
        }

        const startTime = new Date(Date.now() - timeRangeHours * 3600 * 1000);
        const entityIds = Array.from(new Set(Object.values(entityMap)));

        const response = await fetchSensorHistory(currentConn, entityIds, startTime);
        const points = processHaHistory(response, entityMap, timeRangeHours, baseReadings);
        setData(points);
        setLastFetched(new Date());
      } catch (err: any) {
        console.warn('Failed to fetch sensor history from Home Assistant:', err);
        setError(err?.message || 'Failed to load historical data');
      } finally {
        setIsLoading(false);
      }
    },
    [timeRangeHours]
  );

  // Initial load and periodic silent catch-up (every 10 minutes)
  useEffect(() => {
    loadHistory(false);

    const interval = setInterval(() => {
      loadHistory(true);
    }, 600000);

    return () => clearInterval(interval);
  }, [loadHistory]);

  // Option 3: Real-Time Tail Appending
  // As live sensor values arrive over WebSocket, append or update the latest data point without re-querying HA!
  useEffect(() => {
    if (isNaN(canopyTemp) && isNaN(canopyHumidity) && isNaN(potTemp) && isNaN(ambientTemp)) {
      return;
    }

    setData((prevData) => {
      if (!prevData || prevData.length === 0) return prevData;

      const now = Date.now();
      const lastIndex = prevData.length - 1;
      const lastPoint = prevData[lastIndex];

      // Calculate live VPD from current readings
      let liveVpd: number | null = null;
      const cT = !isNaN(canopyTemp) ? canopyTemp : lastPoint.canopyTemp;
      const cH = !isNaN(canopyHumidity) ? canopyHumidity : lastPoint.canopyHumidity;
      if (cT !== null && cH !== null) {
        const svpLeaf = 0.61078 * Math.exp((17.27 * (cT - 2.0)) / (cT - 2.0 + 237.3));
        const avpAir = 0.61078 * Math.exp((17.27 * cT) / (cT + 237.3)) * (cH / 100);
        liveVpd = +Math.max(0, svpLeaf - avpAir).toFixed(2);
      }

      const updatedTail: HistoryDataPoint = {
        timestamp: now,
        timeLabel: formatTimeLabel(now, timeRangeHours),
        canopyTemp: !isNaN(canopyTemp) ? +canopyTemp.toFixed(1) : lastPoint.canopyTemp,
        canopyHumidity: !isNaN(canopyHumidity) ? +canopyHumidity.toFixed(1) : lastPoint.canopyHumidity,
        canopyVpd: liveVpd !== null ? liveVpd : lastPoint.canopyVpd,
        potTemp: !isNaN(potTemp) ? +potTemp.toFixed(1) : lastPoint.potTemp,
        potHumidity: !isNaN(potHumidity) ? +potHumidity.toFixed(1) : lastPoint.potHumidity,
        soilMoisture: !isNaN(soilMoisture) ? +soilMoisture.toFixed(1) : lastPoint.soilMoisture,
        ambientTemp: !isNaN(ambientTemp) ? +ambientTemp.toFixed(1) : lastPoint.ambientTemp,
        ambientHumidity: !isNaN(ambientHumidity) ? +ambientHumidity.toFixed(1) : lastPoint.ambientHumidity,
      };

      // If the last point is very recent (< 25s), update it in place to maintain smooth spacing
      if (now - lastPoint.timestamp < 25000) {
        const next = [...prevData];
        next[lastIndex] = updatedTail;
        return next;
      }

      // If > 25s, append the new point and drop any points that aged out of the active window
      const cutoff = now - timeRangeHours * 3600 * 1000;
      const windowed = prevData.filter((p) => p.timestamp >= cutoff);
      return [...windowed, updatedTail];
    });
  }, [
    canopyTemp,
    canopyHumidity,
    potTemp,
    potHumidity,
    soilMoisture,
    ambientTemp,
    ambientHumidity,
    timeRangeHours,
  ]);

  return {
    data,
    isLoading,
    error,
    lastFetched,
    refetch: () => loadHistory(false),
    seriesMeta: SENSOR_SERIES,
  };
}
