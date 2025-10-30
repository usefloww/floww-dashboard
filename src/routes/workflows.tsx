import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { api, handleApiError } from "@/lib/api";
import { Workflow } from "@/types/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Search, Workflow as WorkflowIcon, Calendar, User, Info } from "lucide-react";

export const Route = createFileRoute("/workflows")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { currentNamespace } = useNamespaceStore();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchWorkflows();
  }, [currentNamespace]);

  const fetchWorkflows = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<Workflow[]>("/workflows");
      setWorkflows(Array.isArray(data) ? data : []);
    } catch (error) {
      setError(handleApiError(error));
      setWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  };


  const filteredWorkflows = Array.isArray(workflows)
    ? workflows.filter(workflow =>
        workflow?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (workflow?.description && workflow.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  if (isLoading) {
    return <LoadingScreen>Loading workflows...</LoadingScreen>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-600 mt-1">
            {currentNamespace?.organization
              ? `View workflows in ${currentNamespace.organization.display_name}`
              : "View your workflows"
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
            Currently viewing workflows in read-only mode. Workflow creation and editing is not available.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
          placeholder="Search workflows..."
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

      {/* Workflows list */}
      {filteredWorkflows.length === 0 ? (
        <div className="text-center py-12">
          <WorkflowIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No workflows</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? "No workflows match your search." : "No workflows found in this namespace."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
            />
          ))}
        </div>
      )}

    </div>
  );
}

interface WorkflowCardProps {
  workflow: Workflow;
}

function WorkflowCard({ workflow }: WorkflowCardProps) {
  const formattedDate = new Date(workflow.created_at).toLocaleDateString();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-2 mb-4">
        <WorkflowIcon className="h-5 w-5 text-sky-600" />
        <h3 className="font-semibold text-lg text-gray-900">{workflow.name}</h3>
      </div>

      {workflow.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {workflow.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-1">
          <Calendar className="h-3 w-3" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center space-x-1">
          <User className="h-3 w-3" />
          <span>{workflow.created_by_id.slice(0, 8)}...</span>
        </div>
      </div>
    </div>
  );
}