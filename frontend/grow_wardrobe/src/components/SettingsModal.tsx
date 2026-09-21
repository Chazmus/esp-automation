import { Settings } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  haConfig: { url: string; token: string };
  setHaConfig: React.Dispatch<React.SetStateAction<{ url: string; token: string }>>;
  onSave: (url: string, token: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  haConfig,
  setHaConfig,
  onSave,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            Home Assistant Connection
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">HA Base URL</label>
            <input
              type="text"
              value={haConfig.url}
              onChange={(e) =>
                setHaConfig((prev) => ({ ...prev, url: e.target.value }))
              }
              placeholder="http://homeassistant.local:8123"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">
              Long-Lived Access Token
            </label>
            <input
              type="password"
              value={haConfig.token}
              onChange={(e) =>
                setHaConfig((prev) => ({ ...prev, token: e.target.value }))
              }
              placeholder="Paste HA Token here..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-slate-500">
              Generate in HA: Click your Profile (bottom-left) → Security → Long-Lived Access Tokens → Create Token.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onSave(haConfig.url, haConfig.token);
              onClose();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
