'use client'

import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string
  name: string
}

interface AuthStore {
  // Kept in memory only (not localStorage) to reduce the blast radius of an
  // XSS bug — see README "Auth strategy" for the cookie-vs-header tradeoff.
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  login: (user: AuthUser, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  login: (user, token) => set({ user, token, isAuthenticated: true }),
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
}))
