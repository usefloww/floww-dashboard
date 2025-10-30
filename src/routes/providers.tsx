import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { api, handleApiError } from "@/lib/api";
import { Provider } from "@/types/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Search, Building2, Globe, Zap, CheckCircle, XCircle, Clock, Info } from "lucide-react";

export const Route = createFileRoute("/providers")({
  component: ProvidersPage,
});

function ProvidersPage() {
  const { currentNamespace } = useNamespaceStore();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchProviders();
  }, [currentNamespace]);

  const fetchProviders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<Provider[]>("/providers");
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      setError(handleApiError(error));
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProviders = Array.isArray(providers)
    ? providers.filter(provider =>
        provider?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider?.type?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  if (isLoading) {
    return <LoadingScreen>Loading providers...</LoadingScreen>;
  }

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
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Providers list */}
      {filteredProviders.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No providers</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? "No providers match your search." : "No providers found in this namespace."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProviderCardProps {
  provider: Provider;
}

function ProviderCard({ provider }: ProviderCardProps) {
  const formattedDate = new Date(provider.created_at).toLocaleDateString();
  const lastUsedDate = provider.last_used_at ? new Date(provider.last_used_at).toLocaleDateString() : 'Never';

  const getStatusIcon = (status: Provider['status']) => {
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

  const getStatusColor = (status: Provider['status']) => {
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

  const getProviderIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'aws':
      case 'gcp':
      case 'azure':
        return <Globe className="h-5 w-5 text-sky-600" />;
      case 'github':
      case 'gitlab':
        return <Zap className="h-5 w-5 text-sky-600" />;
      default:
        return <Building2 className="h-5 w-5 text-sky-600" />;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {getProviderIcon(provider.type)}
          <h3 className="font-semibold text-lg text-gray-900">{provider.name}</h3>
        </div>
        <div className="flex items-center space-x-1">
          {getStatusIcon(provider.status)}
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(provider.status)}`}>
            {provider.status}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="font-medium">{provider.type}</span>
        </div>
        <div className="flex justify-between">
          <span>Created:</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex justify-between">
          <span>Last used:</span>
          <span>{lastUsedDate}</span>
        </div>
      </div>
    </div>
  );
}