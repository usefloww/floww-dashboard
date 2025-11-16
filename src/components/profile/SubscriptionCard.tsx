import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface SubscriptionData {
  tier: 'free' | 'hobby';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  has_active_pro: boolean;
}

interface SubscriptionCardProps {
  subscription: SubscriptionData;
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = () => {
    switch (subscription.status) {
      case 'active':
        return (
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 dark:text-green-300 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'trialing':
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 dark:text-blue-300 hover:bg-blue-100">
            <Clock className="h-3 w-3 mr-1" />
            Trial
          </Badge>
        );
      case 'past_due':
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 dark:text-yellow-300 hover:bg-yellow-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            Past Due
          </Badge>
        );
      case 'canceled':
        return (
          <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 dark:text-red-300 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Canceled
          </Badge>
        );
      case 'incomplete':
        return (
          <Badge className="bg-muted text-foreground hover:bg-muted">
            <AlertCircle className="h-3 w-3 mr-1" />
            Incomplete
          </Badge>
        );
    }
  };

  const getTierDisplay = () => {
    return subscription.tier === 'hobby' ? 'Hobby' : 'Free';
  };

  const getStatusMessage = () => {
    if (subscription.status === 'trialing' && subscription.trial_ends_at) {
      return `Your trial ends on ${formatDate(subscription.trial_ends_at)}`;
    }

    if (subscription.status === 'active' && subscription.current_period_end) {
      if (subscription.cancel_at_period_end) {
        return `Your subscription will end on ${formatDate(subscription.current_period_end)}`;
      }
      return `Next billing date: ${formatDate(subscription.current_period_end)}`;
    }

    if (subscription.status === 'past_due' && subscription.grace_period_ends_at) {
      return `Payment failed. Access until ${formatDate(subscription.grace_period_ends_at)}`;
    }

    if (subscription.status === 'canceled' && subscription.current_period_end) {
      return `Access until ${formatDate(subscription.current_period_end)}`;
    }

    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription & Plan</CardTitle>
        <CardDescription>Your current subscription details</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold">{getTierDisplay()} Plan</h3>
              {getStatusBadge()}
            </div>

            {statusMessage && (
              <p className="text-sm text-muted-foreground mt-2">{statusMessage}</p>
            )}

            {subscription.status === 'past_due' && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Please update your payment method to continue using Hobby features.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
