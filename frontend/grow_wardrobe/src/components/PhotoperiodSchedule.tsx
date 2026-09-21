import { useState, useEffect } from 'react';
import { Sun, Moon, Clock } from 'lucide-react';
import type { LightPreset } from '../types';

interface PhotoperiodScheduleProps {
  preset: LightPreset;
  startTime: string; // e.g. '06:00'
  onStartTimeChange: (time: string) => void;
  disabled?: boolean;
}

export function PhotoperiodSchedule({
  preset,
  startTime,
  onStartTimeChange,
  disabled = false,
}: PhotoperiodScheduleProps) {
  // Live ticker for current time
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const onHours = preset === '18/6' ? 18 : preset === '12/12' ? 12 : 24;
  const offHours = 24 - onHours;

  const [startH, startM] = (startTime || '06:00').split(':').map(Number);
  const startTotalMinutes = (startH || 0) * 60 + (startM || 0);
  const durationMinutes = onHours * 60;
  const endTotalMinutes = (startTotalMinutes + durationMinutes) % 1440;

  const endH = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;
  const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentNowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let isLightOn = false;
  let remainingMinutes = 0;

  if (onHours === 24) {
    isLightOn = true;
    remainingMinutes = 0;
  } else if (endTotalMinutes > startTotalMinutes) {
    isLightOn = currentMinutes >= startTotalMinutes && currentMinutes < endTotalMinutes;
    if (isLightOn) {
      remainingMinutes = endTotalMinutes - currentMinutes;
    } else {
      remainingMinutes = (startTotalMinutes - currentMinutes + 1440) % 1440;
    }
  } else {
    // Wraps around midnight (e.g. 20:00 to 14:00)
    isLightOn = currentMinutes >= startTotalMinutes || currentMinutes < endTotalMinutes;
    if (isLightOn) {
      remainingMinutes = (endTotalMinutes - currentMinutes + 1440) % 1440;
    } else {
      remainingMinutes = startTotalMinutes - currentMinutes;
    }
  }

  const remH = Math.floor(remainingMinutes / 60);
  const remM = remainingMinutes % 60;
  const remStr = remH > 0 ? `${remH}h ${remM}m` : `${remM}m`;

  // Calculate ON segments as percentages of 1440 minutes
  const segments: { left: number; width: number }[] = [];
  if (onHours === 24) {
    segments.push({ left: 0, width: 100 });
  } else if (endTotalMinutes > startTotalMinutes) {
    segments.push({
      left: (startTotalMinutes / 1440) * 100,
      width: (durationMinutes / 1440) * 100,
    });
  } else {
    // Segment 1: from start to midnight
    segments.push({
      left: (startTotalMinutes / 1440) * 100,
      width: ((1440 - startTotalMinutes) / 1440) * 100,
    });
    // Segment 2: from midnight to end
    segments.push({
      left: 0,
      width: (endTotalMinutes / 1440) * 100,
    });
  }

  const nowPercent = (currentMinutes / 1440) * 100;

  return (
    <div className="bg-theme-surface p-4 rounded-xl border border-theme-border-subtle space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400" />
          <div>
            <h4 className="text-xs font-semibold text-theme-text">24-Hour Photoperiod Schedule</h4>
            <p className="text-[11px] text-theme-text-muted">
              {preset === '24/0'
                ? 'Continuous 24h lighting (No dark cycle)'
                : `${onHours} Hours Daylight (ON) • ${offHours} Hours Darkness (OFF)`}
            </p>
          </div>
        </div>

        {preset !== '24/0' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-theme-text-muted flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Lights Turn On:</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              disabled={disabled}
              className="bg-theme-base border border-theme-border text-theme-text px-2.5 py-1 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
          </div>
        )}
      </div>

      {/* 24-Hour Visual Timeline Track */}
      <div className="space-y-1.5">
        <div className="relative h-10 bg-slate-950 rounded-xl border border-theme-border overflow-hidden shadow-inner">
          {/* Base Dark Cycle Background */}
          <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center text-[10px] text-slate-600 font-mono select-none">
            {preset !== '24/0' && (
              <span className="flex items-center gap-1 opacity-60">
                <Moon className="w-3 h-3 text-indigo-400" /> Dark Cycle (OFF)
              </span>
            )}
          </div>

          {/* Active Daytime Segments */}
          {segments.map((seg, idx) => (
            <div
              key={idx}
              className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500/30 via-amber-400/40 to-amber-500/30 border-y border-amber-400/50 flex items-center justify-center overflow-hidden transition-all duration-300"
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 drop-shadow-sm px-2 truncate">
                <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse flex-shrink-0" />
                <span className="truncate">Lights ON ({onHours}h)</span>
              </div>
            </div>
          ))}

          {/* Live Current Time "NOW" Indicator */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-all duration-500"
            style={{ left: `${nowPercent}%` }}
            title={`Current Time: ${currentNowStr}`}
          >
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-white animate-ping opacity-75" />
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-white shadow-md shadow-white" />
          </div>
        </div>

        {/* 24h Scale Labels */}
        <div className="flex justify-between text-[10px] text-theme-text-dim font-mono px-0.5">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Detail Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-2.5 bg-theme-card border border-theme-border-subtle rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-theme-text-muted">Lights ON Time</div>
              <div className="text-sm font-bold text-theme-text">
                {preset === '24/0' ? 'Always ON (24/7)' : startTime}
              </div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full font-medium">
            {onHours}h Day
          </span>
        </div>

        <div className="p-2.5 bg-theme-card border border-theme-border-subtle rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-theme-text-muted">Lights OFF Time</div>
              <div className="text-sm font-bold text-theme-text">
                {preset === '24/0' ? 'None (Continuous)' : endTimeStr}
              </div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-full font-medium">
            {offHours}h Night
          </span>
        </div>

        <div className="p-2.5 bg-theme-card border border-theme-border-subtle rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] text-theme-text-muted">Current Status (at {currentNowStr})</div>
            <div className="text-xs font-semibold text-theme-text flex items-center gap-1.5 mt-0.5">
              {isLightOn ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-300 font-medium">☀️ Day Active</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-indigo-300 font-medium">🌙 Night Cycle</span>
                </>
              )}
            </div>
          </div>
          {preset !== '24/0' && (
            <div className="text-right">
              <div className="text-[10px] text-theme-text-dim">
                {isLightOn ? 'Off In' : 'On In'}
              </div>
              <div className="text-xs font-mono font-bold text-theme-text">
                {remStr}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
