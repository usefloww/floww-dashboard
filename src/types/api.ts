// Base types matching backend models

export interface Organization {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCreate {
  display_name: string;
}

export interface OrganizationUpdate {
  display_name?: string;
}

export enum OrganizationRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member"
}

export interface OrganizationUser {
  id: string;
  workos_user_id: string | null;
  email?: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
  user: OrganizationUser;
}

export interface OrganizationMemberCreate {
  user_id: string;
  role: OrganizationRole;
}

export interface OrganizationMemberUpdate {
  role: OrganizationRole;
}

// Invitation types
export interface Invitation {
  id: string;
  email: string;
  state: string;
  created_at: string;
  expires_at: string;
}

export interface InvitationCreate {
  email: string;
  role?: string;
  expires_in_days?: number;
}

// SSO types
export interface SSOSetupRequest {
  return_url?: string;
  success_url?: string;
}

export interface SSOSetupResponse {
  admin_portal_link: string;
}

export interface CreatedByUser {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  namespace_id: string;
  created_by_id: string;
  created_by?: CreatedByUser;
  created_at: string;
  updated_at: string;
  active?: boolean | null;
  last_deployment?: {
    deployed_at: string;
    provider_definitions?: Array<{ type: string; alias: string }>;
  } | null;
}

export interface WorkflowCreate {
  name: string;
  namespace_id: string;
  description?: string;
}

export interface WorkflowUpdate {
  name?: string;
  description?: string;
  namespace_id?: string;
  active?: boolean;
}

export interface Provider {
  id: string;
  alias: string;
  type: string;
  namespace_id: string;
  config: Record<string, any>;
  // Optional fields that may not be present in backend response
  status?: 'connected' | 'disconnected' | 'pending';
  created_at?: string;
  updated_at?: string;
  last_used_at?: string;
  // Legacy field name for compatibility
  name?: string;
  configuration?: Record<string, string | number | boolean>;
}

export interface ProviderCreate {
  namespace_id: string;
  type: string;
  alias: string;
  config: Record<string, any>;
}

export interface ProviderUpdate {
  type?: string;
  alias?: string;
  config?: Record<string, any>;
}

export interface ProviderSetupStep {
  type: "value" | "secret" | "oauth" | "choice" | "file" | "info" | "webhook";
  title: string;
  description?: string;
  alias: string;
  required?: boolean;
  placeholder?: string;
  default?: string;
  // For choice type
  options?: string[];
  // For oauth type
  provider_name?: string;
  scopes?: string[];
  redirect_uri?: string;
  // For info type
  message?: string;
  action_text?: string;
  action_url?: string;
}

export interface ProviderType {
  provider_type: string;
  setup_steps: ProviderSetupStep[];
}

export interface Namespace {
  id: string;
  user?: {
    id: string;
  };
  organization?: {
    id: string;
    display_name: string;
  };
}

// User from whoami endpoint
export interface User {
  id: string;
  workos_user_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  created_at: string | null;
}

// Generic list response wrapper
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// API Error response
export interface ApiErrorResponse {
  detail: string;
  message?: string;
}

export enum WorkflowDeploymentStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface WorkflowDeployment {
  id: string;
  workflow_id: string;
  runtime_id: string;
  deployed_by_id?: string | null;
  user_code: {
    files: Record<string, string>;
    entrypoint: string;
  };
  status: WorkflowDeploymentStatus;
  deployed_at: string;
  note?: string | null;
  webhooks?: Array<{
    id: string;
    url: string;
    path?: string | null;
    method?: string | null;
  }> | null;
}

export interface WorkflowDeploymentsResponse {
  deployments: WorkflowDeployment[];
}

// Service Account types
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface ApiKeyCreatedResponse extends ApiKey {
  api_key: string;
}

export interface ServiceAccount {
  id: string;
  name: string;
  organization_id: string;
  api_keys: ApiKey[];
}

export interface ServiceAccountCreate {
  name: string;
  organization_id: string;
}

export interface ServiceAccountUpdate {
  name?: string;
}

export interface ApiKeyCreate {
  name: string;
}

export interface ServiceAccountsListResponse {
  results: ServiceAccount[];
}

export type ExecutionStatus =
  | "received"
  | "started"
  | "completed"
  | "failed"
  | "timeout"
  | "no_deployment";

export type LogLevel = "debug" | "info" | "warn" | "error" | "log";

export interface ExecutionLogEntry {
  id: string;
  execution_id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface ExecutionHistory {
  id: string;
  workflow_id: string;
  trigger_id: string | null;
  deployment_id: string | null;
  status: ExecutionStatus;
  received_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  log_entries: ExecutionLogEntry[] | null;
  trigger_type: string | null;
  webhook_path: string | null;
  webhook_method: string | null;
}

export interface ExecutionHistoryResponse {
  executions: ExecutionHistory[];
  total: number;
}

export interface WorkflowLogsResponse {
  workflow_id: string;
  logs: ExecutionLogEntry[];
  limit: number;
  offset: number;
}

export interface ExecutionDaySummary {
  date: string;
  total: number;
  completed: number;
  failed: number;
  started: number;
  received: number;
  timeout: number;
  no_deployment: number;
}

export interface SummaryResponse {
  executions_by_day: ExecutionDaySummary[];
  total_executions: number;
  total_completed: number;
  total_failed: number;
  period_days: number;
}