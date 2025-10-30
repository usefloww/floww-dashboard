import { createFileRoute } from "@tanstack/react-router";
import { Building2, Plus, Globe, Zap } from "lucide-react";

export const Route = createFileRoute("/providers")({
  component: ProvidersPage,
});

function ProvidersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Providers</h1>
          <p className="text-gray-600 mt-1">
            Connect and manage your cloud providers and services
          </p>
        </div>
        <button className="flex items-center space-x-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors">
          <Plus className="h-4 w-4" />
          <span>Add Provider</span>
        </button>
      </div>

      {/* Coming soon placeholder */}
      <div className="text-center py-16">
        <Building2 className="mx-auto h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Provider Management</h3>
        <p className="mt-2 text-gray-500 max-w-md mx-auto">
          Provider management functionality is coming soon. You'll be able to connect
          cloud providers, configure integrations, and manage your service connections.
        </p>

        <div className="mt-8 grid gap-4 max-w-2xl mx-auto md:grid-cols-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <Globe className="h-8 w-8 text-sky-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Cloud Providers</h4>
            <p className="text-sm text-gray-500 mt-1">AWS, GCP, Azure integrations</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <Zap className="h-8 w-8 text-sky-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">CI/CD Services</h4>
            <p className="text-sm text-gray-500 mt-1">GitHub Actions, GitLab CI</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <Building2 className="h-8 w-8 text-sky-600 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Service Integrations</h4>
            <p className="text-sm text-gray-500 mt-1">Third-party service connections</p>
          </div>
        </div>
      </div>
    </div>
  );
}