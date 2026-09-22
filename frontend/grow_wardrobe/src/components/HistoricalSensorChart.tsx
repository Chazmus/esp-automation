import { useState, useMemo } from 'react';
import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Activity,
  Calendar,
  Layers,
  Sprout,
  Droplets,
  Wind,
  RefreshCw,
  Eye,
  EyeOff,
  Thermometer,
} from 'lucide-react';
import {
  useSensorHistory,
  SENSOR_SERIES,
} from '../hooks/useSensorHistory';
import type { HistoryZoneFilter, SensorSeriesKey, SensorSeriesMeta } from '../types';

interface HistoricalSensorChartProps {
  connection: Connection | null;
  entities: HassEntities;
}

const TIME_RANGES = [
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '7d', hours: 168 },
];

export function HistoricalSensorChart({ connection, entities }: HistoricalSensorChartProps) {
  const [selectedHours, setSelectedHours] = useState<number>(24);
  const [activeZone, setActiveZone] = useState<HistoryZoneFilter>('all');

  // Series visibility state
  const [visibleSeries, setVisibleSeries] = useState<Record<SensorSeriesKey, boolean>>({
    canopyTemp: true,
    canopyHumidity: true,
    potTemp: true,
    potHumidity: true,
    soilMoisture: true,
    ambientTemp: true,
    ambientHumidity: true,
  });

  const { data, isLoading, refetch, lastFetched } = useSensorHistory(
    connection,
    entities,
    selectedHours
  );

  // Group series by category for the two charts
  const tempSeriesList = useMemo(
    () => SENSOR_SERIES.filter((s) => s.type === 'temp'),
    []
  );
  const humiditySeriesList = useMemo(
    () => SENSOR_SERIES.filter((s) => s.type === 'humidity' || s.type === 'moisture'),
    []
  );

  // Handle Zone Filter selection
  const handleSelectZone = (zone: HistoryZoneFilter) => {
    setActiveZone(zone);
    if (zone === 'all') {
      setVisibleSeries({
        canopyTemp: true,
        canopyHumidity: true,
        potTemp: true,
        potHumidity: true,
        soilMoisture: true,
        ambientTemp: true,
        ambientHumidity: true,
      });
    } else if (zone === 'canopy') {
      setVisibleSeries({
        canopyTemp: true,
        canopyHumidity: true,
        potTemp: false,
        potHumidity: false,
        soilMoisture: false,
        ambientTemp: false,
        ambientHumidity: false,
      });
    } else if (zone === 'pot') {
      setVisibleSeries({
        canopyTemp: false,
        canopyHumidity: false,
        potTemp: true,
        potHumidity: true,
        soilMoisture: true,
        ambientTemp: false,
        ambientHumidity: false,
      });
    } else if (zone === 'ambient') {
      setVisibleSeries({
        canopyTemp: false,
        canopyHumidity: false,
        potTemp: false,
        potHumidity: false,
        soilMoisture: false,
        ambientTemp: true,
        ambientHumidity: true,
      });
    }
  };

  // Toggle individual series
  const toggleSeries = (key: SensorSeriesKey) => {
    setVisibleSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const allActive = Object.values(next).every(Boolean);
      if (allActive) {
        setActiveZone('all');
      } else {
        const canopyOnly =
          next.canopyTemp &&
          next.canopyHumidity &&
          !next.potTemp &&
          !next.potHumidity &&
          !next.soilMoisture &&
          !next.ambientTemp &&
          !next.ambientHumidity;
        const potOnly =
          !next.canopyTemp &&
          !next.canopyHumidity &&
          next.potTemp &&
          next.potHumidity &&
          next.soilMoisture &&
          !next.ambientTemp &&
          !next.ambientHumidity;
        const ambientOnly =
          !next.canopyTemp &&
          !next.canopyHumidity &&
          !next.potTemp &&
          !next.potHumidity &&
          !next.soilMoisture &&
          next.ambientTemp &&
          next.ambientHumidity;

        if (canopyOnly) setActiveZone('canopy');
        else if (potOnly) setActiveZone('pot');
        else if (ambientOnly) setActiveZone('ambient');
        else setActiveZone('all');
      }
      return next;
    });
  };

  const latestPoint = data.length > 0 ? data[data.length - 1] : null;

  // Compute summary stats
  const stats = useMemo(() => {
    if (!data.length) return null;

    let minT = Infinity;
    let maxT = -Infinity;
    let sumT = 0;
    let countT = 0;

    let minH = Infinity;
    let maxH = -Infinity;
    let sumH = 0;
    let countH = 0;

    data.forEach((p) => {
      if (p.canopyTemp !== null) {
        minT = Math.min(minT, p.canopyTemp);
        maxT = Math.max(maxT, p.canopyTemp);
        sumT += p.canopyTemp;
        countT++;
      }
      if (p.canopyHumidity !== null) {
        minH = Math.min(minH, p.canopyHumidity);
        maxH = Math.max(maxH, p.canopyHumidity);
        sumH += p.canopyHumidity;
        countH++;
      }
    });

    return {
      canopyTempMin: countT > 0 ? minT.toFixed(1) : '--',
      canopyTempMax: countT > 0 ? maxT.toFixed(1) : '--',
      canopyTempAvg: countT > 0 ? (sumT / countT).toFixed(1) : '--',
      canopyHumMin: countH > 0 ? minH.toFixed(1) : '--',
      canopyHumMax: countH > 0 ? maxH.toFixed(1) : '--',
      canopyHumAvg: countH > 0 ? (sumH / countH).toFixed(1) : '--',
    };
  }, [data]);

  return (
    <section className="bg-theme-card border border-theme-border rounded-2xl p-5 space-y-6 transition-colors">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border-subtle pb-4">
        {/* Title & Description */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-theme-text tracking-wide">
                Historical Telemetry
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-theme-surface border border-theme-border-subtle text-theme-text-muted font-medium">
                Synchronized
              </span>
            </div>
            <p className="text-xs text-theme-text-muted">
              Dedicated temperature and humidity/moisture timelines with synchronized scrubbing
            </p>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zone Selector */}
          <div className="inline-flex p-1 bg-theme-surface border border-theme-border-subtle rounded-xl text-xs">
            <button
              onClick={() => handleSelectZone('all')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeZone === 'all'
                  ? 'bg-theme-elevated text-theme-text shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text'
              }`}
              title="Show all sensor lines across both graphs"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>All Zones</span>
            </button>
            <button
              onClick={() => handleSelectZone('canopy')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeZone === 'canopy'
                  ? 'bg-theme-elevated text-theme-text shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text'
              }`}
              title="Filter to Canopy Zone"
            >
              <Sprout className="w-3.5 h-3.5 text-amber-400" />
              <span>Canopy</span>
            </button>
            <button
              onClick={() => handleSelectZone('pot')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeZone === 'pot'
                  ? 'bg-theme-elevated text-theme-text shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text'
              }`}
              title="Filter to Pot & Substrate"
            >
              <Droplets className="w-3.5 h-3.5 text-teal-400" />
              <span>Pot & Soil</span>
            </button>
            <button
              onClick={() => handleSelectZone('ambient')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeZone === 'ambient'
                  ? 'bg-theme-elevated text-theme-text shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text'
              }`}
              title="Filter to Ambient / Room"
            >
              <Wind className="w-3.5 h-3.5 text-purple-400" />
              <span>Ambient</span>
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="inline-flex p-1 bg-theme-surface border border-theme-border-subtle rounded-xl text-xs">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.hours}
                onClick={() => setSelectedHours(tr.hours)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedHours === tr.hours
                    ? 'bg-theme-elevated text-theme-text shadow-sm'
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-1.5 bg-theme-surface hover:bg-theme-elevated border border-theme-border-subtle rounded-xl text-theme-text-muted hover:text-theme-text transition-colors disabled:opacity-50"
            title="Refresh history from Home Assistant"
            aria-label="Refresh telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart 1: Temperature Trends (°C) */}
      <div className="bg-theme-surface/60 border border-theme-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border-subtle pb-2.5">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-theme-text">
              Temperature Dynamics (°C)
            </h3>
            {stats && (
              <span className="text-[11px] text-theme-text-muted ml-2">
                Canopy: {stats.canopyTempMin}°C – {stats.canopyTempMax}°C (avg {stats.canopyTempAvg}°C)
              </span>
            )}
          </div>

          {/* Temperature Series Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            {tempSeriesList.map((s) => (
              <SeriesToggleChip
                key={s.key}
                series={s}
                isVisible={visibleSeries[s.key]}
                latestValue={latestPoint ? latestPoint[s.key] : null}
                onToggle={() => toggleSeries(s.key)}
              />
            ))}
          </div>
        </div>

        <div className="relative w-full h-[240px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} initialDimension={{ width: 800, height: 240 }}>
            <ComposedChart
              syncId="grow_wardrobe_telemetry"
              data={data}
              margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-theme-border-subtle"
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="timeLabel"
                tick={{ fill: 'currentColor', fontSize: 10 }}
                className="text-theme-text-muted"
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                minTickGap={35}
              />
              <YAxis
                domain={['auto', 'auto']}
                unit="°C"
                tick={{ fill: '#f59e0b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#f59e0b', strokeOpacity: 0.3 }}
                width={40}
              />
              <Tooltip
                content={<TemperatureTooltip />}
                cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              {tempSeriesList.map((s) => {
                if (!visibleSeries[s.key]) return null;
                return (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={s.strokeWidth ?? 2}
                    strokeDasharray={s.strokeDasharray}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: s.color,
                      stroke: 'var(--color-theme-base)',
                      strokeWidth: 2,
                    }}
                    connectNulls={true}
                    isAnimationActive={false}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Humidity & Soil Moisture Trends (%) */}
      <div className="bg-theme-surface/60 border border-theme-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border-subtle pb-2.5">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-theme-text">
              Humidity & Moisture Dynamics (%)
            </h3>
            {stats && (
              <span className="text-[11px] text-theme-text-muted ml-2">
                Canopy RH: {stats.canopyHumMin}% – {stats.canopyHumMax}% (avg {stats.canopyHumAvg}%)
              </span>
            )}
          </div>

          {/* Humidity Series Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            {humiditySeriesList.map((s) => (
              <SeriesToggleChip
                key={s.key}
                series={s}
                isVisible={visibleSeries[s.key]}
                latestValue={latestPoint ? latestPoint[s.key] : null}
                onToggle={() => toggleSeries(s.key)}
              />
            ))}
          </div>
        </div>

        <div className="relative w-full h-[240px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} initialDimension={{ width: 800, height: 240 }}>
            <ComposedChart
              syncId="grow_wardrobe_telemetry"
              data={data}
              margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-theme-border-subtle"
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="timeLabel"
                tick={{ fill: 'currentColor', fontSize: 10 }}
                className="text-theme-text-muted"
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                minTickGap={35}
              />
              <YAxis
                domain={['auto', 'auto']}
                unit="%"
                tick={{ fill: '#06b6d4', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#06b6d4', strokeOpacity: 0.3 }}
                width={40}
              />
              <Tooltip
                content={<HumidityTooltip />}
                cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              {humiditySeriesList.map((s) => {
                if (!visibleSeries[s.key]) return null;
                return (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={s.strokeWidth ?? 2}
                    strokeDasharray={s.strokeDasharray}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: s.color,
                      stroke: 'var(--color-theme-base)',
                      strokeWidth: 2,
                    }}
                    connectNulls={true}
                    isAnimationActive={false}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Stats Strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-theme-border-subtle text-xs">
          <div className="bg-theme-surface/70 p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted">Canopy Temp Band</div>
            <div className="font-semibold text-theme-text mt-0.5">
              {stats.canopyTempMin}°C <span className="text-theme-text-dim">–</span> {stats.canopyTempMax}°C
            </div>
            <div className="text-[10px] text-theme-text-dim">Avg: {stats.canopyTempAvg}°C</div>
          </div>

          <div className="bg-theme-surface/70 p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted">Canopy RH Band</div>
            <div className="font-semibold text-theme-text mt-0.5">
              {stats.canopyHumMin}% <span className="text-theme-text-dim">–</span> {stats.canopyHumMax}%
            </div>
            <div className="text-[10px] text-theme-text-dim">Avg: {stats.canopyHumAvg}%</div>
          </div>

          <div className="bg-theme-surface/70 p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted">Live VPD Snapshot</div>
            <div className="font-semibold text-emerald-400 mt-0.5">
              {latestPoint?.canopyVpd !== null && latestPoint?.canopyVpd !== undefined
                ? `${latestPoint.canopyVpd} kPa`
                : '--'}
            </div>
            <div className="text-[10px] text-theme-text-dim">Target: 1.20 kPa</div>
          </div>

          <div className="bg-theme-surface/70 p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted">Dataset Status</div>
            <div className="font-semibold text-theme-text mt-0.5">
              {data.length} synchronized points
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {lastFetched ? `Synced ${lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live Stream'}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Reusable Series Toggle Chip
function SeriesToggleChip({
  series,
  isVisible,
  latestValue,
  onToggle,
}: {
  series: SensorSeriesMeta;
  isVisible: boolean;
  latestValue: number | null;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium border transition-all ${
        isVisible
          ? 'bg-theme-surface border-theme-border-elevated text-theme-text shadow-xs'
          : 'bg-theme-surface/40 border-theme-border-subtle text-theme-text-muted/60 opacity-60 hover:opacity-100'
      }`}
    >
      <span
        className="w-2 h-2 rounded-full inline-block shrink-0 shadow-sm"
        style={{
          backgroundColor: series.color,
          boxShadow: isVisible ? `0 0 6px ${series.color}60` : 'none',
        }}
      />
      <span>{series.name}</span>
      {latestValue !== null && (
        <span className="text-[10px] text-theme-text-muted font-normal">
          {latestValue}
          {series.unit}
        </span>
      )}
      {isVisible ? (
        <Eye className="w-2.5 h-2.5 text-theme-text-muted ml-0.5" />
      ) : (
        <EyeOff className="w-2.5 h-2.5 text-theme-text-dim ml-0.5" />
      )}
    </button>
  );
}

// Tooltip for Temperature Chart
function TemperatureTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-theme-surface/95 backdrop-blur-md border border-theme-border-elevated rounded-xl p-2.5 shadow-2xl text-xs space-y-1.5 min-w-[170px]">
      <div className="flex items-center justify-between border-b border-theme-border-subtle pb-1">
        <span className="font-semibold text-theme-text flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-theme-text-muted" />
          {label}
        </span>
        <span className="text-[10px] text-amber-400 font-semibold uppercase">Temp</span>
      </div>

      <div className="space-y-1 pt-0.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-theme-text-muted">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-bold text-theme-text">
              {item.value !== null ? `${item.value}°C` : '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tooltip for Humidity & Moisture Chart
function HumidityTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const point = payload[0]?.payload;

  return (
    <div className="bg-theme-surface/95 backdrop-blur-md border border-theme-border-elevated rounded-xl p-2.5 shadow-2xl text-xs space-y-1.5 min-w-[180px]">
      <div className="flex items-center justify-between border-b border-theme-border-subtle pb-1">
        <span className="font-semibold text-theme-text flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-theme-text-muted" />
          {label}
        </span>
        {point?.canopyVpd !== null && point?.canopyVpd !== undefined && (
          <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-[10px] text-emerald-300 font-medium">
            VPD {point.canopyVpd} kPa
          </span>
        )}
      </div>

      <div className="space-y-1 pt-0.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-theme-text-muted">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-bold text-theme-text">
              {item.value !== null ? `${item.value}%` : '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
