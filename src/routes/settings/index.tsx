import { createFileRoute } from "@tanstack/react-router";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { OrganizationUserManagement } from "@/components/OrganizationUserManagement";
import { ServiceAccountsManagement } from "@/components/ServiceAccountsManagement";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/settings/")({
  component: OrganizationSettings,
});

function OrganizationSettings() {
  const { getCurrentWorkspaceContext } = useNamespaceStore();
  const { isOrganizationContext, organization } = getCurrentWorkspaceContext();

  return (
    <div className="space-y-6">
      {/* Current Organization */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Organization Details</h2>
          </div>
        </div>

        {organization && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Organization Name</label>
              <p className="mt-1 text-sm text-foreground">
                {organization.display_name}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Organization Members */}
      {isOrganizationContext && organization ? (
        <>
          <OrganizationUserManagement organizationId={organization.id} />
          <ServiceAccountsManagement organizationId={organization.id} />
        </>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">No Organization Selected</h2>
          <p className="text-yellow-700 text-sm">
            To view and manage organization members, please select an organization from the workspace switcher in the sidebar.
          </p>
        </div>
      )}

      {/* Danger Zone - Only show for organizations */}
      {/* {isOrganizationContext && organization && (
        <div className="bg-card border border-red-200 dark:border-red-800/50 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Trash2 className="h-5 w-5 text-red-500 dark:text-red-400" />
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">Danger Zone</h2>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-foreground">Delete Organization</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete this organization and all associated data. This action cannot be undone.
              </p>
            </div>
            <button className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors text-sm">
              Delete Organization
            </button>
          </div>
        </div>
      )} */}
    </div>
  );
}