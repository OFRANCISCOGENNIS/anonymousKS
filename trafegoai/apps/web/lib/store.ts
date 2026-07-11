'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { name: string; email: string } | null;
  org: { id: string; name: string; plan: string } | null;
  hydrated: boolean; // true depois que o persist reidratou do localStorage
  setSession: (token: string) => void;
  setProfile: (user: AuthState['user'], org: AuthState['org']) => void;
  setHydrated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      org: null,
      hydrated: false,
      setSession: (token) => set({ token }),
      setProfile: (user, org) => set({ user, org }),
      setHydrated: () => set({ hydrated: true }),
      logout: () => set({ token: null, user: null, org: null }),
    }),
    {
      name: 'trafegoai-auth',
      // não persistir o flag de hidratação
      partialize: (s) => ({ token: s.token, user: s.user, org: s.org }),
      // marca hidratado quando o localStorage é lido (evita bounce p/ login no refresh)
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export type Preset = 'today' | '7d' | '30d' | 'custom';

interface FilterState {
  preset: Preset;
  from?: string;
  to?: string;
  platform?: 'GOOGLE' | 'META' | 'TIKTOK';
  accountId?: string;
  clientId?: string;
  set: (patch: Partial<Omit<FilterState, 'set' | 'toQuery'>>) => void;
  toQuery: () => Record<string, string | undefined>;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  preset: '30d',
  set: (patch) => set(patch),
  toQuery: () => {
    const { preset, from, to, platform, accountId, clientId } = get();
    return preset === 'custom'
      ? { from, to, platform, accountId, clientId }
      : { preset, platform, accountId, clientId };
  },
}));
