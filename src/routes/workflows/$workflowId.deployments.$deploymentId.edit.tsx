import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, handleApiError } from "@/lib/api";
import { WorkflowDeployment } from "@/types/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ArrowLeft, Save, X } from "lucide-react";
import Editor from "@monaco-editor/react";

export const Route = createFileRoute("/workflows/$workflowId/deployments/$deploymentId/edit")({
  component: EditDeploymentPage,
});

function EditDeploymentPage() {
  const { workflowId, deploymentId } = Route.useParams();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState<WorkflowDeployment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<Record<string, string>>({});
  const [entrypoint, setEntrypoint] = useState<string>("");
  const [currentFile, setCurrentFile] = useState<string>("");

  useEffect(() => {
    fetchDeployment();
  }, [deploymentId]);

  const fetchDeployment = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<WorkflowDeployment>(`/workflow_deployments/${deploymentId}`);
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
      
      // Find the initial file to display (entrypoint if it's a TS file, or first TS file)
      const initialFile = 
        (initialEntrypoint && (initialEntrypoint.endsWith('.ts') || initialEntrypoint.endsWith('.tsx') || initialEntrypoint.endsWith('.js') || initialEntrypoint.endsWith('.jsx')) && tsFiles[initialEntrypoint])
          ? initialEntrypoint
          : Object.keys(tsFiles)[0] || "";
      
      setEntrypoint(initialFile);
      setCurrentFile(initialFile);
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!deployment) return;

    try {
      setIsSaving(true);
      setError(null);
      
      // Merge TS files back with original files to preserve non-TS files
      const allFiles = deployment.user_code?.files || {};
      const updatedFiles = { ...allFiles, ...code };
      
      await api.patch(`/workflow_deployments/${deploymentId}`, {
        user_code: {
          files: updatedFiles,
          entrypoint: currentFile || entrypoint,
        },
      });

      // Navigate back to deployments page
      navigate({
        to: "/workflows/$workflowId/deployments",
        params: { workflowId },
      });
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate({
      to: "/workflows/$workflowId/deployments",
      params: { workflowId },
    });
  };

  if (isLoading) {
    return <LoadingScreen>Loading deployment...</LoadingScreen>;
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900">Deployment not found</h3>
          <p className="mt-1 text-sm text-gray-500">The deployment you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Get the current file content
  const currentFileContent = code[currentFile] || "";

  // Get all TypeScript file names
  const tsFileNames = Object.keys(code);

  // If no TypeScript files, show a message
  if (tsFileNames.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900">No TypeScript files</h3>
          <p className="mt-1 text-sm text-gray-500">
            This deployment doesn't contain any TypeScript files to edit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            {...({
              to: "/workflows/$workflowId/deployments",
              params: { workflowId },
              className: "text-gray-600 hover:text-gray-900 transition-colors"
            } as any)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Deployment</h1>
            <p className="text-gray-600 mt-1">Edit deployment code</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
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

