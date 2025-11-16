import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { api, handleApiError } from "@/lib/api";
import { Workflow } from "@/types/api";
import { Loader } from "@/components/Loader";
import { Search, Workflow as WorkflowIcon, Calendar, User, Clock } from "lucide-react";

export const Route = createFileRoute("/workflows/")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  console.log("WorkflowsPage loaded");
  const { currentNamespace } = useNamespaceStore();
  const [searchTerm, setSearchTerm] = useState("");

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
              />
            ))}
          </div>
        )}
      </Loader>

    </div>
  );
}

interface WorkflowCardProps {
  workflow: Workflow;
}

function WorkflowCard({ workflow }: WorkflowCardProps) {
  const formattedDate = new Date(workflow.created_at).toLocaleDateString();
  const lastDeployedDate = workflow.last_deployed_at 
    ? new Date(workflow.last_deployed_at).toLocaleDateString() 
    : null;

  return (
    <Link
      {...({ to: "/workflows/$workflowId/deployments", params: { workflowId: workflow.id }, className: "block" } as any)}
    >
      <div className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {/* Workflow Icon */}
            <div className="flex-shrink-0">
              <WorkflowIcon className="h-10 w-10 text-primary" />
            </div>
            
            {/* Workflow Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-foreground truncate">{workflow.name}</h3>
              {workflow.description && (
                <p className="text-muted-foreground text-sm mt-1 line-clamp-1">
                  {workflow.description}
                </p>
              )}
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>Created: {formattedDate}</span>
                </div>
                {lastDeployedDate && (
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>Last deployed: {lastDeployedDate}</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <User className="h-3 w-3" />
                  <span>Creator: {workflow.created_by_id.slice(0, 8)}...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}