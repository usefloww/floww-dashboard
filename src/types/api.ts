// Base types matching backend models

export interface Organization {
  id: string;
  name: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCreate {
  name: string;
  display_name: string;
}

export interface OrganizationUpdate {
  name?: string;
  display_name?: string;
}

export enum OrganizationRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member"
}

export interface OrganizationUser {
  id: string;
  workos_user_id: string;
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

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  namespace_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
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

export interface Namespace {
  id: string;
  user?: {
    id: string;
  };
  organization?: {
    id: string;
    name: string;
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