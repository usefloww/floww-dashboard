import { useState, useEffect } from "react";
import { api, handleApiError } from "@/lib/api";
import { WorkflowDeployment, WorkflowDeploymentsResponse, WorkflowDeploymentStatus } from "@/types/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Save, X, Loader2 } from "lucide-react";
import Editor from "@monaco-editor/react";
import { showSuccessNotification, showErrorNotification } from "@/stores/notificationStore";

interface DeploymentEditorProps {
  workflowId: string;
  deploymentId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function DeploymentEditor({ workflowId, deploymentId, onSave, onCancel }: DeploymentEditorProps) {
  const [deployment, setDeployment] = useState<WorkflowDeployment | null>(null);
  const [allDeployments, setAllDeployments] = useState<WorkflowDeployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<Record<string, string>>({});
  const [entrypoint, setEntrypoint] = useState<string>("");
  const [currentFile, setCurrentFile] = useState<string>("");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(deploymentId || null);

  useEffect(() => {
    fetchDeployments();
  }, [workflowId]);

  useEffect(() => {
    if (allDeployments.length > 0 && !deployment) {
      if (deploymentId && allDeployments.find(d => d.id === deploymentId)) {
        // Use the provided deploymentId if it exists
        setSelectedDeploymentId(deploymentId);
        fetchDeployment(deploymentId);
      } else if (!selectedDeploymentId) {
        // Default to latest deployment
        const latest = allDeployments.sort(
          (a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime()
        )[0];
        setSelectedDeploymentId(latest.id);
        fetchDeployment(latest.id);
      }
    }
  }, [allDeployments, deploymentId]);

  useEffect(() => {
    if (selectedDeploymentId && (!deployment || deployment.id !== selectedDeploymentId)) {
      fetchDeployment(selectedDeploymentId);
    }
  }, [selectedDeploymentId]);

  const fetchDeployments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = { workflow_id: workflowId };
      const data = await api.get<WorkflowDeploymentsResponse>("/workflow_deployments", { params });
      const sorted = (data.deployments || []).sort(
        (a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime()
      );
      setAllDeployments(sorted);
      
      // If no deploymentId provided, use latest
      if (!deploymentId && sorted.length > 0) {
        setSelectedDeploymentId(sorted[0].id);
      }
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeployment = async (id: string) => {
    try {
      setError(null);
      const data = await api.get<WorkflowDeployment>(`/workflow_deployments/${id}`);
      setDeployment(data);
      
      // Filter to only TypeScript/JavaScript files
      const allFiles = data.user_code?.files || {};
      const tsFiles: Record<string, string> = {};
      Object.keys(allFiles).forEach((fileName) => {
        if (
          fileName.endsWith('.ts') ||
          fileName.endsWith('.tsx') ||
          fileName.endsWith('.js') ||
          fileName.endsWith('.jsx')
        ) {
          tsFiles[fileName] = allFiles[fileName];
        }
      });
      
      setCode(tsFiles);
      const initialEntrypoint = data.user_code?.entrypoint || "";
      const initialFile = 
        (initialEntrypoint && (initialEntrypoint.endsWith('.ts') || initialEntrypoint.endsWith('.tsx') || initialEntrypoint.endsWith('.js') || initialEntrypoint.endsWith('.jsx')) && tsFiles[initialEntrypoint])
          ? initialEntrypoint
          : Object.keys(tsFiles)[0] || "";
      
      setEntrypoint(initialFile);
      setCurrentFile(initialFile);
    } catch (error) {
      setError(handleApiError(error));
    }
  };

  const handleSave = async () => {
    if (!deployment) return;

    try {
      setIsSaving(true);
      setError(null);
      
      // Get all files from original deployment to preserve non-TS files
      const allFiles = {
        ...deployment.user_code.files,
        ...code,
      };

      // Create a new deployment instead of updating
      const deploymentData = {
        workflow_id: workflowId,
        runtime_id: deployment.runtime_id,
        code: {
          files: allFiles,
          entrypoint: currentFile || entrypoint,
        },
      };

      await api.post("/workflow_deployments", deploymentData);

      // Show success notification
      showSuccessNotification(
        "New version created",
        "Your deployment has been saved as a new version."
      );

      // Refresh deployments list
      await fetchDeployments();
      
      // Reset to show the new deployment
      setSelectedDeploymentId(null);

      if (onSave) {
        onSave();
      }
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      showErrorNotification(
        "Failed to save deployment",
        errorMessage
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen>Loading deployment...</LoadingScreen>;
  }

  if (!deployment) {
    return (
      <div className="text-center py-12">
        <h3 className="mt-2 text-sm font-medium text-gray-900">No deployment found</h3>
        <p className="mt-1 text-sm text-gray-500">
          No deployment found for this workflow.
        </p>
      </div>
    );
  }

  const currentFileContent = code[currentFile] || "";
  const tsFileNames = Object.keys(code);

  if (tsFileNames.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="mt-2 text-sm font-medium text-gray-900">No TypeScript files</h3>
        <p className="mt-1 text-sm text-gray-500">
          This deployment doesn't contain any TypeScript files to edit.
        </p>
      </div>
    );
  }

  // Format deployment date for dropdown
  const formatDeploymentDate = (deployment: WorkflowDeployment) => {
    const date = new Date(deployment.deployed_at);
    return `Version ${deployment.id.slice(0, 8)} - ${date.toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Version Selector and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700">Version:</label>
          <select
            value={selectedDeploymentId || ""}
            onChange={(e) => setSelectedDeploymentId(e.target.value)}
            disabled={isSaving}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allDeployments.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {formatDeploymentDate(dep)} {dep.status === WorkflowDeploymentStatus.ACTIVE ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center space-x-3">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save as New Version</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Saving indicator */}
      {isSaving && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center space-x-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <div>
            <p className="text-sm font-medium text-blue-900">Creating new version...</p>
            <p className="text-xs text-blue-700 mt-0.5">Please wait while we save your changes</p>
          </div>
        </div>
      )}

      {/* Monaco Editor with Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* File Tabs */}
        {tsFileNames.length > 1 && (
          <div className="border-b border-gray-200 bg-gray-50 flex overflow-x-auto">
            {tsFileNames.map((fileName) => (
              <button
                key={fileName}
                onClick={() => setCurrentFile(fileName)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  fileName === currentFile
                    ? "border-sky-500 text-sky-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                {fileName}
              </button>
            ))}
          </div>
        )}
        
        {/* Single file indicator when only one file */}
        {tsFileNames.length === 1 && (
          <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">{tsFileNames[0]}</span>
          </div>
        )}

        {/* Editor */}
        <Editor
          height="600px"
          defaultLanguage="typescript"
          value={currentFileContent}
          onChange={(value) => {
            setCode({
              ...code,
              [currentFile]: value || "",
            });
          }}
          theme="vs-light"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}

