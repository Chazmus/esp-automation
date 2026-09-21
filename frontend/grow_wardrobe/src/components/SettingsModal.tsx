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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-theme-card border border-theme-border p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-theme-border-subtle pb-3">
          <h3 className="text-base font-semibold text-theme-text flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            Home Assistant Connection
          </h3>
          <button
            onClick={onClose}
            className="text-theme-text-muted hover:text-theme-text text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-theme-text-muted mb-1">HA Base URL</label>
            <input
              type="text"
              value={haConfig.url}
              onChange={(e) =>
                setHaConfig((prev) => ({ ...prev, url: e.target.value }))
              }
              placeholder="http://homeassistant.local:8123"
              className="w-full bg-theme-base border border-theme-border rounded-lg px-3 py-2 text-theme-text focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-theme-text-muted mb-1">
              Long-Lived Access Token
            </label>
            <input
              type="password"
              value={haConfig.token}
              onChange={(e) =>
                setHaConfig((prev) => ({ ...prev, token: e.target.value }))
              }
              placeholder="Paste HA Token here..."
              className="w-full bg-theme-base border border-theme-border rounded-lg px-3 py-2 text-theme-text focus:outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-theme-text-dim">
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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition shadow-lg shadow-emerald-950"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
