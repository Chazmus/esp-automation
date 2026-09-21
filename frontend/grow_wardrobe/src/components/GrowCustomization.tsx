import { useState } from 'react';
import {
  Clock,
  Droplets,
  Layers,
  CalendarClock,
  Gauge,
  Timer,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { GrowMedium, LightPreset } from '../types';

interface GrowCustomizationProps {
  growMedium: GrowMedium;
  setGrowMedium: (val: GrowMedium) => void;
  cocoIntervalHours: number;
  setCocoIntervalHours: (val: number) => void;
  cocoDurationSec: number;
  setCocoDurationSec: (val: number) => void;
  soilTriggerMoisture: number;
  setSoilTriggerMoisture: (val: number) => void;
  soilTargetMoisture: number;
  setSoilTargetMoisture: (val: number) => void;
  soilSoakWaitMin: number;
  setSoilSoakWaitMin: (val: number) => void;
  soilMaxWaterSec: number;
  setSoilMaxWaterSec: (val: number) => void;
  lightPreset: LightPreset;
  setLightPreset: (val: LightPreset) => void;
  potMoisture: string;
  irrigationPhase: string;
  nextFeedTargetTimestamp: number | null;
  isConnected: boolean;
  saveSuccess: boolean;
  onTriggerFeedNow: () => void;
  onScheduleNextCycle: (delaySeconds: number) => void;
  onScheduleSpecificTime: (timeStr: string) => void;
  onSaveGrowConfig: () => void;
}

export function GrowCustomization({
  growMedium,
  setGrowMedium,
  cocoIntervalHours,
  setCocoIntervalHours,
  cocoDurationSec,
  setCocoDurationSec,
  soilTriggerMoisture,
  setSoilTriggerMoisture,
  soilTargetMoisture,
  setSoilTargetMoisture,
  soilSoakWaitMin,
  setSoilSoakWaitMin,
  soilMaxWaterSec,
  setSoilMaxWaterSec,
  lightPreset,
  setLightPreset,
  potMoisture,
  irrigationPhase,
  nextFeedTargetTimestamp,
  isConnected,
  saveSuccess,
  onTriggerFeedNow,
  onScheduleNextCycle,
  onScheduleSpecificTime,
  onSaveGrowConfig,
}: GrowCustomizationProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [customFeedTime, setCustomFeedTime] = useState('');

  // Helper to calculate upcoming feedings based on scheduled next cycle
  const getScheduledFeedings = (intervalHours: number, targetTimestamp: number | null, count = 3) => {
    const now = Date.now();
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

  return (
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
                    onClick={onTriggerFeedNow}
                    disabled={!isConnected}
                    className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1 transition shadow-sm"
                    title="Trigger an immediate watering cycle"
                  >
                    ⚡ Water Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    disabled={!isConnected}
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
                        onClick={() => {
                          onScheduleNextCycle(15 * 60);
                          setShowScheduleModal(false);
                        }}
                        className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition"
                      >
                        In 15m
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onScheduleNextCycle(30 * 60);
                          setShowScheduleModal(false);
                        }}
                        className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition"
                      >
                        In 30m
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onScheduleNextCycle(60 * 60);
                          setShowScheduleModal(false);
                        }}
                        className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition"
                      >
                        In 1h
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onScheduleNextCycle(2 * 60 * 60);
                          setShowScheduleModal(false);
                        }}
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
                        onClick={() => {
                          onScheduleSpecificTime(customFeedTime);
                          setShowScheduleModal(false);
                        }}
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
                        onTriggerFeedNow();
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
          onClick={onSaveGrowConfig}
          disabled={!isConnected}
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
  );
}
