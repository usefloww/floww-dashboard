import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { api, handleApiError, updateWorkflow } from "@/lib/api";
import { Workflow, WorkflowCreate } from "@/types/api";
import { Loader } from "@/components/Loader";
import { Search, Workflow as WorkflowIcon, MoreVertical, Trash2, Building2, Info, Upload, Loader2, Plus, Sparkles } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface N8nImportResponse {
  workflow: Workflow;
  generated_code: string;
  message: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (n8nJson: object) => {
      if (!currentNamespace?.id) {
        throw new Error("No namespace selected");
      }
      return api.post<N8nImportResponse>("/workflows/import/n8n", {
        namespace_id: currentNamespace.id,
        n8n_json: n8nJson,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows', currentNamespace?.id] });
      showSuccessNotification(
        "Workflow imported",
        data.message
      );
    },
    onError: (error) => {
      showErrorNotification("Import failed", handleApiError(error));
    },
  });

  // Create workflow mutation for builder
  const createWorkflowMutation = useMutation({
    mutationFn: async () => {
      if (!currentNamespace?.id) {
        throw new Error("No namespace selected");
      }
      const data: WorkflowCreate = {
        name: "New Workflow",
        namespace_id: currentNamespace.id,
        description: "Created with AI Builder",
      };
      return api.post<Workflow>("/workflows", data);
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ['workflows', currentNamespace?.id] });
      // Navigate to the workflow with builder tab
      navigate({
        to: "/workflows/$workflowId/deployments",
        params: { workflowId: workflow.id },
        search: { tab: "builder" },
      } as any);
    },
    onError: (error) => {
      showErrorNotification("Failed to create workflow", handleApiError(error));
    },
  });

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleUseBuilder = () => {
    createWorkflowMutation.mutate();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      importMutation.mutate(json);
    } catch {
      showErrorNotification("Invalid file", "The selected file is not valid JSON");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

      {/* Search and Import */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={importMutation.isPending || createWorkflowMutation.isPending || !currentNamespace}
              className="gap-2"
            >
              {(importMutation.isPending || createWorkflowMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {importMutation.isPending ? "Importing..." : "Creating..."}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  New
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleUseBuilder}>
              <Sparkles className="h-4 w-4 mr-2" />
              Use builder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportClick}>
              <Upload className="h-4 w-4 mr-2" />
              Import from n8n
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Workflows table */}
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
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[40%]">Name</TableHead>
                  <TableHead>Providers</TableHead>
                  <TableHead>Last Deployed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkflows.map((workflow) => (
                  <WorkflowRow
                    key={workflow.id}
                    workflow={workflow}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>
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

interface WorkflowRowProps {
  workflow: Workflow;
  onDelete: (workflow: Workflow, e: React.MouseEvent) => void;
}

function WorkflowRow({ workflow, onDelete }: WorkflowRowProps) {
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
    if (diffMinutes === 1) return "1m ago";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours === 1) return "1h ago";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "1d ago";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 14) return "1w ago";
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 60) return "1mo ago";
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const lastDeployedRelative = workflow.last_deployment?.deployed_at
    ? formatRelativeTime(new Date(workflow.last_deployment.deployed_at))
    : "—";
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
    <TableRow className="group">
      {/* Name */}
      <TableCell>
        <Link
          {...({ to: "/workflows/$workflowId/deployments", params: { workflowId: workflow.id } } as any)}
          className="flex items-center gap-2 hover:text-primary transition-colors"
        >
          <span className="font-medium text-foreground truncate">{workflow.name}</span>
          {workflow.description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </TooltipTrigger>
              <TooltipContent 
                className="bg-popover text-popover-foreground border border-border"
                arrowClassName="bg-popover fill-popover"
              >
                <p className="max-w-xs">{workflow.description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </Link>
      </TableCell>

      {/* Providers */}
      <TableCell>
        {providerTypes.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {providerTypes.map((providerType) => {
              const logoUrl = getProviderLogoUrl(providerType);
              return (
                <Tooltip key={providerType}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-5 w-5 rounded">
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
                        <Building2 className="h-4 w-4 text-muted-foreground opacity-60" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="capitalize">{providerType}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Last Deployed */}
      <TableCell className="text-muted-foreground text-sm">
        {lastDeployedRelative}
      </TableCell>

      {/* Created */}
      <TableCell className="text-muted-foreground text-sm">
        {createdDate}
      </TableCell>

      {/* Active Toggle */}
      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
        {!workflow.last_deployment ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex">
                <Switch
                  checked={false}
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
              <p>Cannot activate: no deployment</p>
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
      </TableCell>

      {/* Actions */}
      <TableCell>
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
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
      </TableCell>
    </TableRow>
  );
}