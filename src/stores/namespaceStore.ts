import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware'
import { api } from "@/lib/api";
import { Organization } from "@/types/api";

export interface Namespace {
  id: string;
  user?: {
    id: string;
  };
  organization?: {
    id: string;
    name: string;
    display_name: string;
  };
}

interface NamespaceResponse {
  results: Namespace[];
  total: number;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  display_name: string;
  type: 'personal' | 'organization';
  isPersonal: boolean;
  namespace: Namespace;
}

interface NamespaceState {
  namespaces: Namespace[];
  currentNamespace: Namespace | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentNamespace: (namespace: Namespace | null) => void;
  fetchNamespaces: () => Promise<void>;
  createNamespace: (organizationData: { name: string; display_name: string }) => Promise<Namespace>;

  // Filtering helpers
  getPersonalNamespaces: () => Namespace[];
  getOrganizationNamespaces: (organizationId?: string) => Namespace[];
  getFilteredNamespaces: (currentOrganizationId?: string) => Namespace[];

  // Workspace helpers
  getWorkspaceItems: () => WorkspaceItem[];
  getCurrentWorkspaceContext: () => {
    isOrganizationContext: boolean;
    organization?: { id: string; name: string; display_name: string }
  };
}

export const useNamespaceStore = create<NamespaceState>()(
  persist(
    (set, get) => ({
      namespaces: [],
      currentNamespace: null,
      isLoading: false,
      error: null,

      setCurrentNamespace: (namespace: Namespace | null) => {
        set({ currentNamespace: namespace });
      },

      fetchNamespaces: async () => {
        try {
          set({ isLoading: true, error: null });
          const response = await api.get<NamespaceResponse>('/namespaces');
          const namespaces = response.results;

          // If no current namespace is set, set the first personal namespace or first available
          const current = get().currentNamespace;
          const newCurrent = current && namespaces.find(ns => ns.id === current.id)
            ? current
            : namespaces.find(ns => ns.user) || namespaces[0] || null;

          set({
            namespaces,
            currentNamespace: newCurrent,
            isLoading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch namespaces',
            isLoading: false
          });
        }
      },

      createNamespace: async (organizationData) => {
        try {
          set({ isLoading: true, error: null });

          // First create the organization
          const organization = await api.post<Organization>('/organizations', organizationData);

          // Then create a namespace for the organization
          const namespace = await api.post<Namespace>('/namespaces', {
            organization_id: organization.id
          });

          // Add to local state
          const namespaces = [...get().namespaces, namespace];
          set({
            namespaces,
            isLoading: false
          });

          return namespace;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create namespace',
            isLoading: false
          });
          throw error;
        }
      },

      getPersonalNamespaces: () => {
        return get().namespaces.filter(namespace => namespace.user);
      },

      getOrganizationNamespaces: (organizationId?: string) => {
        const namespaces = get().namespaces.filter(namespace => namespace.organization);
        if (organizationId) {
          return namespaces.filter(namespace => namespace.organization?.id === organizationId);
        }
        return namespaces;
      },

      getFilteredNamespaces: (currentOrganizationId?: string) => {
        if (currentOrganizationId) {
          // Organization context - show only organization namespaces
          return get().getOrganizationNamespaces(currentOrganizationId);
        } else {
          // Personal context - show only personal namespaces
          return get().getPersonalNamespaces();
        }
      },

      getWorkspaceItems: () => {
        const namespaces = get().namespaces;
        return namespaces.map(namespace => ({
          id: namespace.id,
          name: namespace.organization?.name || 'personal',
          display_name: namespace.organization?.display_name || 'Personal',
          type: namespace.organization ? 'organization' as const : 'personal' as const,
          isPersonal: !namespace.organization,
          namespace
        }));
      },

      getCurrentWorkspaceContext: () => {
        const currentNamespace = get().currentNamespace;
        return {
          isOrganizationContext: !!currentNamespace?.organization,
          organization: currentNamespace?.organization
        };
      },
    }),
    {
      name: "namespace-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist current namespace, not the full list
      partialize: (state) => ({
        currentNamespace: state.currentNamespace
      }),
    }
  )
);