import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api, handleApiError } from '@/lib/api';
import { PersonalInfoCard } from '@/components/profile/PersonalInfoCard';
import { SubscriptionCard } from '@/components/profile/SubscriptionCard';
import { UsageCard } from '@/components/profile/UsageCard';
import { BillingActionsCard } from '@/components/profile/BillingActionsCard';
import { Loader } from '@/components/Loader';

export const Route = createFileRoute('/profile/')({
  component: ProfilePage,
});

interface SubscriptionData {
  tier: 'free' | 'hobby';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
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

function ProfilePage() {
  const { user } = Route.useRouteContext();

  const { data: config } = useQuery<{ is_cloud: boolean }>({
    queryKey: ['config'],
    queryFn: async () => {
      return await api.get<{ is_cloud: boolean }>('/config');
    },
  });

  const isBillingEnabled = config?.is_cloud ?? false;

  const {
    data: subscription,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = useQuery<SubscriptionData>({
    queryKey: ['subscription'],
    queryFn: async () => {
      try {
        return await api.get<SubscriptionData>('/subscriptions/me');
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },
    enabled: isBillingEnabled,
  });

  const {
    data: usage,
    isLoading: usageLoading,
    error: usageError,
  } = useQuery<UsageData>({
    queryKey: ['subscription-usage'],
    queryFn: async () => {
      try {
        return await api.get<UsageData>('/subscriptions/usage');
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },
    enabled: isBillingEnabled,
  });

  const isLoading = subscriptionLoading || usageLoading;
  const hasError = subscriptionError || usageError;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">
          {isBillingEnabled
            ? 'Manage your personal information and subscription'
            : 'Manage your personal information'}
        </p>
      </div>

      <div className="space-y-6">
        <PersonalInfoCard user={user} />

        {!isBillingEnabled ? (
          <div/>
        ) : (
          <Loader isLoading={isLoading} loadingMessage="Loading subscription details...">
            {hasError ? (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-4 text-red-600 dark:text-red-400">
                Failed to load subscription information. Please try again later.
              </div>
            ) : (
              <>
                <SubscriptionCard subscription={subscription!} />
                <UsageCard usage={usage!} />
                <BillingActionsCard subscription={subscription!} />
              </>
            )}
          </Loader>
        )}
      </div>
    </div>
  );
}
