import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api, handleApiError } from "@/lib/api";
import { ExecutionHistory as ExecutionHistoryType, ExecutionHistoryResponse, ExecutionStatus } from "@/types/api";
import { Loader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ExecutionHistoryProps {
  workflowId: string;
}

export function ExecutionHistory({ workflowId }: ExecutionHistoryProps) {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['executions', workflowId],
    queryFn: async () => {
      const response = await api.get<ExecutionHistoryResponse>(`/executions/workflows/${workflowId}`, {
        params: { limit: 50, offset: 0 }
      });
      return response;
    },
  });

  const executions = data?.executions || [];
  const errorMessage = error ? handleApiError(error) : null;

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');
  };

  const formatDuration = (durationMs: number | null) => {
    if (durationMs === null) return "—";
    if (durationMs < 1000) return `${durationMs}ms`;
    return `${(durationMs / 1000).toFixed(2)}s`;
  };

  const getStatusBadge = (status: ExecutionStatus) => {
    const statusConfig: Record<ExecutionStatus, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      completed: { variant: "default", label: "Completed" },
      failed: { variant: "destructive", label: "Failed" },
      started: { variant: "secondary", label: "Started" },
      received: { variant: "outline", label: "Received" },
      timeout: { variant: "destructive", label: "Timeout" },
      no_deployment: { variant: "outline", label: "No Deployment" },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTrigger = (execution: ExecutionHistoryType) => {
    if (!execution.trigger_type) return "—";

    if (execution.webhook_path && execution.webhook_method) {
      return `${execution.webhook_method} ${execution.webhook_path}`;
    }

    return execution.trigger_type;
  };

  const handleRowClick = (executionId: string) => {
    navigate({
      to: '/workflows/$workflowId/executions/$executionId',
      params: { workflowId, executionId }
    });
  };

  return (
    <Loader isLoading={isLoading} loadingMessage="Loading execution history...">
      <div className="space-y-4">
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
            {errorMessage}
          </div>
        )}

        {executions.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="mt-2 text-sm font-medium text-foreground">No executions</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No execution history found for this workflow.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Received At</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Deployment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((execution) => (
                <TableRow
                  key={execution.id}
                  onClick={() => handleRowClick(execution.id)}
                  className="cursor-pointer"
                >
                  <TableCell>{getStatusBadge(execution.status)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatTimestamp(execution.received_at)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatDuration(execution.duration_ms)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatTrigger(execution)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {execution.deployment_id ? execution.deployment_id.substring(0, 8) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Loader>
  );
}
