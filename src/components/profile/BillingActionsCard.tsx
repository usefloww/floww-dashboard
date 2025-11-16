import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, handleApiError } from '@/lib/api';
import { ArrowUpCircle, Settings, Loader2 } from 'lucide-react';

interface SubscriptionData {
  tier: 'free' | 'hobby';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  has_active_pro: boolean;
}

interface BillingActionsCardProps {
  subscription: SubscriptionData;
}

export function BillingActionsCard({ subscription }: BillingActionsCardProps) {
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    setError(null);

    try {
      const { url } = await api.post<{ session_id: string; url: string }>(
        '/subscriptions/checkout',
        {
          success_url: `${window.location.origin}/profile?upgraded=true`,
          cancel_url: `${window.location.origin}/profile`,
        }
      );
      window.location.href = url;
    } catch (err) {
      setError(handleApiError(err));
      setUpgradeLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setManageLoading(true);
    setError(null);

    try {
      const { url } = await api.post<{ url: string }>('/subscriptions/portal', {
        return_url: `${window.location.origin}/profile`,
      });
      window.location.href = url;
    } catch (err) {
      setError(handleApiError(err));
      setManageLoading(false);
    }
  };

  const showUpgradeButton = subscription.tier === 'free' || !subscription.has_active_pro;
  const showManageButton = subscription.tier === 'hobby' && subscription.has_active_pro;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing Actions</CardTitle>
        <CardDescription>Manage your subscription and billing</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {showUpgradeButton && (
              <Button
                onClick={handleUpgrade}
                disabled={upgradeLoading}
                className="flex items-center gap-2"
                size="lg"
              >
                {upgradeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="h-4 w-4" />
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
                className="flex items-center gap-2"
                size="lg"
              >
                {manageLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    Manage Subscription
                  </>
                )}
              </Button>
            )}
          </div>

          {showUpgradeButton && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Hobby Plan Benefits</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Up to 100 workflows</li>
                <li>• 10,000 executions per month</li>
                <li>• Priority support</li>
                <li>• Advanced features</li>
              </ul>
            </div>
          )}

          {showManageButton && (
            <p className="text-sm text-muted-foreground">
              Update payment method, view invoices, or manage your subscription settings through the customer portal.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
