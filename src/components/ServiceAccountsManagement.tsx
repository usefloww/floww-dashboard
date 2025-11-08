import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, handleApiError } from "@/lib/api";
import { ServiceAccountsListResponse, ApiKey } from "@/types/api";
import { Loader } from "@/components/Loader";
import { Key, Plus, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateServiceAccountModal } from "@/components/CreateServiceAccountModal";
import { CreateApiKeyModal } from "@/components/CreateApiKeyModal";
import { showSuccessNotification, showErrorNotification } from "@/stores/notificationStore";

interface ServiceAccountsManagementProps {
  organizationId: string;
}

export function ServiceAccountsManagement({ organizationId }: ServiceAccountsManagementProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createApiKeyModalState, setCreateApiKeyModalState] = useState<{
    open: boolean;
    serviceAccountId: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['service-accounts', organizationId],
    queryFn: async () => {
      const data = await api.get<ServiceAccountsListResponse>("/service_accounts", {
        params: { organization_id: organizationId },
      });
      return data.results || [];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ serviceAccountId, apiKeyId }: { serviceAccountId: string; apiKeyId: string }) => {
      return await api.post<ApiKey>(`/service_accounts/${serviceAccountId}/api_keys/${apiKeyId}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-accounts', organizationId] });
      showSuccessNotification("API key revoked", "The API key has been revoked successfully.");
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      showErrorNotification("Failed to revoke API key", errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (serviceAccountId: string) => {
      return await api.delete(`/service_accounts/${serviceAccountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-accounts', organizationId] });
      showSuccessNotification("Service account deleted", "The service account has been deleted successfully.");
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      showErrorNotification("Failed to delete service account", errorMessage);
    },
  });

  const serviceAccounts = data || [];
  const errorMessage = error ? handleApiError(error) : null;

  const isApiKeyRevoked = (apiKey: ApiKey) => {
    return apiKey.revoked_at !== null && apiKey.revoked_at !== undefined;
  };

  const handleRevokeApiKey = (serviceAccountId: string, apiKeyId: string) => {
    if (confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      revokeMutation.mutate({ serviceAccountId, apiKeyId });
    }
  };

  const handleDeleteServiceAccount = (serviceAccountId: string) => {
    if (confirm("Are you sure you want to delete this service account? This will also delete all associated API keys. This action cannot be undone.")) {
      deleteMutation.mutate(serviceAccountId);
    }
  };

  return (
    <>
      <Loader isLoading={isLoading} loadingMessage="Loading service accounts...">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold">Service Accounts</h2>
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                {serviceAccounts.length} account{serviceAccounts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Service Account
            </Button>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {errorMessage}
            </div>
          )}

          {serviceAccounts.length === 0 ? (
            <div className="text-center py-8">
              <Key className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No service accounts</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create a service account to generate API keys for programmatic access.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {serviceAccounts.map((serviceAccount) => (
                <div
                  key={serviceAccount.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {serviceAccount.name}
                        </h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {serviceAccount.api_keys.length} key{serviceAccount.api_keys.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {serviceAccount.id}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() =>
                          setCreateApiKeyModalState({
                            open: true,
                            serviceAccountId: serviceAccount.id,
                          })
                        }
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create API Key
                      </Button>
                      <Button
                        onClick={() => handleDeleteServiceAccount(serviceAccount.id)}
                        variant="destructive"
                        size="sm"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {serviceAccount.api_keys.length === 0 ? (
                    <div className="text-sm text-gray-500 py-2">
                      No API keys created yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700 mb-2">API Keys:</div>
                      {serviceAccount.api_keys.map((apiKey) => (
                        <div
                          key={apiKey.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isApiKeyRevoked(apiKey)
                              ? "bg-gray-50 border-gray-200 opacity-60"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-sm text-gray-900">
                                {apiKey.name}
                              </span>
                              {isApiKeyRevoked(apiKey) && (
                                <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                  Revoked
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                              <span className="font-mono">{apiKey.prefix}••••••••</span>
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  Created {new Date(apiKey.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {apiKey.last_used_at && (
                                <span>
                                  Last used {new Date(apiKey.last_used_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isApiKeyRevoked(apiKey) && (
                            <Button
                              onClick={() =>
                                handleRevokeApiKey(serviceAccount.id, apiKey.id)
                              }
                              variant="outline"
                              size="sm"
                              disabled={revokeMutation.isPending}
                              className="ml-4"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Loader>

      <CreateServiceAccountModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        organizationId={organizationId}
      />

      {createApiKeyModalState && (
        <CreateApiKeyModal
          open={createApiKeyModalState.open}
          onOpenChange={(open) => {
            if (!open) {
              setCreateApiKeyModalState(null);
            }
          }}
          serviceAccountId={createApiKeyModalState.serviceAccountId}
          organizationId={organizationId}
        />
      )}
    </>
  );
}

