import { Sprout, RefreshCw, Settings, AlertCircle } from 'lucide-react';
import type { AppTheme } from '../types';
import { ThemeSelector } from './ThemeSelector';

interface HeaderProps {
  isEspOnline: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  errorMessage: string | null;
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  onOpenSettings: () => void;
}

export function Header({
  isEspOnline,
  isConnecting,
  isConnected,
  errorMessage,
  currentTheme,
  onSelectTheme,
  onOpenSettings,
}: HeaderProps) {
  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-theme-card border border-theme-border p-5 rounded-2xl backdrop-blur transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Sprout className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-theme-text flex items-center gap-2">
              Grow Wardrobe
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-medium">
                PoC
              </span>
            </h1>
            <p className="text-xs text-theme-text-muted">
              Interactive Environment & Custom Grow Manager
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Selector */}
          <ThemeSelector currentTheme={currentTheme} onSelectTheme={onSelectTheme} />

          {/* ESP32 Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isEspOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isEspOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            ESP32: {isEspOnline ? 'Online' : 'Offline'}
          </div>

          {/* HA Connection */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-theme-elevated hover:bg-theme-hover border border-theme-border-subtle text-xs text-theme-text transition shadow-sm"
          >
            {isConnecting ? (
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 text-theme-text-muted" />
            )}
            {isConnecting ? 'Connecting...' : isConnected ? 'HA Connected' : 'Connect HA'}
          </button>
        </div>
      </header>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
