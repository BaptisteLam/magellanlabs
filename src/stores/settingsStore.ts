import { create } from 'zustand';

export type SettingsSection = 'siteweb' | 'analytiques' | 'contact' | 'parametres';

interface SettingsStore {
  isOpen: boolean;
  currentSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setSection: (section: SettingsSection) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  currentSection: 'siteweb',
  openSettings: (section = 'siteweb') => set({ isOpen: true, currentSection: section }),
  closeSettings: () => set({ isOpen: false }),
  setSection: (section) => set({ currentSection: section }),
}));