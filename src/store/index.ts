import { create } from 'zustand';
import type { CaptionStyle, Platform, ClipLength } from '@/types';

interface ClipForgeStore {
  darkMode: boolean;
  toggleDarkMode: () => void;

  currentProjectId: string | null;
  setCurrentProject: (id: string | null) => void;

  selectedClipId: string | null;
  selectClip: (id: string | null) => void;

  captionStyle: CaptionStyle;
  setCaptionStyle: (style: CaptionStyle) => void;

  selectedPlatforms: Platform[];
  togglePlatform: (platform: Platform) => void;

  clipLengths: ClipLength[];
  toggleClipLength: (length: ClipLength) => void;

  previewTime: number;
  setPreviewTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  processingStatus: string | null;
  setProcessingStatus: (status: string | null) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useClipForgeStore = create<ClipForgeStore>((set) => ({
  darkMode: false,
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next);
      }
      return { darkMode: next };
    }),

  currentProjectId: null,
  setCurrentProject: (id) => set({ currentProjectId: id }),

  selectedClipId: null,
  selectClip: (id) => set({ selectedClipId: id }),

  captionStyle: 'bold',
  setCaptionStyle: (style) => set({ captionStyle: style }),

  selectedPlatforms: ['youtube_shorts'],
  togglePlatform: (platform) =>
    set((state) => {
      const exists = state.selectedPlatforms.includes(platform);
      if (exists && state.selectedPlatforms.length === 1) return state;
      return {
        selectedPlatforms: exists
          ? state.selectedPlatforms.filter((p) => p !== platform)
          : [...state.selectedPlatforms, platform],
      };
    }),

  clipLengths: [30, 60],
  toggleClipLength: (length) =>
    set((state) => {
      const exists = state.clipLengths.includes(length);
      if (exists && state.clipLengths.length === 1) return state;
      return {
        clipLengths: exists
          ? state.clipLengths.filter((l) => l !== length)
          : [...state.clipLengths, length].sort((a, b) => a - b),
      };
    }),

  previewTime: 0,
  setPreviewTime: (time) => set({ previewTime: time }),
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  processingStatus: null,
  setProcessingStatus: (status) => set({ processingStatus: status }),

  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}));
