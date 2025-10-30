import { createFileRoute } from "@tanstack/react-router";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { OrganizationUserManagement } from "@/components/OrganizationUserManagement";
import { Building2, Edit } from "lucide-react";

export const Route = createFileRoute("/settings/")({
  component: OrganizationSettings,
});

function OrganizationSettings() {
  const { getCurrentWorkspaceContext } = useNamespaceStore();
  const { isOrganizationContext, organization } = getCurrentWorkspaceContext();

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

        {organization && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization Name</label>
              <p className="mt-1 text-sm text-gray-900">
                {organization.display_name}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                {organization.name}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization ID</label>
              <p className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                {organization.id}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Organization Members */}
      {isOrganizationContext && organization ? (
        <OrganizationUserManagement organizationId={organization.id} />
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">No Organization Selected</h2>
          <p className="text-yellow-700 text-sm">
            To view and manage organization members, please select an organization from the workspace switcher in the sidebar.
          </p>
        </div>
      )}

      {/* Danger Zone - Only show for organizations */}
      {/* {isOrganizationContext && organization && (
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
      )} */}
    </div>
  );
}