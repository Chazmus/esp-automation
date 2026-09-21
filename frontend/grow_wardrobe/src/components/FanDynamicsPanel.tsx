import {
  Wind,
  Gauge,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Flame,
  CheckCircle2,
  Sliders,
  Droplets,
  Thermometer,
} from 'lucide-react';
import type { FanDynamicsData } from '../types';

interface FanDynamicsPanelProps {
  dynamics: FanDynamicsData;
}

export function FanDynamicsPanel({ dynamics }: FanDynamicsPanelProps) {
  const {
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
  } = dynamics;

  return (
    <section className="bg-theme-card border border-theme-border rounded-2xl p-5 md:p-6 space-y-5 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Wind className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-theme-text flex items-center gap-2">
              Fan Dynamics & Intelligence
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 font-normal">
                {ventMode === 'AUTO' ? 'PI Closed-Loop' : 'Manual Lock'}
              </span>
            </h2>
            <p className="text-xs text-theme-text-muted">
              Real-time control rationale, VPD differentials & airflow physics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-theme-surface border border-theme-border px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <Gauge className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-theme-text-muted">Current Speed:</span>
            <span className="text-sm font-bold text-theme-text">{fanSpeed}%</span>
          </div>
        </div>
      </div>

      {/* Fan Speed Visual Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-theme-text-muted">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            Modulation Gauge
          </span>
          <span className="font-medium text-theme-text">{fanSpeed}% Active Output</span>
        </div>
        <div className="h-3 w-full bg-theme-surface rounded-full border border-theme-border-subtle overflow-hidden relative">
          {/* Baseline marker 30% */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-600 z-10"
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
        <div className="flex justify-between text-[10px] text-theme-text-dim">
          <span>0% (Off)</span>
          <span>30% (Baseline Floor)</span>
          <span>100% (Max CFM)</span>
        </div>
      </div>

      {/* Active Driving Factor / Live Rationale Card */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {fanDriver.category === 'override' && <ShieldAlert className="w-4 h-4 text-rose-400" />}
            {fanDriver.category === 'clamp' && <ShieldCheck className="w-4 h-4 text-amber-400" />}
            {fanDriver.category === 'temp' && <Flame className="w-4 h-4 text-orange-400" />}
            {fanDriver.category === 'vpd' && <Wind className="w-4 h-4 text-emerald-400" />}
            {fanDriver.category === 'optimal' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {fanDriver.category === 'manual' && <Sliders className="w-4 h-4 text-amber-400" />}
            <span className="text-sm font-semibold text-theme-text">
              Why is the fan set to {fanSpeed}%?
            </span>
          </div>
          <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${fanDriver.badgeColor}`}>
            {fanDriver.badge}
          </span>
        </div>

        <p className="text-xs text-theme-text-muted leading-relaxed">
          {fanDriver.explanation}
        </p>

        {/* Hardware confirmation if published by ESP32 */}
        {fanReason && fanReason !== '--' && (
          <div className="pt-1 text-[11px] text-theme-text-dim border-t border-theme-border-subtle flex items-center gap-2">
            <span className="font-mono">Firmware Decision:</span>
            <span className="font-mono text-emerald-400">{fanReason}</span>
          </div>
        )}
      </div>

      {/* 3-Card Differential Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: VPD Demand (Canopy vs Target) */}
        <div className="bg-theme-surface border border-theme-border-subtle rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-theme-text-muted">1. Target VPD Demand</span>
            <Wind className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-lg font-bold text-theme-text">{canopyVpd} kPa</div>
              <div className="text-[10px] text-theme-text-dim">Canopy Leaf VPD</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-theme-text-muted">Target: {targetVpd.toFixed(2)} kPa</div>
              <div className="text-[10px] text-theme-text-dim">
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
          <p className="text-[11px] text-theme-text-muted leading-normal border-t border-theme-border-subtle pt-2">
            Defines <strong className="text-theme-text">ventilation demand</strong>. Lower VPD means stagnant humid air, prompting the PI loop to increase airflow.
          </p>
        </div>

        {/* Card 2: Intake vs Canopy Moisture (Effectiveness & Clamp) */}
        <div className="bg-theme-surface border border-theme-border-subtle rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-theme-text-muted">2. Intake Moisture Δ</span>
            <Droplets className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-lg font-bold text-theme-text">
                {canopyAvp !== null ? `${canopyAvp.toFixed(2)} kPa` : '--'}
              </div>
              <div className="text-[10px] text-theme-text-dim">Canopy Vapor Press.</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-theme-text-muted">
                Room: {ambientAvp !== null ? `${ambientAvp.toFixed(2)} kPa` : '--'}
              </div>
              <div className="text-[10px] text-theme-text-dim">
                {avpDiff !== null
                  ? avpDiff >= 0
                    ? `Intake Wetter (+${avpDiff.toFixed(2)} kPa)`
                    : `Intake Drier (${avpDiff.toFixed(2)} kPa)`
                  : '--'}
                {vpdAmbientDiff !== null && ` • ΔVPD: ${vpdAmbientDiff >= 0 ? '+' : ''}${vpdAmbientDiff.toFixed(2)}`}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-theme-text-muted leading-normal border-t border-theme-border-subtle pt-2">
            Defines <strong className="text-theme-text">drying effectiveness</strong>. If intake air is wetter than the canopy, the moisture clamp prevents fan speed-up.
          </p>
        </div>

        {/* Card 3: Thermal Differential (Cooling Potential) */}
        <div className="bg-theme-surface border border-theme-border-subtle rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-theme-text-muted">3. Thermal Differential ΔT</span>
            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-lg font-bold text-theme-text">{canopyTemp}°C</div>
              <div className="text-[10px] text-theme-text-dim">Canopy Temp</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-theme-text-muted">Room: {ambientTemp}°C</div>
              <div className="text-[10px] text-theme-text-dim">
                {tempDiff !== null
                  ? tempDiff < 0
                    ? `${Math.abs(tempDiff).toFixed(1)}°C Cooler Outside`
                    : `${tempDiff.toFixed(1)}°C Warmer Outside`
                  : '--'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-theme-text-muted leading-normal border-t border-theme-border-subtle pt-2">
            Defines <strong className="text-theme-text">cooling capability</strong>. When canopy temp exceeds 28°C, thermal loop ramps speed to draw in cooler room air.
          </p>
        </div>
      </div>
    </section>
  );
}
