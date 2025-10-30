import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useOrganizationStore } from "@/stores/organizationStore";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { api, handleApiError } from "@/lib/api";
import { Workflow, WorkflowCreate } from "@/types/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { showSuccessNotification, showErrorNotification } from "@/stores/notificationStore";
import { Plus, Search, Workflow as WorkflowIcon, Calendar, User, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/workflows")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { currentOrganization } = useOrganizationStore();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, [currentOrganization]);

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

  const handleCreateWorkflow = async (data: WorkflowCreate) => {
    try {
      const newWorkflow = await api.post<Workflow>("/workflows", data);
      setWorkflows([newWorkflow, ...workflows]);
      setShowCreateForm(false);
      showSuccessNotification("Workflow created", `"${newWorkflow.name}" has been created successfully.`);
    } catch (error) {
      throw error; // Let the form handle the error
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    const workflow = workflows.find(w => w.id === id);
    if (!confirm(`Are you sure you want to delete "${workflow?.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/workflows/${id}`);
      setWorkflows(workflows.filter(w => w.id !== id));
      showSuccessNotification("Workflow deleted", `"${workflow?.name}" has been deleted successfully.`);
    } catch (error) {
      showErrorNotification("Failed to delete workflow", handleApiError(error));
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-600 mt-1">
            {currentOrganization
              ? `Manage workflows in ${currentOrganization.display_name}`
              : "Manage your workflows"
            }
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Create Workflow</span>
        </button>
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
            {searchTerm ? "No workflows match your search." : "Get started by creating a new workflow."}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700"
            >
              <Plus className="-ml-1 mr-2 h-4 w-4" />
              Create Workflow
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onDelete={handleDeleteWorkflow}
            />
          ))}
        </div>
      )}

      {/* Create workflow modal */}
      {showCreateForm && (
        <CreateWorkflowModal
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateWorkflow}
        />
      )}
    </div>
  );
}

interface WorkflowCardProps {
  workflow: Workflow;
  onDelete: (id: string) => void;
}

function WorkflowCard({ workflow, onDelete }: WorkflowCardProps) {
  const formattedDate = new Date(workflow.created_at).toLocaleDateString();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-2">
          <WorkflowIcon className="h-5 w-5 text-sky-600" />
          <h3 className="font-semibold text-lg text-gray-900">{workflow.name}</h3>
        </div>
        <button
          onClick={() => onDelete(workflow.id)}
          className="text-gray-400 hover:text-red-500 text-sm"
        >
          Delete
        </button>
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

interface CreateWorkflowModalProps {
  onClose: () => void;
  onSubmit: (data: WorkflowCreate) => Promise<void>;
}

function CreateWorkflowModal({ onClose, onSubmit }: CreateWorkflowModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [namespaceId, setNamespaceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { namespaces, fetchNamespaces, isLoading: namespacesLoading } = useNamespaceStore();

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !namespaceId) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        namespace_id: namespaceId,
      });
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create New Workflow</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              placeholder="Enter workflow name"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              placeholder="Enter workflow description"
            />
          </div>

          <div>
            <label htmlFor="namespace" className="block text-sm font-medium text-gray-700 mb-1">
              Namespace *
            </label>
            {namespacesLoading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Loading namespaces...
              </div>
            ) : namespaces.length === 0 ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                No namespaces available
              </div>
            ) : (
              <div className="relative">
                <select
                  id="namespace"
                  value={namespaceId}
                  onChange={(e) => setNamespaceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent appearance-none bg-white"
                  required
                >
                  <option value="">Select a namespace</option>
                  {namespaces.map((namespace) => (
                    <option key={namespace.id} value={namespace.id}>
                      {namespace.display_name} ({namespace.name})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Choose the namespace for this workflow
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !namespaceId || isSubmitting}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}