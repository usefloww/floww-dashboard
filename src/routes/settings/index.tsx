import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { OrganizationUserManagement } from "@/components/OrganizationUserManagement";
import { ServiceAccountsManagement } from "@/components/ServiceAccountsManagement";
import { Building2, Shield, ExternalLink, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, handleApiError } from "@/lib/api";
import { SSOSetupResponse } from "@/types/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/settings/")({
  component: OrganizationSettings,
});

function DangerZone({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const navigate = useNavigate();
  const { fetchNamespaces, setCurrentNamespace } = useNamespaceStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return api.delete(`/organizations/${organizationId}`);
    },
    onSuccess: async () => {
      // Refresh namespaces - fetchNamespaces will automatically switch to personal namespace
      await fetchNamespaces();
      // Get fresh namespaces from the store after fetch
      const freshNamespaces = useNamespaceStore.getState().namespaces;
      const personalNamespace = freshNamespaces.find(ns => ns.user);
      if (personalNamespace) {
        setCurrentNamespace(personalNamespace);
      }
      navigate({ to: "/" });
    },
    onError: (error) => {
      setDeleteError(handleApiError(error));
    },
  });

  const handleDelete = () => {
    setDeleteError(null);
    deleteMutation.mutate();
  };

  const isConfirmationValid = confirmationText === organizationName;

  return (
    <>
      <div className="bg-card border border-red-300 dark:border-red-800/50 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800/30 rounded-lg bg-red-50/50 dark:bg-red-950/20">
            <div>
              <h3 className="font-medium text-foreground">Delete this organization</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Once deleted, all workflows, providers, and data will be permanently removed. This action cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="shrink-0 ml-4"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Organization
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will permanently delete <strong className="text-foreground">{organizationName}</strong> and all its associated data including:
            </DialogDescription>
          </DialogHeader>

          <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
            <li>All workflows and their execution history</li>
            <li>All provider integrations</li>
            <li>All team member access</li>
            <li>All service accounts and API keys</li>
          </ul>

          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium">
              Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{organizationName}</span> to confirm:
            </label>
            <Input
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Enter organization name"
              className="font-mono"
            />
          </div>

          {deleteError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {deleteError}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setConfirmationText("");
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmationValid || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AuthenticationSettings({ organizationId }: { organizationId: string }) {
  const [adminEmail, setAdminEmail] = useState("");
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const currentUrl = window.location.href;
      return api.post<SSOSetupResponse>(`/organizations/${organizationId}/sso/setup`, {
        return_url: currentUrl,
        success_url: currentUrl,
      });
    },
    onSuccess: (data) => {
      setPortalLink(data.admin_portal_link);
      setError(null);
    },
    onError: (error) => {
      setError(handleApiError(error));
    },
  });

  // Auto-generate link on mount
  useEffect(() => {
    generateLinkMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleRegenerateLink = () => {
    setError(null);
    generateLinkMutation.mutate();
  };

  const handleCopyLink = async () => {
    if (portalLink) {
      await navigator.clipboard.writeText(portalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Authentication & SSO</h2>
      </div>

      <div className="space-y-6">
        {/* Admin Portal Setup Link */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">SSO Admin Portal</h3>
          <p className="text-sm text-muted-foreground">
            Share this Admin Portal link with your IT administrator to configure Single Sign-On with your identity provider (Okta, Azure AD, Google Workspace, etc.).
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {generateLinkMutation.isPending && !portalLink && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating setup link...
            </div>
          )}

          {portalLink && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={portalLink}
                  readOnly
                  className="font-mono text-xs bg-muted/50"
                />
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(portalLink, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  placeholder="IT admin email (for your reference)"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="max-w-xs"
                />
                {adminEmail && (
                  <span className="text-xs text-muted-foreground">
                    Send the link above to <strong>{adminEmail}</strong>
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateLink}
                disabled={generateLinkMutation.isPending}
                className="text-xs"
              >
                {generateLinkMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  "Regenerate link"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
          <AuthenticationSettings organizationId={organization.id} />
          <ServiceAccountsManagement organizationId={organization.id} />
          <DangerZone organizationId={organization.id} organizationName={organization.display_name} />
        </>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">No Organization Selected</h2>
          <p className="text-yellow-700 text-sm">
            To view and manage organization members, please select an organization from the workspace switcher in the sidebar.
          </p>
        </div>
      )}
    </div>
  );
}
