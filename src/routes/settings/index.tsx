import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { OrganizationUserManagement } from "@/components/OrganizationUserManagement";
import { ServiceAccountsManagement } from "@/components/ServiceAccountsManagement";
import {
  Building2,
  Shield,
  ExternalLink,
  Loader2,
  Trash2,
  AlertTriangle,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowUpCircle,
  Settings,
  Workflow,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

interface SubscriptionData {
  tier: "free" | "hobby";
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  has_active_pro: boolean;
}

interface UsageData {
  workflows: number;
  workflows_limit: number;
  executions_this_month: number;
  executions_limit: number;
}

function BillingSection({ organizationId }: { organizationId: string }) {
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: config } = useQuery<{ is_cloud: boolean }>({
    queryKey: ["config"],
    queryFn: () => api.get<{ is_cloud: boolean }>("/config"),
  });

  const isBillingEnabled = config?.is_cloud ?? false;

  const {
    data: subscription,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = useQuery<SubscriptionData>({
    queryKey: ["subscription", organizationId],
    queryFn: () =>
      api.get<SubscriptionData>(`/organizations/${organizationId}/subscription`),
    enabled: isBillingEnabled,
  });

  const {
    data: usage,
    isLoading: usageLoading,
    error: usageError,
  } = useQuery<UsageData>({
    queryKey: ["usage", organizationId],
    queryFn: () => api.get<UsageData>(`/organizations/${organizationId}/usage`),
    enabled: isBillingEnabled,
  });

  if (!isBillingEnabled) {
    return null;
  }

  const isLoading = subscriptionLoading || usageLoading;
  const hasError = subscriptionError || usageError;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = () => {
    if (!subscription) return null;
    switch (subscription.status) {
      case "active":
        return (
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "trialing":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-100">
            <Clock className="h-3 w-3 mr-1" />
            Trial
          </Badge>
        );
      case "past_due":
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            Past Due
          </Badge>
        );
      case "canceled":
        return (
          <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Canceled
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-foreground hover:bg-muted">
            <AlertCircle className="h-3 w-3 mr-1" />
            {subscription.status}
          </Badge>
        );
    }
  };

  const getStatusMessage = () => {
    if (!subscription) return null;
    if (subscription.status === "trialing" && subscription.trial_ends_at) {
      return `Your trial ends on ${formatDate(subscription.trial_ends_at)}`;
    }
    if (subscription.status === "active" && subscription.current_period_end) {
      if (subscription.cancel_at_period_end) {
        return `Your subscription will end on ${formatDate(subscription.current_period_end)}`;
      }
      return `Next billing date: ${formatDate(subscription.current_period_end)}`;
    }
    if (subscription.status === "past_due" && subscription.grace_period_ends_at) {
      return `Payment failed. Access until ${formatDate(subscription.grace_period_ends_at)}`;
    }
    return null;
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    setActionError(null);
    try {
      const { url } = await api.post<{ session_id: string; url: string }>(
        `/organizations/${organizationId}/checkout`,
        {
          success_url: `${window.location.origin}/settings?upgraded=true`,
          cancel_url: `${window.location.origin}/settings`,
        }
      );
      window.location.href = url;
    } catch (err) {
      setActionError(handleApiError(err));
      setUpgradeLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setManageLoading(true);
    setActionError(null);
    try {
      const { url } = await api.post<{ url: string }>(
        `/organizations/${organizationId}/portal`,
        { return_url: `${window.location.origin}/settings` }
      );
      window.location.href = url;
    } catch (err) {
      setActionError(handleApiError(err));
      setManageLoading(false);
    }
  };

  const showUpgradeButton =
    subscription && (subscription.tier === "free" || !subscription.has_active_pro);
  const showManageButton =
    subscription && subscription.tier === "hobby" && subscription.has_active_pro;

  const workflowPercentage = usage
    ? (usage.workflows / usage.workflows_limit) * 100
    : 0;
  const executionPercentage = usage
    ? (usage.executions_this_month / usage.executions_limit) * 100
    : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-primary";
  };

  const getUsageWarning = (percentage: number, type: string) => {
    if (percentage >= 100) {
      return `You've reached your ${type} limit. Upgrade to Hobby for higher limits.`;
    }
    if (percentage >= 90) {
      return `You're approaching your ${type} limit.`;
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center space-x-2 mb-6">
        <CreditCard className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Billing & Usage</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading billing information...
        </div>
      ) : hasError ? (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
          Failed to load billing information.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subscription Status */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-xl font-bold">
                  {subscription?.tier === "hobby" ? "Hobby" : "Free"} Plan
                </h3>
                {getStatusBadge()}
              </div>
              {getStatusMessage() && (
                <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>
              )}
            </div>
          </div>

          {/* Past Due Warning */}
          {subscription?.status === "past_due" && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Please update your payment method to continue using Hobby features.
              </p>
            </div>
          )}

          {/* Usage Stats */}
          {usage && (
            <div className="grid gap-4 pt-2">
              <div>
                <div className="flex items-center gap-3">
                  <Workflow className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">Workflows</p>
                      <p className="text-sm text-muted-foreground">
                        {usage.workflows} / {usage.workflows_limit}
                      </p>
                    </div>
                    <Progress
                      value={Math.min(workflowPercentage, 100)}
                      className="h-2"
                      indicatorClassName={getProgressColor(workflowPercentage)}
                    />
                  </div>
                </div>
                {getUsageWarning(workflowPercentage, "workflow") && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 ml-8">
                    {getUsageWarning(workflowPercentage, "workflow")}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">Executions this month</p>
                      <p className="text-sm text-muted-foreground">
                        {usage.executions_this_month.toLocaleString()} /{" "}
                        {usage.executions_limit.toLocaleString()}
                      </p>
                    </div>
                    <Progress
                      value={Math.min(executionPercentage, 100)}
                      className="h-2"
                      indicatorClassName={getProgressColor(executionPercentage)}
                    />
                  </div>
                </div>
                {getUsageWarning(executionPercentage, "execution") && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 ml-8">
                    {getUsageWarning(executionPercentage, "execution")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-border">
            {actionError && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm mb-4">
                {actionError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {showUpgradeButton && (
                <Button onClick={handleUpgrade} disabled={upgradeLoading}>
                  {upgradeLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="h-4 w-4 mr-2" />
                      Upgrade to Hobby
                    </>
                  )}
                </Button>
              )}

              {showManageButton && (
                <Button
                  onClick={handleManageSubscription}
                  disabled={manageLoading}
                  variant="outline"
                >
                  {manageLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Subscription
                    </>
                  )}
                </Button>
              )}
            </div>

            {showUpgradeButton && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                  Hobby Plan Benefits
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li>• Up to 100 workflows</li>
                  <li>• 10,000 executions per month</li>
                  <li>• Priority support</li>
                  <li>• Advanced features</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DangerZone({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
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
      await fetchNamespaces();
      const freshNamespaces = useNamespaceStore.getState().namespaces;
      const firstNamespace = freshNamespaces[0];
      if (firstNamespace) {
        setCurrentNamespace(firstNamespace);
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
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800/30 rounded-lg bg-red-50/50 dark:bg-red-950/20">
            <div>
              <h3 className="font-medium text-foreground">Delete this organization</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Once deleted, all workflows, providers, and data will be permanently
                removed. This action cannot be undone.
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
              This will permanently delete{" "}
              <strong className="text-foreground">{organizationName}</strong> and all
              its associated data including:
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
              Type{" "}
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                {organizationName}
              </span>{" "}
              to confirm:
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
        <div className="space-y-3">
          <h3 className="text-sm font-medium">SSO Admin Portal</h3>
          <p className="text-sm text-muted-foreground">
            Share this Admin Portal link with your IT administrator to configure Single
            Sign-On with your identity provider (Okta, Azure AD, Google Workspace, etc.).
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(portalLink, "_blank")}
                >
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
  const { currentNamespace } = useNamespaceStore();
  const organization = currentNamespace?.organization;

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
              <label className="block text-sm font-medium text-foreground">
                Organization Name
              </label>
              <p className="mt-1 text-sm text-foreground">{organization.display_name}</p>
            </div>
          </div>
        )}
      </div>

      {organization ? (
        <>
          <BillingSection organizationId={organization.id} />
          <OrganizationUserManagement organizationId={organization.id} />
          <AuthenticationSettings organizationId={organization.id} />
          <ServiceAccountsManagement organizationId={organization.id} />
          <DangerZone
            organizationId={organization.id}
            organizationName={organization.display_name}
          />
        </>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
            No Organization Selected
          </h2>
          <p className="text-yellow-700 text-sm">
            To view and manage organization members, please select an organization from
            the workspace switcher in the sidebar.
          </p>
        </div>
      )}
    </div>
  );
}
