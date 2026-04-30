import { create } from 'zustand';

interface UserProfile {
  id: string;
  is_verified: boolean;
  role: string;
  phone?: string;
  avatar_url?: string;
  car_plate?: string;
  car_type?: string;
  car_color?: string;
}

interface AppState {
  isOffline: boolean;
  setIsOffline: (isOffline: boolean) => void;
  selectedRoute: string | null;
  setSelectedRoute: (route: string | null) => void;
  userLocation: [number, number] | null;
  setUserLocation: (loc: [number, number] | null) => void;
  isSharingLocation: boolean;
  setIsSharingLocation: (isSharing: boolean) => void;
  
  // Trips specifics
  isDriverAvailable: boolean;
  setIsDriverAvailable: (available: boolean) => void;
  
  isLightMap: boolean;
  setIsLightMap: (light: boolean) => void;

  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  
  authInitialized: boolean;
  setAuthInitialized: (initialized: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOffline: !navigator.onLine,
  setIsOffline: (isOffline) => set({ isOffline }),
  selectedRoute: null,
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),
  isSharingLocation: false,
  setIsSharingLocation: (isSharing) => set({ isSharingLocation: isSharing }),
  
  isDriverAvailable: false,
  setIsDriverAvailable: (available) => set({ isDriverAvailable: available }),
  
  isLightMap: false,
  setIsLightMap: (light) => set({ isLightMap: light }),

  userProfile: null,
  setUserProfile: (profile) => set({ userProfile: profile }),

  authInitialized: false,
  setAuthInitialized: (initialized) => set({ authInitialized: initialized }),
}));
