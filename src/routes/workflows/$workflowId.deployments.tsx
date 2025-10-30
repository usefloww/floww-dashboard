import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Code, History } from "lucide-react";
import { DeploymentEditor } from "@/components/DeploymentEditor";
import { DeploymentHistory } from "@/components/DeploymentHistory";

export const Route = createFileRoute("/workflows/$workflowId/deployments")({
  component: DeploymentsPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as "edit" | "history") || "edit",
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

  const [activeTab, setActiveTab] = useState<"edit" | "history">((tab || "edit") as "edit" | "history");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);

  const handleEdit = (deploymentId: string) => {
    setSelectedDeploymentId(deploymentId);
    setActiveTab("edit");
  };

  const handleSave = () => {
    // Refresh after save
    setSelectedDeploymentId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          to="/workflows"
          className="text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deployments</h1>
          <p className="text-gray-600 mt-1">Edit and manage workflow deployments</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <Link
            {...({
              to: "/workflows/$workflowId/deployments",
              params: { workflowId },
              search: { tab: "edit" },
              className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "edit"
                  ? "border-sky-500 text-sky-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
              search: { tab: "history" },
              className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "history"
                  ? "border-sky-500 text-sky-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`
            } as any)}
            onClick={() => setActiveTab("history")}
          >
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>History</span>
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
        ) : (
          <DeploymentHistory
            workflowId={workflowId}
            onEdit={handleEdit}
          />
        )}
      </div>

      {/* Render child routes */}
      <Outlet />
    </div>
  );
}

