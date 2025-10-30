import { create } from "zustand";
import { api } from "@/lib/api";

export interface Namespace {
  id: string;
  name: string;
  display_name: string;
  user_owner_id?: string;
  organization_owner_id?: string;
}

interface NamespaceResponse {
  results: Namespace[];
  total: number;
}

interface NamespaceState {
  namespaces: Namespace[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNamespaces: () => Promise<void>;
}

export const useNamespaceStore = create<NamespaceState>((set) => ({
  namespaces: [],
  isLoading: false,
  error: null,

  fetchNamespaces: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.get<NamespaceResponse>('/namespaces');
      set({
        namespaces: response.results,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch namespaces',
        isLoading: false
      });
    }
  },
}));