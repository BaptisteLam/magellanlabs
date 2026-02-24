import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  isDark: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') return getSystemPrefersDark();
  return mode === 'dark';
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      isDark: false,
      mode: 'light' as ThemeMode,
      toggleTheme: () => {
        const current = get();
        const newMode = current.isDark ? 'light' : 'dark';
        set({ isDark: !current.isDark, mode: newMode });
      },
      setMode: (mode: ThemeMode) => {
        set({ mode, isDark: resolveIsDark(mode) });
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);

// Listen for OS theme changes when in 'system' mode
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useThemeStore.getState();
    if (state.mode === 'system') {
      useThemeStore.setState({ isDark: e.matches });
    }
  });
}
