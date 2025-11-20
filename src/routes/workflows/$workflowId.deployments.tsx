import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Code, Package, Activity, Settings } from "lucide-react";
import { api, handleApiError } from "@/lib/api";
import { Workflow } from "@/types/api";
import { Loader } from "@/components/Loader";
import { DeploymentEditor } from "@/components/DeploymentEditor";
import { DeploymentHistory } from "@/components/DeploymentHistory";
import { ExecutionHistory } from "@/components/ExecutionHistory";
import { WorkflowConfiguration } from "@/components/WorkflowConfiguration";
import { useNamespaceStore } from "@/stores/namespaceStore";

export const Route = createFileRoute("/workflows/$workflowId/deployments")({
  component: DeploymentsPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as "edit" | "deployments" | "executions" | "config") || "edit",
    };
  },
});

function DeploymentsPage() {
  const { workflowId } = Route.useParams();
  const { tab } = Route.useSearch();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  // Check if we're on a child route (like /edit)
  const isOnChildRoute = pathname.includes('/deployments/') &&
    pathname.split('/deployments/')[1] !== '';

  // If we're on a child route, just render the outlet
  if (isOnChildRoute) {
    return <Outlet />;
  }

  const [activeTab, setActiveTab] = useState<"edit" | "deployments" | "executions" | "config">((tab || "edit") as "edit" | "deployments" | "executions" | "config");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const { currentNamespace } = useNamespaceStore();

  // Fetch workflow to get the name
  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: async () => {
      return await api.get<Workflow>(`/workflows/${workflowId}`);
    },
  });

  const errorMessage = error ? handleApiError(error) : null;

  const handleEdit = (deploymentId: string) => {
    setSelectedDeploymentId(deploymentId);
    setActiveTab("edit");
  };

  const handleSave = () => {
    // Refresh after save
    setSelectedDeploymentId(null);
  };

  return (
    <Loader isLoading={isLoading} loadingMessage="Loading workflow...">
      <div className="space-y-6">
        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link
            to="/workflows"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {workflow?.name || "Workflow"}
            </h1>
            {workflow?.description && (
              <p className="text-muted-foreground mt-1">{workflow.description}</p>
            )}
          </div>
        </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          <Link
            {...({
              to: "/workflows/$workflowId/deployments",
              params: { workflowId },
              search: { tab: "edit" },
              className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "edit"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`
            } as any)}
            onClick={() => setActiveTab("edit")}
          >
            <div className="flex items-center space-x-2">
              <Code className="h-4 w-4" />
              <span>Edit Code</span>
            </div>
          </Link>
          <Link
            {...({
              to: "/workflows/$workflowId/deployments",
              params: { workflowId },
              search: { tab: "deployments" },
              className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "deployments"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`
            } as any)}
            onClick={() => setActiveTab("deployments")}
          >
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Deployments</span>
            </div>
          </Link>
          <Link
            {...({
              to: "/workflows/$workflowId/deployments",
              params: { workflowId },
              search: { tab: "executions" },
              className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "executions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`
            } as any)}
            onClick={() => setActiveTab("executions")}
          >
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Executions</span>
            </div>
          </Link>
          <Link
            {...({
              to: "/workflows/$workflowId/deployments",
              params: { workflowId },
              search: { tab: "config" },
              className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "config"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`
            } as any)}
            onClick={() => setActiveTab("config")}
          >
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Configuration</span>
            </div>
          </Link>
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === "edit" ? (
          <DeploymentEditor
            workflowId={workflowId}
            deploymentId={selectedDeploymentId || undefined}
            onSave={handleSave}
          />
        ) : activeTab === "deployments" ? (
          <DeploymentHistory
            workflowId={workflowId}
            onEdit={handleEdit}
          />
        ) : activeTab === "executions" ? (
          <ExecutionHistory
            workflowId={workflowId}
          />
        ) : activeTab === "config" ? (
          workflow && currentNamespace ? (
            <WorkflowConfiguration
              workflow={workflow}
              namespaceId={currentNamespace.id}
            />
          ) : null
        ) : null}
      </div>

        {/* Render child routes */}
        <Outlet />
      </div>
    </Loader>
  );
}

