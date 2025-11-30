import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { api, handleApiError, updateWorkflow } from "@/lib/api";
import { Workflow } from "@/types/api";
import { Loader } from "@/components/Loader";
import { Search, Workflow as WorkflowIcon, MoreVertical, Trash2, Building2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { DeleteWorkflowDialog } from "@/components/DeleteWorkflowDialog";
import { showSuccessNotification, showErrorNotification } from "@/stores/notificationStore";

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

export const Route = createFileRoute("/workflows/")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  console.log("WorkflowsPage loaded");
  const { currentNamespace } = useNamespaceStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  // Use TanStack Query to fetch workflows
  const { data, isLoading, error } = useQuery({
    queryKey: ['workflows', currentNamespace?.id],
    queryFn: async () => {
      console.log("fetchWorkflows via useQuery");
      const params = currentNamespace?.id ? { namespace_id: currentNamespace.id } : undefined;
      console.log("params", params);
      const data = await api.get<{ results: Workflow[] }>("/workflows", { params });
      return Array.isArray(data?.results) ? data.results : [];
    },
  });

  const workflows = data || [];
  const errorMessage = error ? handleApiError(error) : null;

  const filteredWorkflows = Array.isArray(workflows)
    ? workflows.filter(workflow =>
        workflow?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (workflow?.description && workflow.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  const handleDelete = (workflow: Workflow, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedWorkflow(workflow);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogClose = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setSelectedWorkflow(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Workflows</h1>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <input
          type="text"
          placeholder="Search workflows..."
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

      {/* Workflows list */}
      <Loader isLoading={isLoading} loadingMessage="Loading workflows...">
        {filteredWorkflows.length === 0 ? (
          <div className="text-center py-12">
            <WorkflowIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">No workflows</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm ? "No workflows match your search." : "No workflows found in this namespace."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </Loader>

      {/* Delete Dialog */}
      {currentNamespace && (
        <DeleteWorkflowDialog
          open={deleteDialogOpen}
          onOpenChange={handleDeleteDialogClose}
          workflow={selectedWorkflow}
          namespaceId={currentNamespace.id}
        />
      )}
    </div>
  );
}

interface WorkflowCardProps {
  workflow: Workflow;
  onDelete: (workflow: Workflow, e: React.MouseEvent) => void;
}

function WorkflowCard({ workflow, onDelete }: WorkflowCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { currentNamespace } = useNamespaceStore();

  // Extract unique provider types from last_deployment, filtering out "builtin"
  const providerTypes = workflow.last_deployment?.provider_definitions
    ? Array.from(
        new Set(
          workflow.last_deployment.provider_definitions
            .map((p) => p.type)
            .filter((type) => type.toLowerCase() !== "builtin")
        )
      )
    : [];

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return "just now";
    if (diffMinutes === 1) return "1 minute ago";
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "1 week ago";
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 60) return "1 month ago";
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const lastDeployedRelative = workflow.last_deployment?.deployed_at
    ? formatRelativeTime(new Date(workflow.last_deployment.deployed_at))
    : null;
  const createdDate = formatDate(workflow.created_at);

  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      return await updateWorkflow(workflow.id, { active });
    },
    onSuccess: (_, active) => {
      queryClient.invalidateQueries({ queryKey: ['workflows', currentNamespace?.id] });
      showSuccessNotification(
        `Workflow ${active ? 'activated' : 'deactivated'}`,
        `The workflow has been ${active ? 'activated' : 'deactivated'} successfully.`
      );
    },
    onError: (error) => {
      const errorMessage = handleApiError(error);
      showErrorNotification("Failed to update workflow status", errorMessage);
    },
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate(checked);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <Link
          {...({ to: "/workflows/$workflowId/deployments", params: { workflowId: workflow.id }, className: "flex-1 min-w-0" } as any)}
        >
          {/* Workflow Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-lg text-foreground truncate">{workflow.name}</h3>
              {workflow.description && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent 
                    className="bg-popover text-popover-foreground border border-border"
                    arrowClassName="bg-popover fill-popover"
                  >
                    <p className="max-w-xs">{workflow.description}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center space-x-2 mt-1 text-sm text-muted-foreground">
              {lastDeployedRelative && (
                <>
                  <span>Last deployed {lastDeployedRelative}</span>
                  {providerTypes.length > 0 && (
                    <>
                      <span>|</span>
                      <div className="flex items-center space-x-1.5">
                        {providerTypes.map((providerType) => {
                          const logoUrl = getProviderLogoUrl(providerType);
                          return (
                            <div
                              key={providerType}
                              className="flex items-center justify-center h-4 w-4 rounded"
                              title={providerType}
                            >
                              {logoUrl && !imageErrors.has(providerType) ? (
                                <img
                                  src={logoUrl}
                                  alt={providerType}
                                  className="h-4 w-4 object-contain opacity-70"
                                  onError={() => {
                                    setImageErrors((prev) => new Set(prev).add(providerType));
                                  }}
                                />
                              ) : (
                                <Building2 className="h-3 w-3 text-muted-foreground opacity-50" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
              <span>|</span>
              <span>Created {createdDate}</span>
            </div>
          </div>
        </Link>

        {/* Status Toggle */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
          {(!workflow.last_deployment || workflow.active === null || workflow.active === undefined) ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Switch
                    checked={workflow.active ?? false}
                    onCheckedChange={handleToggle}
                    disabled={true}
                    aria-label="Workflow status unavailable (no deployment)"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent 
                className="bg-popover text-popover-foreground border border-border"
                arrowClassName="bg-popover fill-popover"
              >
                <p>Cannot activate workflow: no deployment exists</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Switch
              checked={workflow.active ?? false}
              onCheckedChange={handleToggle}
              disabled={toggleMutation.isPending}
              aria-label={`Toggle workflow ${workflow.active ? 'inactive' : 'active'}`}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 ml-2">
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  setDropdownOpen(false);
                  onDelete(workflow, e);
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