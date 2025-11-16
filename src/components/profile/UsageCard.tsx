import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Workflow, Activity } from 'lucide-react';

interface UsageData {
  workflows: number;
  workflows_limit: number;
  executions_this_month: number;
  executions_limit: number;
}

interface UsageCardProps {
  usage: UsageData;
}

export function UsageCard({ usage }: UsageCardProps) {
  const workflowPercentage = (usage.workflows / usage.workflows_limit) * 100;
  const executionPercentage = (usage.executions_this_month / usage.executions_limit) * 100;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-50 dark:bg-red-900/300';
    if (percentage >= 75) return 'bg-yellow-50 dark:bg-yellow-900/300';
    return 'bg-blue-50 dark:bg-blue-900/300';
  };

  const getWarningMessage = (percentage: number, type: string) => {
    if (percentage >= 100) {
      return `You've reached your ${type} limit. Upgrade to Hobby for higher limits.`;
    }
    if (percentage >= 90) {
      return `You're approaching your ${type} limit.`;
    }
    return null;
  };

  const workflowWarning = getWarningMessage(workflowPercentage, 'workflow');
  const executionWarning = getWarningMessage(executionPercentage, 'execution');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Statistics</CardTitle>
        <CardDescription>Your current usage this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
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
          {workflowWarning && (
            <p className="text-sm text-amber-600 ml-8">{workflowWarning}</p>
          )}
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Executions this month</p>
                <p className="text-sm text-muted-foreground">
                  {usage.executions_this_month.toLocaleString()} / {usage.executions_limit.toLocaleString()}
                </p>
              </div>
              <Progress
                value={Math.min(executionPercentage, 100)}
                className="h-2"
                indicatorClassName={getProgressColor(executionPercentage)}
              />
            </div>
          </div>
          {executionWarning && (
            <p className="text-sm text-amber-600 ml-8">{executionWarning}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
