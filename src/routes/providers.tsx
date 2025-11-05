import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { api, handleApiError } from "@/lib/api";
import { Provider } from "@/types/api";
import { Loader } from "@/components/Loader";
import { Search, Building2, CheckCircle, XCircle, Clock, Info } from "lucide-react";

// Provider logo mapping to Simple Icons CDN
const getProviderLogoUrl = (type: string): string | null => {
  const iconMap: Record<string, string> = {
    "openai": "openai",
    'aws': 'amazonaws',
    'gcp': 'googlecloud',
    'googlecloud': 'googlecloud',
    'azure': 'microsoftazure',
    'microsoftazure': 'microsoftazure',
    'github': 'github',
    'gitlab': 'gitlab',
    'docker': 'docker',
    'kubernetes': 'kubernetes',
    'terraform': 'terraform',
    'slack': 'slack',
    'discord': 'discord',
    'jenkins': 'jenkins',
    'circleci': 'circleci',
    'githubactions': 'githubactions',
  };

  const iconName = iconMap[type.toLowerCase()];
  if (!iconName) return null;
  
  return `https://cdn.simpleicons.org/${iconName}`;
};

export const Route = createFileRoute("/providers")({
  component: ProvidersPage,
});

function ProvidersPage() {
  const { currentNamespace } = useNamespaceStore();
  const [searchTerm, setSearchTerm] = useState("");

  // Use TanStack Query to fetch providers
  const { data, isLoading, error } = useQuery({
    queryKey: ['providers', currentNamespace?.id],
    queryFn: async () => {
      const params = currentNamespace?.id ? { namespace_id: currentNamespace.id } : undefined;
      const data = await api.get<{ results: Provider[] }>("/providers", { params });
      return Array.isArray(data?.results) ? data.results : [];
    },
  });

  const providers = data || [];
  const errorMessage = error ? handleApiError(error) : null;

  const filteredProviders = Array.isArray(providers)
    ? providers.filter(provider =>
        (provider?.alias || provider?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider?.type?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Providers</h1>
          <p className="text-gray-600 mt-1">
            {currentNamespace?.organization
              ? `View providers in ${currentNamespace.organization.display_name}`
              : "View your providers"
            }
          </p>
        </div>

        {/* Read-only notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Read-only Mode</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            Currently viewing providers in read-only mode. Provider creation and configuration is not available.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
          placeholder="Search providers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Providers list */}
      <Loader isLoading={isLoading} loadingMessage="Loading providers...">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No providers</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? "No providers match your search." : "No providers found in this namespace."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
              />
            ))}
          </div>
        )}
      </Loader>
    </div>
  );
}

interface ProviderCardProps {
  provider: Provider;
}

function ProviderCard({ provider }: ProviderCardProps) {
  const providerName = provider.alias || provider.name || 'Unnamed Provider';
  const formattedDate = provider.created_at ? new Date(provider.created_at).toLocaleDateString() : 'N/A';
  const lastUsedDate = provider.last_used_at ? new Date(provider.last_used_at).toLocaleDateString() : 'Never';
  const status = provider.status || 'pending';
  const logoUrl = getProviderLogoUrl(provider.type);
  const [imageError, setImageError] = useState(false);

  // Reset image error when provider or logo URL changes
  useEffect(() => {
    setImageError(false);
  }, [provider.id, logoUrl]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-700 bg-green-50';
      case 'disconnected':
        return 'text-red-700 bg-red-50';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          {/* Provider Logo */}
          <div className="flex-shrink-0">
            {logoUrl && !imageError ? (
              <img
                src={logoUrl}
                alt={provider.type}
                className="h-10 w-10 object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <Building2 className="h-10 w-10 text-gray-400" />
            )}
          </div>
          
          {/* Provider Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <h3 className="font-semibold text-lg text-gray-900 truncate">{providerName}</h3>
              <span className="text-sm text-gray-500 uppercase">{provider.type}</span>
            </div>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
              <span>Created: {formattedDate}</span>
              <span>Last used: {lastUsedDate}</span>
            </div>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
            {getStatusIcon(status)}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(status)}`}>
              {status}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}