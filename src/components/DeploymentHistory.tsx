import { useState, useEffect } from "react";
import { api, handleApiError } from "@/lib/api";
import { WorkflowDeployment, WorkflowDeploymentsResponse } from "@/types/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MoreVertical, Edit2, Trash2 } from "lucide-react";

interface DeploymentHistoryProps {
  workflowId: string;
  onEdit?: (deploymentId: string) => void;
}

export function DeploymentHistory({ workflowId, onEdit }: DeploymentHistoryProps) {
  const [deployments, setDeployments] = useState<WorkflowDeployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, [workflowId]);

  const fetchDeployments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = { workflow_id: workflowId };
      const data = await api.get<WorkflowDeploymentsResponse>("/workflow_deployments", { params });
      const sorted = (data.deployments || []).sort(
        (a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime()
      );
      setDeployments(sorted);
    } catch (error) {
      setError(handleApiError(error));
      setDeployments([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen>Loading deployments...</LoadingScreen>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="mt-2 text-sm font-medium text-gray-900">No deployments</h3>
        <p className="mt-1 text-sm text-gray-500">
          No deployments found for this workflow.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deployments.map((deployment, index) => (
        <DeploymentCard
          key={deployment.id}
          deployment={deployment}
          versionNumber={deployments.length - index}
          isDropdownOpen={openDropdown === deployment.id}
          onDropdownToggle={(isOpen) => setOpenDropdown(isOpen ? deployment.id : null)}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

interface DeploymentCardProps {
  deployment: WorkflowDeployment;
  versionNumber: number;
  isDropdownOpen: boolean;
  onDropdownToggle: (isOpen: boolean) => void;
  onEdit?: (deploymentId: string) => void;
}

function DeploymentCard({ 
  deployment, 
  versionNumber, 
  isDropdownOpen,
  onDropdownToggle,
  onEdit 
}: DeploymentCardProps) {
  // Format timestamp with seconds: YYYY-MM-DD HH:MM:SS
  const deployedTimestamp = new Date(deployment.deployed_at).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(',', '');
  
  const versionLabel = `version ${versionNumber}`;

  const handleEdit = () => {
    onDropdownToggle(false);
    if (onEdit) {
      onEdit(deployment.id);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900">{versionLabel}</h3>
          <p className="text-xs text-gray-500 mt-0.5">created_at: {deployedTimestamp}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => onDropdownToggle(!isDropdownOpen)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => onDropdownToggle(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 rounded-t-lg"
                  onClick={handleEdit}
                >
                  <Edit2 className="h-4 w-4" />
                  <span>Edit</span>
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center space-x-2 rounded-b-lg"
                  onClick={() => {
                    onDropdownToggle(false);
                    // TODO: Handle delete
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

