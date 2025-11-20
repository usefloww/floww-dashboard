import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { api, handleApiError } from "@/lib/api";
import { Provider } from "@/types/api";
import { Loader } from "@/components/Loader";
import { Search, Building2, CheckCircle, XCircle, Clock, MoreVertical, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProviderConfigModal } from "@/components/ProviderConfigModal";
import { DeleteProviderDialog } from "@/components/DeleteProviderDialog";

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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

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

  const handleConfigure = (provider: Provider) => {
    setSelectedProvider(provider);
    setEditModalOpen(true);
  };

  const handleDelete = (provider: Provider) => {
    setSelectedProvider(provider);
    setDeleteDialogOpen(true);
  };

  const handleCreateClick = () => {
    setSelectedProvider(null);
    setCreateModalOpen(true);
  };

  const handleEditModalClose = (open: boolean) => {
    setEditModalOpen(open);
    if (!open) {
      setSelectedProvider(null);
    }
  };

  const handleDeleteDialogClose = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setSelectedProvider(null);
    }
  };

  const handleCreateModalClose = (open: boolean) => {
    setCreateModalOpen(open);
    if (!open) {
      setSelectedProvider(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Providers</h1>
          <Button onClick={handleCreateClick}>
            Create Provider
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <input
          type="text"
          placeholder="Search providers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
        />
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Providers list */}
      <Loader isLoading={isLoading} loadingMessage="Loading providers...">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">No providers</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm ? "No providers match your search." : "No providers found in this namespace."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onConfigure={() => handleConfigure(provider)}
                onDelete={() => handleDelete(provider)}
              />
            ))}
          </div>
        )}
      </Loader>

      {/* Modals */}
      {currentNamespace && (
        <>
          <ProviderConfigModal
            open={createModalOpen}
            onOpenChange={handleCreateModalClose}
            namespaceId={currentNamespace.id}
          />
          <ProviderConfigModal
            open={editModalOpen}
            onOpenChange={handleEditModalClose}
            provider={selectedProvider}
            namespaceId={currentNamespace.id}
          />
          <DeleteProviderDialog
            open={deleteDialogOpen}
            onOpenChange={handleDeleteDialogClose}
            provider={selectedProvider}
            namespaceId={currentNamespace.id}
          />
        </>
      )}
    </div>
  );
}

interface ProviderCardProps {
  provider: Provider;
  onConfigure: () => void;
  onDelete: () => void;
}

function ProviderCard({ provider, onConfigure, onDelete }: ProviderCardProps) {
  const providerName = provider.alias || provider.name || 'Unnamed Provider';
  const formattedDate = provider.created_at ? new Date(provider.created_at).toLocaleDateString() : 'N/A';
  const lastUsedDate = provider.last_used_at ? new Date(provider.last_used_at).toLocaleDateString() : 'Never';
  const status = 'connected';
  const logoUrl = getProviderLogoUrl(provider.type);
  const [imageError, setImageError] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Reset image error when provider or logo URL changes
  useEffect(() => {
    setImageError(false);
  }, [provider.id, logoUrl]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-700 bg-green-50 dark:bg-green-900/30';
      case 'disconnected':
        return 'text-red-700 bg-red-50 dark:bg-red-900/30';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30';
      default:
        return 'text-foreground bg-muted';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
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
              <Building2 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          
          {/* Provider Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <h3 className="font-semibold text-lg text-foreground truncate">{providerName}</h3>
              <span className="text-sm text-muted-foreground uppercase">{provider.type}</span>
            </div>
            <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
              <span>Created: {formattedDate}</span>
              <span>Last used: {lastUsedDate}</span>
            </div>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
          {status && (
            <div className="flex items-center space-x-2">
              {getStatusIcon(status)}
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(status)}`}>
                {status}
              </span>
            </div>
          )}
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setDropdownOpen(false);
                  onConfigure();
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setDropdownOpen(false);
                  onDelete();
                }}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}