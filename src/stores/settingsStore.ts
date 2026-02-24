import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SettingsSection = 'siteweb' | 'analytiques' | 'contact' | 'parametres';

interface SettingsStore {
  isOpen: boolean;
  currentSection: SettingsSection;
  language: string;
  autoSave: boolean;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setSection: (section: SettingsSection) => void;
  setLanguage: (language: string) => void;
  setAutoSave: (autoSave: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      isOpen: false,
      currentSection: 'siteweb',
      language: 'fr',
      autoSave: true,
      openSettings: (section = 'siteweb') => set({ isOpen: true, currentSection: section }),
      closeSettings: () => set({ isOpen: false }),
      setSection: (section) => set({ currentSection: section }),
      setLanguage: (language) => set({ language }),
      setAutoSave: (autoSave) => set({ autoSave }),
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        language: state.language,
        autoSave: state.autoSave,
      }),
    }
  )
);
