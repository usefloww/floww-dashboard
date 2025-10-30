import { createFileRoute } from "@tanstack/react-router";
import { useOrganizationStore } from "@/stores/organizationStore";
import { Building2, Edit, Trash2 } from "lucide-react";

export const Route = createFileRoute("/settings/organization")({
  component: OrganizationSettings,
});

function OrganizationSettings() {
  const { currentOrganization } = useOrganizationStore();

  return (
    <div className="space-y-6">
      {/* Current Organization */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Organization Details</h2>
          </div>
          <button className="flex items-center space-x-2 text-sky-600 hover:text-sky-700 text-sm">
            <Edit className="h-4 w-4" />
            <span>Edit</span>
          </button>
        </div>

        {currentOrganization && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization Name</label>
              <p className="mt-1 text-sm text-gray-900">
                {currentOrganization.display_name}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                {currentOrganization.name}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization ID</label>
              <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                {currentOrganization.id}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Created</label>
              <p className="mt-1 text-sm text-gray-900">
                {currentOrganization.created_at ? new Date(currentOrganization.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Billing & Plan */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Building2 className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Billing & Plan</h2>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Coming Soon</span>
        </div>
        <p className="text-gray-500 text-sm">
          Manage your organization's billing, subscription plan, and usage limits.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="bg-white border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Trash2 className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">Delete Organization</h3>
            <p className="text-sm text-gray-500 mt-1">
              Permanently delete this organization and all associated data. This action cannot be undone.
            </p>
          </div>
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm">
            Delete Organization
          </button>
        </div>
      </div>
    </div>
  );
}