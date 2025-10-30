import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware'
import { User } from "@/types/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  login: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      login: () => {
        // Redirect to backend auth endpoint
        // Have backend redirect directly to frontend homepage after auth
        const nextParam = encodeURIComponent(`${window.location.origin}/`);
        window.location.href = `/auth/login?next=${nextParam}`;
      },

      logout: async () => {
        try {
          // Call backend logout endpoint
          await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear local state regardless of API call success
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
          // Redirect to login page
          window.location.href = '/auth/login';
        }
      },

      checkAuth: async () => {
        const currentState = get();

        // Prevent multiple simultaneous auth checks
        if (currentState.isLoading) {
          return;
        }

        try {
          set({ isLoading: true });

          // Check if we have a session by calling the whoami endpoint
          const response = await fetch('/api/whoami', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (response.ok) {
            const userData = await response.json();
            set({
              user: userData,
              isAuthenticated: true,
              isLoading: false
            });
          } else if (response.status === 401 || response.status === 403) {
            // Clear auth state for unauthorized responses
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false
            });
          } else {
            // For other errors, don't change auth state
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          // On network errors, assume not authenticated
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist user data, not loading states
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);