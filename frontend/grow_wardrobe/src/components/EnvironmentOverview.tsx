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
      <div className="bg-theme-card border border-theme-border p-5 rounded-2xl space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-theme-border-subtle pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Sprout className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-theme-text">Canopy Zone</div>
              <div className="text-[11px] text-theme-text-muted">Foliage & Transpiration</div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-medium">
            Primary
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>Temp</span>
              <Thermometer className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {canopy.temp}<span className="text-xs font-normal text-theme-text-muted">°C</span>
            </div>
          </div>

          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>Humidity</span>
              <Droplets className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {canopy.humidity}<span className="text-xs font-normal text-theme-text-muted">%</span>
            </div>
          </div>

          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>VPD</span>
              <Wind className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {canopy.vpd}<span className="text-xs font-normal text-theme-text-muted">kPa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pot & Root Zone Card */}
      <div className="bg-theme-card border border-theme-border p-5 rounded-2xl space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-theme-border-subtle pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-500/10 border border-teal-500/30 rounded-lg text-teal-400">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-theme-text">Pot & Root Zone</div>
              <div className="text-[11px] text-theme-text-muted">Substrate Microclimate</div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950 border border-teal-800 text-teal-300 font-medium">
            Moisture: {pot.moisture}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>Temp</span>
              <Thermometer className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {pot.temp}<span className="text-xs font-normal text-theme-text-muted">°C</span>
            </div>
          </div>

          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>Humidity</span>
              <Droplets className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {pot.humidity}<span className="text-xs font-normal text-theme-text-muted">%</span>
            </div>
          </div>

          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>VPD</span>
              <Wind className="w-3 h-3 text-teal-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {pot.vpd}<span className="text-xs font-normal text-theme-text-muted">kPa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ambient / Intake Zone Card */}
      <div className="bg-theme-card border border-theme-border p-5 rounded-2xl space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-theme-border-subtle pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-theme-text">Ambient / Room</div>
              <div className="text-[11px] text-theme-text-muted">Intake Air Reference</div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 font-medium">
            Reference
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>Temp</span>
              <Thermometer className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {ambient.temp}<span className="text-xs font-normal text-theme-text-muted">°C</span>
            </div>
          </div>

          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>Humidity</span>
              <Droplets className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {ambient.humidity}<span className="text-xs font-normal text-theme-text-muted">%</span>
            </div>
          </div>

          <div className="bg-theme-surface p-2.5 rounded-xl border border-theme-border-subtle">
            <div className="text-[10px] text-theme-text-muted flex items-center justify-between mb-1">
              <span>VPD</span>
              <Wind className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-theme-text">
              {ambient.vpd}<span className="text-xs font-normal text-theme-text-muted">kPa</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
