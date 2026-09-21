import { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import type { AppTheme } from '../types';
import { THEMES } from '../hooks/useTheme';

interface ThemeSelectorProps {
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
}

export function ThemeSelector({ currentTheme, onSelectTheme }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTheme = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-elevated hover:bg-theme-hover border border-theme-border-subtle text-xs text-theme-text transition shadow-sm"
        title="Change application theme"
        aria-label="Theme selector"
      >
        <Palette className="w-4 h-4 text-emerald-400" />
        <span className="hidden sm:inline">{activeTheme.icon} {activeTheme.label}</span>
        <span className="sm:hidden">{activeTheme.icon}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-theme-card border border-theme-border rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-md animate-fade-in space-y-0.5">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-theme-text-dim uppercase tracking-wider">
            Color Theme
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onSelectTheme(t.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                currentTheme === t.id
                  ? 'bg-emerald-500/15 text-emerald-400 font-semibold'
                  : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-elevated'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </div>
              {currentTheme === t.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
