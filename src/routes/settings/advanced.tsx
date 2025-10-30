import { createFileRoute } from "@tanstack/react-router";
import { Key, Shield, Database, Code, Webhook } from "lucide-react";

export const Route = createFileRoute("/settings/advanced")({
  component: AdvancedSettings,
});

function AdvancedSettings() {
  return (
    <div className="space-y-6">
      {/* API Keys */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Key className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold">API Keys</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Coming Soon</span>
        </div>
        <p className="text-gray-500 text-sm">
          Create and manage API keys for programmatic access to Floww.
        </p>
      </div>

      {/* Webhooks */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Webhook className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Coming Soon</span>
        </div>
        <p className="text-gray-500 text-sm">
          Configure webhooks to receive notifications about workflow events.
        </p>
      </div>

      {/* Data Export */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Database className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Data Export</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Coming Soon</span>
        </div>
        <p className="text-gray-500 text-sm">
          Export your organization's data for backup or migration purposes.
        </p>
      </div>

      {/* Audit Logs */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Shield className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Audit Logs</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Coming Soon</span>
        </div>
        <p className="text-gray-500 text-sm">
          View audit logs for security and compliance tracking.
        </p>
      </div>

      {/* Developer Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Code className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Developer Settings</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Coming Soon</span>
        </div>
        <p className="text-gray-500 text-sm">
          Advanced configuration options for developers and integrations.
        </p>
      </div>
    </div>
  );
}