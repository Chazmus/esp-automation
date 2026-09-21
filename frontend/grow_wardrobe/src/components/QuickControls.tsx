import { Sun, Droplets, RefreshCw } from 'lucide-react';

interface QuickControlsProps {
  ventMode: string;
  irrMode: string;
  fanSpeed: string;
  lightState: boolean;
  dripPumpState: boolean;
  agitationPumpState: boolean;
  onToggleVentMode: () => void;
  onToggleIrrMode: () => void;
  onFanSpeedChange: (val: number) => void;
  onToggleLight: () => void;
  onToggleDripPump: () => void;
  onToggleAgitationPump: () => void;
}

export function QuickControls({
  ventMode,
  irrMode,
  fanSpeed,
  lightState,
  dripPumpState,
  agitationPumpState,
  onToggleVentMode,
  onToggleIrrMode,
  onFanSpeedChange,
  onToggleLight,
  onToggleDripPump,
  onToggleAgitationPump,
}: QuickControlsProps) {
  return (
    <section className="bg-theme-card border border-theme-border p-6 rounded-2xl space-y-5 transition-colors">
      <div className="border-b border-theme-border-subtle pb-3">
        <h2 className="text-lg font-semibold text-theme-text">Manual Overrides</h2>
        <p className="text-xs text-theme-text-muted">Direct hardware relays & loops</p>
      </div>

      {/* Mode Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-theme-surface rounded-xl border border-theme-border-subtle">
          <div>
            <div className="text-sm font-medium text-theme-text">Ventilation</div>
            <div className="text-xs text-theme-text-muted">PI VPD Loop Control</div>
          </div>
          <button
            type="button"
            onClick={onToggleVentMode}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              ventMode === 'AUTO'
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
            }`}
          >
            {ventMode}
          </button>
        </div>

        <div className="flex items-center justify-between p-3 bg-theme-surface rounded-xl border border-theme-border-subtle">
          <div>
            <div className="text-sm font-medium text-theme-text">Irrigation</div>
            <div className="text-xs text-theme-text-muted">State Machine</div>
          </div>
          <button
            type="button"
            onClick={onToggleIrrMode}
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
      <div className="space-y-2 p-3 bg-theme-surface rounded-xl border border-theme-border-subtle">
        <div className="flex justify-between text-xs">
          <span className="text-theme-text-muted">Fan Speed Override</span>
          <span className="text-theme-text font-medium">{fanSpeed}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Number(fanSpeed) || 0}
          onChange={(e) => onFanSpeedChange(Number(e.target.value))}
          disabled={ventMode === 'AUTO'}
          className="w-full accent-emerald-500 disabled:opacity-40 cursor-pointer"
        />
        {ventMode === 'AUTO' && (
          <div className="text-[11px] text-theme-text-dim">
            Switch ventilation to MANUAL to adjust speed
          </div>
        )}
      </div>

      {/* Relays */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onToggleLight}
          className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition ${
            lightState
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
              : 'bg-theme-surface border-theme-border text-theme-text-muted hover:border-theme-border-elevated'
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
          onClick={onToggleDripPump}
          className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition ${
            dripPumpState
              ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
              : 'bg-theme-surface border-theme-border text-theme-text-muted hover:border-theme-border-elevated'
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
          onClick={onToggleAgitationPump}
          className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition ${
            agitationPumpState
              ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
              : 'bg-theme-surface border-theme-border text-theme-text-muted hover:border-theme-border-elevated'
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
  );
}
