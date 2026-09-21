import { Sprout, RefreshCw, Settings, AlertCircle } from 'lucide-react';

interface HeaderProps {
  isEspOnline: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  errorMessage: string | null;
  onOpenSettings: () => void;
}

export function Header({
  isEspOnline,
  isConnecting,
  isConnected,
  errorMessage,
  onOpenSettings,
}: HeaderProps) {
  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Sprout className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Grow Wardrobe
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-medium">
                PoC
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Interactive Environment & Custom Grow Manager
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
          >
            {isConnecting ? (
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 text-slate-400" />
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
