import { Sprout, Droplets, Wind, Thermometer } from 'lucide-react';
import type { EnvironmentMetrics } from '../types';

interface EnvironmentOverviewProps {
  metrics: EnvironmentMetrics;
}

export function EnvironmentOverview({ metrics }: EnvironmentOverviewProps) {
  const { canopy, pot, ambient } = metrics;

  return (
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
              {canopy.temp}<span className="text-xs font-normal text-slate-400">°C</span>
            </div>
          </div>

          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
            <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
              <span>Humidity</span>
              <Droplets className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {canopy.humidity}<span className="text-xs font-normal text-slate-400">%</span>
            </div>
          </div>

          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
            <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
              <span>VPD</span>
              <Wind className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {canopy.vpd}<span className="text-xs font-normal text-slate-400">kPa</span>
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
            Moisture: {pot.moisture}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
            <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
              <span>Temp</span>
              <Thermometer className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {pot.temp}<span className="text-xs font-normal text-slate-400">°C</span>
            </div>
          </div>

          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
            <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
              <span>Humidity</span>
              <Droplets className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {pot.humidity}<span className="text-xs font-normal text-slate-400">%</span>
            </div>
          </div>

          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
            <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
              <span>VPD</span>
              <Wind className="w-3 h-3 text-teal-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {pot.vpd}<span className="text-xs font-normal text-slate-400">kPa</span>
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
              {ambient.temp}<span className="text-xs font-normal text-slate-400">°C</span>
            </div>
          </div>

          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
            <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
              <span>Humidity</span>
              <Droplets className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {ambient.humidity}<span className="text-xs font-normal text-slate-400">%</span>
            </div>
          </div>

          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
            <div className="text-[10px] text-slate-400 flex items-center justify-between mb-1">
              <span>VPD</span>
              <Wind className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {ambient.vpd}<span className="text-xs font-normal text-slate-400">kPa</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
