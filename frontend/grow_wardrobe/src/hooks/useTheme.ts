import { useState, useEffect } from 'react';
import type { AppTheme } from '../types';

export interface ThemeConfig {
  id: AppTheme;
  label: string;
  icon: string;
}

export const THEMES: ThemeConfig[] = [
  { id: 'slate', label: 'Midnight Slate', icon: '🌌' },
  { id: 'forest', label: 'Forest Dark', icon: '🌿' },
  { id: 'oled', label: 'Pure OLED', icon: '⬛' },
  { id: 'light', label: 'Clean Light', icon: '☀️' },
];

export function useTheme() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('grow_wardrobe_theme') as AppTheme | null;
    if (saved && ['slate', 'forest', 'oled', 'light'].includes(saved)) {
      return saved;
    }
    return 'slate';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('grow_wardrobe_theme', theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    themes: THEMES,
  };
}
